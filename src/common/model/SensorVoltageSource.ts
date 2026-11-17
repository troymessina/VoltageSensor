/**
 * SensorVoltageSource.ts
 *
 * The one link to a PASCO Wireless Voltage Sensor (PS-3211), reached directly
 * over Web Bluetooth or WebUSB using its small PASCO wire protocol. One instance
 * lives for the whole sim and is shared by both screens, so connecting on the
 * Meter screen also connects the Voltage vs Time screen, and vice versa.
 *
 * ── Always sampling while connected ───────────────────────────────────────────
 * Unlike the motion sensor this was adapted from, which silences its transducer
 * between runs, a voltmeter is expected to read live: the Meter screen has no
 * Record button. So sampling starts the moment a connection is made and stops
 * when it is dropped. A recording does not start or stop anything here; it only
 * calls {@link beginRun}, so that its t = 0 waits for a reading taken after
 * Record was pressed and zero-at-start knows which reading to consume.
 *
 * One `readRawSample` is one round trip. Where the transport can carry a stream
 * (USB), the device keeps time itself instead and pushes samples.
 *
 * ── What the device measures, and what this publishes ─────────────────────────
 * The device answers with a raw 16-bit count, and nothing else. Everything a
 * student can change about the reading is applied here, in one place and one
 * order:
 *
 *   raw count ─▶ volts (range calibration) ─▶ − zero offset ─▶ × sign ─▶ published
 *
 * That is the set of adjustments PASCO's own software offers for this sensor
 * (Change Sign, Zero Sensor Now, Zero at Start, Range), applied in the same
 * order. Diagnostics report the *raw* count and calibrated volts, before any
 * adjustment — the numbers that tell you whether the hardware is answering.
 *
 * ── The range is a device setting ─────────────────────────────────────────────
 * The PS-3211 has two input ranges, ±5 V and ±15 V, and the raw count means
 * different volts in each. The chosen range is sent to the device on connect and
 * whenever it changes, and the same choice picks the calibration. If the device
 * refuses the command, {@link rangeCommandFailedProperty} says so: the reading
 * is then only right if the device happens to be in the range chosen here — it
 * powers up on ±15 V, which is why that is the default.
 *
 * ── Errors never reach the caller ─────────────────────────────────────────────
 * `connect()` resolves even when it fails. Connection outcomes are UI state, not
 * exceptions: the button listener stays synchronous (so the browser still sees a
 * user gesture), and every outcome lands on `connectionStateProperty` /
 * `errorMessageProperty` where the panel can render it. A cancelled device
 * picker is not a failure — it returns to DISCONNECTED with no message.
 */

import { BooleanProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import {
  DEFAULT_POLL_INTERVAL_MS,
  MAXIMUM_CONSECUTIVE_FAILURES,
  SENSOR_VOLTAGE_SOURCE_SETTINGS,
  VOLTAGE_MEASUREMENT,
} from "../../VoltageSensorConstants.js";
import VoltageSensorNamespace from "../../VoltageSensorNamespace.js";
import { ConnectionState, type ConnectionStateValue } from "./ConnectionState.js";
import { BluetoothVoltageSensor } from "./hardware/BluetoothVoltageSensor.js";
import { rawCountToVolts, VoltageRange, type VoltageRangeValue } from "./hardware/PascoVoltageProtocol.js";
import { UsbVoltageSensor } from "./hardware/UsbVoltageSensor.js";
import { DeviceSelectionCancelled, type TVoltageSensorDevice } from "./hardware/VoltageSensorDevice.js";
import type { TVoltageSource } from "./VoltageSource.js";
import { adjustReading } from "./voltageMeasurement.js";

/** The two ways a PS-3211 can be reached from a browser. */
export const SensorTransport = {
  BLUETOOTH: "bluetooth",
  USB: "usb",
} as const;

export type SensorTransportValue = (typeof SensorTransport)[keyof typeof SensorTransport];

/**
 * How long a stream may say nothing before it is given up on. Long enough to
 * cover a slow first sample.
 */
const STREAM_SILENCE_TIMEOUT_MS: number = SENSOR_VOLTAGE_SOURCE_SETTINGS.STREAM_SILENCE_TIMEOUT_MS;

/**
 * Sample periods of silence tolerated, so a period raised with
 * `?pollIntervalMs=` is not mistaken for a dead stream.
 */
const STREAM_SILENCE_PERIODS: number = SENSOR_VOLTAGE_SOURCE_SETTINGS.STREAM_SILENCE_PERIODS;

export type SensorVoltageSourceOptions = {
  /**
   * Sample period in milliseconds — the poll period, or the period the device
   * is asked to keep when it is streaming. Overridable from a query parameter.
   */
  readonly pollIntervalMs?: number;
  /**
   * Let a transport that can carry a stream put the device on its own clock.
   * False polls everywhere; transports without a stream poll regardless.
   */
  readonly streamingEnabled?: boolean;
  /** USB bring-up switches; ignored on Bluetooth. */
  readonly usbProbeOnly?: boolean;
  readonly usbAcceptAllDevices?: boolean;
  /** When true, logs every raw reading to the console. */
  readonly diagnosticsEnabledProperty?: TReadOnlyProperty<boolean>;
};

export class SensorVoltageSource implements TVoltageSource {
  /** The voltage the sensor last read, in volts, after the adjustments below. */
  public readonly sensorVoltageProperty: NumberProperty;

  /** True once a reading has arrived on the current connection. */
  public readonly hasReadingProperty: BooleanProperty;

  /** Which of the device's two input ranges to use, and to decode with. */
  public readonly rangeProperty: Property<VoltageRangeValue>;

  /**
   * True when the device did not accept the last range command, so its range
   * may not match {@link rangeProperty}.
   */
  public readonly rangeCommandFailedProperty: BooleanProperty;

  /** Negates the reading — the same as swapping the red and black leads. */
  public readonly changeSignProperty: BooleanProperty;

  /**
   * When true, the first reading of each recording becomes the new zero, so a
   * run records the change in voltage from wherever it started.
   */
  public readonly zeroAtStartProperty: BooleanProperty;

  /** Voltage subtracted from every reading, in volts. Zero until one is captured. */
  public readonly zeroOffsetProperty: NumberProperty;

  /**
   * True while a recording is running. Lives here, on the one shared source,
   * so the options panel on *either* screen can lock the adjustments that would
   * put a step into the trace.
   */
  public readonly runInProgressProperty: BooleanProperty;

  public readonly connectionStateProperty: Property<ConnectionStateValue>;

  /** Human-readable failure text, or null when nothing has gone wrong. */
  public readonly errorMessageProperty: Property<string | null>;

  /** Advertised name of the connected device, or null. */
  public readonly deviceNameProperty: Property<string | null>;

  /**
   * What the device is being read as, captured at connect time. Empty until
   * connected. Shown only with diagnostics on.
   */
  public readonly measurementListProperty: Property<string>;

  /** The last raw reading and its calibrated value, formatted for display. */
  public readonly diagnosticsProperty: Property<string>;

  private readonly availableProperty: BooleanProperty;

  private readonly pollIntervalMs: number;
  private readonly streamingEnabled: boolean;
  private readonly usbProbeOnly: boolean;
  private readonly usbAcceptAllDevices: boolean;
  private readonly diagnosticsEnabledProperty: TReadOnlyProperty<boolean> | null;
  private readonly handleUnexpectedDisconnect: () => void;
  private readonly republishAdjusted: () => void;
  private readonly handleRangeChange: () => void;

  private device: TVoltageSensorDevice | null = null;

  /** Last raw count the device actually reported. Null before the first one. */
  private lastRawCount: number | null = null;

  /** Set by {@link beginRun} when zero-at-start is on; the next new reading consumes it. */
  private zeroOnNextReading = false;

  /** Whether a reading has been published since {@link beginRun}. */
  private freshReading = false;

  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private isStreaming = false;
  /** Whether the link is meant to be delivering readings, whichever mechanism is serving it. */
  private samplingRequested = false;
  /** Restarted by every pushed sample; fires only after a stream has gone quiet. */
  private streamWatchdogId: ReturnType<typeof setTimeout> | null = null;
  private samplesSinceStreamStart = 0;
  /** Invalidates an asynchronous read if sampling stops while it is in flight. */
  private pollingGeneration = 0;
  private consecutiveFailures = 0;
  private diagnosticsStartTimeMs = 0;
  /** Range commands run one after another, never interleaved. */
  private rangeCommandChain: Promise<void> = Promise.resolve();

  public constructor(providedOptions?: SensorVoltageSourceOptions) {
    this.pollIntervalMs = providedOptions?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.streamingEnabled = providedOptions?.streamingEnabled !== false;
    this.usbProbeOnly = providedOptions?.usbProbeOnly === true;
    this.usbAcceptAllDevices = providedOptions?.usbAcceptAllDevices === true;
    this.diagnosticsEnabledProperty = providedOptions?.diagnosticsEnabledProperty ?? null;

    this.sensorVoltageProperty = new NumberProperty(0, { units: "V" });
    this.hasReadingProperty = new BooleanProperty(false);
    this.rangeProperty = new Property<VoltageRangeValue>(VoltageRange.PLUS_MINUS_15V);
    this.rangeCommandFailedProperty = new BooleanProperty(false);
    this.changeSignProperty = new BooleanProperty(false);
    this.zeroAtStartProperty = new BooleanProperty(false);
    this.zeroOffsetProperty = new NumberProperty(0, { units: "V" });
    this.runInProgressProperty = new BooleanProperty(false);
    this.connectionStateProperty = new Property<ConnectionStateValue>(ConnectionState.DISCONNECTED);
    this.errorMessageProperty = new Property<string | null>(null);
    this.deviceNameProperty = new Property<string | null>(null);
    this.availableProperty = new BooleanProperty(false);
    this.measurementListProperty = new Property<string>("");
    this.diagnosticsProperty = new Property<string>("");

    // An adjustment changes what the last reading *means*, so republish it at
    // once rather than leaving a stale number on screen until the next sample.
    this.republishAdjusted = () => {
      if (this.lastRawCount !== null) {
        this.publishRawCount(this.lastRawCount, false);
      }
    };
    this.changeSignProperty.lazyLink(this.republishAdjusted);
    this.zeroOffsetProperty.lazyLink(this.republishAdjusted);

    // A new range is a new calibration *and* a device command. The offset was
    // captured in the old range's volts, which still mean volts, so it stands.
    this.handleRangeChange = () => {
      this.republishAdjusted();
      this.queueRangeCommand();
    };
    this.rangeProperty.lazyLink(this.handleRangeChange);

    this.handleUnexpectedDisconnect = () => {
      this.stopSampling();
      this.availableProperty.value = false;
      this.hasReadingProperty.value = false;
      this.deviceNameProperty.value = null;
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = "disconnected";
    };
  }

  public get voltageProperty(): TReadOnlyProperty<number> {
    return this.sensorVoltageProperty;
  }

  public get isAvailableProperty(): TReadOnlyProperty<boolean> {
    return this.availableProperty;
  }

  /**
   * Opens the browser's device picker for the given transport and connects.
   * Never rejects.
   *
   * The transport is an argument rather than a constructor option because the
   * panel offers both and the student picks one at the moment of connecting.
   * The device picker is invoked before the first await so the browser still
   * recognizes the Connect button's user gesture.
   */
  public async connect(transport: SensorTransportValue = SensorTransport.BLUETOOTH): Promise<void> {
    if (
      this.connectionStateProperty.value === ConnectionState.CONNECTING ||
      this.connectionStateProperty.value === ConnectionState.CONNECTED
    ) {
      return;
    }

    this.connectionStateProperty.value = ConnectionState.CONNECTING;
    this.errorMessageProperty.value = null;

    const device: TVoltageSensorDevice =
      transport === SensorTransport.USB
        ? new UsbVoltageSensor(this.handleUnexpectedDisconnect, {
            probeOnly: this.usbProbeOnly,
            acceptAllDevices: this.usbAcceptAllDevices,
            logDetails: this.diagnosticsEnabledProperty?.value === true,
          })
        : new BluetoothVoltageSensor(this.handleUnexpectedDisconnect);
    this.device = device;

    try {
      await device.connect();
    } catch (error) {
      await device.disconnect();
      this.device = null;
      if (error instanceof DeviceSelectionCancelled) {
        this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
        return;
      }
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = error instanceof Error ? error.message : String(error);
      return;
    }

    this.deviceNameProperty.value = device.name;
    this.measurementListProperty.value = VOLTAGE_MEASUREMENT;
    this.connectionStateProperty.value = ConnectionState.CONNECTED;
    this.consecutiveFailures = 0;
    this.diagnosticsStartTimeMs = performance.now();

    if (this.usbProbeOnly) {
      // The whole point of a probe is that the device is left untouched, and a
      // device that is never sampled is not a source to record from.
      this.diagnosticsProperty.value = device.diagnosticText ?? "probe complete";
      return;
    }

    // The range goes out before the first sample, so the first reading is
    // already decoded with the calibration the device is actually using.
    await this.sendRangeCommand(device);
    if (device !== this.device) {
      return;
    }
    this.availableProperty.value = true;
    this.startSampling();
  }

  /** Tears the link down deliberately. Never rejects. */
  public async disconnect(): Promise<void> {
    this.stopSampling();
    const device = this.device;
    this.device = null;
    try {
      await device?.disconnect();
    } catch {
      // A disconnect that fails leaves nothing useful to say or do; the state
      // below is what the student sees either way.
    }
    this.availableProperty.value = false;
    this.hasReadingProperty.value = false;
    this.deviceNameProperty.value = null;
    this.lastRawCount = null;
    this.rangeCommandFailedProperty.value = false;
    this.measurementListProperty.value = "";
    this.diagnosticsProperty.value = "";
    this.errorMessageProperty.value = null;
    this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
  }

  /** See {@link TVoltageSource.beginRun}. */
  public beginRun(): void {
    this.freshReading = false;
    // Zero-at-start is armed rather than applied: the offset is whatever the
    // *first reading* of this run turns out to be.
    this.zeroOnNextReading = this.zeroAtStartProperty.value;
    this.runInProgressProperty.value = true;
  }

  /** See {@link TVoltageSource.endRun}. */
  public endRun(): void {
    this.zeroOnNextReading = false;
    this.runInProgressProperty.value = false;
  }

  public hasFreshReading(): boolean {
    return this.freshReading;
  }

  /** Takes the current reading as the new zero. */
  public zeroNow(): void {
    if (this.lastRawCount !== null) {
      this.zeroOffsetProperty.value = rawCountToVolts(this.lastRawCount, this.rangeProperty.value);
    }
  }

  /** Returns to the voltage the sensor itself reports. */
  public removeZeroOffset(): void {
    this.zeroOffsetProperty.value = 0;
  }

  // ── Range command ───────────────────────────────────────────────────────────

  private queueRangeCommand(): void {
    this.rangeCommandChain = this.rangeCommandChain.then(() => this.changeRangeWhileConnected());
  }

  /**
   * Sends a new range to a connected device. Sampling is halted around it —
   * a stream must be stopped before the link carries anything else — and
   * resumed afterwards. Never rejects.
   */
  private async changeRangeWhileConnected(): Promise<void> {
    const device = this.device;
    if (device === null || !device.isConnected || this.usbProbeOnly || !this.availableProperty.value) {
      return;
    }
    const wasSampling = this.samplingRequested;
    if (wasSampling) {
      this.stopSampling();
      await device.stopStreaming?.().catch(() => undefined);
    }
    await this.sendRangeCommand(device);
    if (wasSampling && device === this.device && device.isConnected) {
      this.startSampling();
    }
  }

  /** Writes the chosen range to the device and records whether it was accepted. Never rejects. */
  private async sendRangeCommand(device: TVoltageSensorDevice): Promise<void> {
    try {
      await device.setRange(this.rangeProperty.value);
      this.rangeCommandFailedProperty.value = false;
    } catch (error) {
      this.rangeCommandFailedProperty.value = true;
      this.diagnosticsProperty.value = `range command failed: ${error instanceof Error ? error.message : error}`;
      if (this.diagnosticsEnabledProperty?.value === true) {
        // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
        console.warn("[VoltageSensor] range command failed", error);
      }
    }
  }

  // ── Sampling ────────────────────────────────────────────────────────────────

  private startSampling(): void {
    if (this.samplingRequested || this.usbProbeOnly) {
      return;
    }
    this.samplingRequested = true;
    this.diagnosticsStartTimeMs = performance.now();

    // Streaming lets the device keep time, which removes the round-trip jitter
    // a poll cannot avoid. It needs a transport that can carry the stream;
    // anything else polls, which always works.
    const device = this.device;
    if (this.streamingEnabled && device?.startStreaming) {
      this.isStreaming = true;
      this.samplesSinceStreamStart = 0;
      this.armStreamWatchdog();
      device
        .startStreaming(this.pollIntervalMs, (rawCount) => {
          this.acceptReading(rawCount);
        })
        .catch((error: unknown) => {
          // A device that will not stream still answers single reads.
          this.isStreaming = false;
          this.diagnosticsProperty.value = `streaming refused: ${error instanceof Error ? error.message : error}`;
          if (this.samplingRequested) {
            this.startPolling();
          }
        });
      return;
    }

    this.startPolling();
  }

  /**
   * (Re)starts the stream's silence deadline. Silence before the first sample
   * is answered by polling, since a device that will not stream may still answer
   * single reads; silence after samples have arrived means the link was lost.
   */
  private armStreamWatchdog(): void {
    if (this.streamWatchdogId !== null) {
      clearTimeout(this.streamWatchdogId);
    }
    const device = this.device;
    const timeoutMs = Math.max(STREAM_SILENCE_TIMEOUT_MS, STREAM_SILENCE_PERIODS * this.pollIntervalMs);
    this.streamWatchdogId = setTimeout(() => {
      this.streamWatchdogId = null;
      if (!(this.samplingRequested && this.isStreaming) || device !== this.device) {
        return;
      }
      if (this.samplesSinceStreamStart === 0) {
        this.diagnosticsProperty.value = "stream silent; polling instead";
        this.isStreaming = false;
        device?.stopStreaming?.().catch(() => undefined);
        this.startPolling();
        return;
      }
      this.failSampling("stream stopped");
    }, timeoutMs);
  }

  /** Gives up on a link that has stopped answering. */
  private failSampling(message: string): void {
    this.stopSampling();
    this.availableProperty.value = false;
    this.hasReadingProperty.value = false;
    this.connectionStateProperty.value = ConnectionState.ERROR;
    this.errorMessageProperty.value = message;
  }

  private startPolling(): void {
    if (this.pollTimerId !== null) {
      return;
    }
    const generation = ++this.pollingGeneration;
    this.poll(generation).catch(() => undefined);
    this.pollTimerId = setInterval(() => {
      this.poll(generation).catch(() => undefined);
    }, this.pollIntervalMs);
  }

  private stopSampling(): void {
    this.samplingRequested = false;
    this.pollingGeneration += 1;
    this.zeroOnNextReading = false;
    this.freshReading = false;
    if (this.streamWatchdogId !== null) {
      clearTimeout(this.streamWatchdogId);
      this.streamWatchdogId = null;
    }
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
    this.isPolling = false;
    this.isStreaming = false;
    // Asked for unconditionally: a streaming device keeps its own clock until
    // it is told to stop. `stopStreaming` knows whether a stop is owed.
    this.device?.stopStreaming?.().catch(() => undefined);
  }

  /**
   * One reading. Skipping a tick because the previous round trip has not
   * returned is harmless — the recorder samples the latest value, so a late
   * reading costs at most one repeated sample rather than corrupting the trace.
   */
  private async poll(generation: number): Promise<void> {
    const device = this.device;
    if (this.isPolling || device === null || !device.isConnected) {
      return;
    }
    this.isPolling = true;

    try {
      const rawCount = await device.readRawSample();
      if (generation !== this.pollingGeneration) {
        return;
      }
      this.acceptReading(rawCount);
    } catch (error) {
      if (generation !== this.pollingGeneration) {
        return;
      }
      this.consecutiveFailures += 1;
      if (this.diagnosticsEnabledProperty?.value === true) {
        // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
        console.warn("[VoltageSensor] read failed", error, device.diagnosticText ?? "");
      }
      if (this.consecutiveFailures >= MAXIMUM_CONSECUTIVE_FAILURES) {
        this.failSampling(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.isPolling = false;
    }
  }

  /** One reading, however it arrived — polled round trip or pushed by the device. */
  private acceptReading(rawCount: number): void {
    const volts = rawCountToVolts(rawCount, this.rangeProperty.value);
    this.diagnosticsProperty.value = `raw=${rawCount} → ${toFixed(volts, 4)} V`;

    if (this.diagnosticsEnabledProperty?.value === true) {
      const elapsedSeconds = (performance.now() - this.diagnosticsStartTimeMs) / 1000;
      // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
      console.info(`[VoltageSensor +${toFixed(elapsedSeconds, 3)} s]`, {
        RawCount: rawCount,
        Voltage: volts,
        ...(this.device?.diagnosticText ? { RawTransfer: this.device.diagnosticText } : {}),
      });
    }

    this.consecutiveFailures = 0;
    this.samplesSinceStreamStart += 1;
    if (this.isStreaming && this.samplingRequested) {
      this.armStreamWatchdog();
    }
    this.publishRawCount(rawCount, true);
    if (this.samplingRequested) {
      this.freshReading = true;
      this.hasReadingProperty.value = true;
    }
  }

  /**
   * Calibrates one raw count, applies the student's adjustments, and publishes.
   *
   * @param isNewReading - true for a reading just taken from the device; false
   *   when republishing the last one after an adjustment. Only a new reading
   *   may consume an armed zero-at-start.
   */
  private publishRawCount(rawCount: number, isNewReading: boolean): void {
    const volts = rawCountToVolts(rawCount, this.rangeProperty.value);
    this.lastRawCount = rawCount;
    if (isNewReading && this.zeroOnNextReading) {
      this.zeroOnNextReading = false;
      this.zeroOffsetProperty.value = volts;
    }
    this.sensorVoltageProperty.value = adjustReading(volts, {
      zeroOffsetV: this.zeroOffsetProperty.value,
      changeSign: this.changeSignProperty.value,
    });
  }

  /** Returns the measurement settings to their defaults without dropping the connection. */
  public reset(): void {
    this.rangeProperty.reset();
    this.changeSignProperty.reset();
    this.zeroAtStartProperty.reset();
    this.zeroOffsetProperty.reset();
    this.zeroOnNextReading = false;
  }

  /**
   * Releases the device and every Property. The app's source lives as long as
   * the sim does; this exists for tests and the memory-leak suite.
   */
  public dispose(): void {
    this.stopSampling();
    if (this.device !== null) {
      // Fire-and-forget: dispose cannot await, and a failed teardown of a link
      // that is going away anyway has nothing useful to report.
      this.device.disconnect().catch(() => undefined);
      this.device = null;
    }
    this.changeSignProperty.unlink(this.republishAdjusted);
    this.zeroOffsetProperty.unlink(this.republishAdjusted);
    this.rangeProperty.unlink(this.handleRangeChange);
    this.sensorVoltageProperty.dispose();
    this.hasReadingProperty.dispose();
    this.rangeProperty.dispose();
    this.rangeCommandFailedProperty.dispose();
    this.changeSignProperty.dispose();
    this.zeroAtStartProperty.dispose();
    this.zeroOffsetProperty.dispose();
    this.runInProgressProperty.dispose();
    this.connectionStateProperty.dispose();
    this.errorMessageProperty.dispose();
    this.deviceNameProperty.dispose();
    this.measurementListProperty.dispose();
    this.diagnosticsProperty.dispose();
    this.availableProperty.dispose();
  }
}

VoltageSensorNamespace.register("SensorVoltageSource", SensorVoltageSource);
