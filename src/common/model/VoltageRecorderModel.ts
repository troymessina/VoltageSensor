/**
 * VoltageRecorderModel.ts
 *
 * The Voltage vs Time screen's activity: where a recording is in its lifecycle,
 * the recorded trace, and the live voltage / time the graph samples from.
 *
 * ── One fixed clock ───────────────────────────────────────────────────────────
 * The trace is sampled on a fixed-timestep accumulator rather than on raw frame
 * dt, at the rate the student chose ({@link sampleRateProperty}) and captured
 * when a recording starts. Sample times are `index × period`, never a float
 * accumulated tick by tick, so a 10 Hz run has its samples at exactly 0.0, 0.1,
 * 0.2 s … whatever the display's frame rate, and the graph's time axis is
 * evenly spaced instead of bunching wherever the browser happened to be busy.
 *
 * The sensor delivers readings on its own schedule; the clock takes the most
 * recent one at each tick. {@link sampleEmitter} fires on that clock, which is
 * what the view feeds the graph from — not the frame loop.
 */

import {
  BooleanProperty,
  DerivedProperty,
  Emitter,
  NumberProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import {
  DEFAULT_SAMPLE_RATE_HZ,
  MAX_RECORD_DURATION_S,
  MAX_RECORDED_SAMPLES,
  SAMPLE_RATE_CHOICES_HZ,
  VOLTAGE_RECORDER_MODEL_SETTINGS,
} from "../../VoltageSensorConstants.js";
import VoltageSensorNamespace from "../../VoltageSensorNamespace.js";
import { RunState, type RunStateValue } from "./RunState.js";
import { Trace } from "./Trace.js";
import type { TVoltageSource } from "./VoltageSource.js";

/**
 * A dt larger than this is a tab that was backgrounded, not a slow frame.
 * Clamping stops the accumulator from firing hundreds of catch-up samples that
 * would all repeat the same reading.
 */
const MAXIMUM_DT_S: number = VOLTAGE_RECORDER_MODEL_SETTINGS.MAXIMUM_DT_S;

/**
 * Slack for the accumulator comparison. A whole number of period-sized ticks does
 * not sum to a whole number in binary, and without this the loop would
 * occasionally hold a sample back for one extra frame.
 */
const TIME_EPSILON_S: number = VOLTAGE_RECORDER_MODEL_SETTINGS.TIME_EPSILON_S;

/** Samples a run at this rate may hold: the duration cap or the sample cap, whichever bites first. */
export function maximumSamplesForRate(sampleRateHz: number): number {
  return Math.min(Math.round(MAX_RECORD_DURATION_S * sampleRateHz), MAX_RECORDED_SAMPLES);
}

export class VoltageRecorderModel implements TModel {
  public readonly source: TVoltageSource;

  public readonly runStateProperty: Property<RunStateValue>;

  /** Seconds elapsed in the current recording, in exact sample-period steps. */
  public readonly timeProperty: NumberProperty;

  /**
   * How many samples a second the next recording takes, in hertz. Takes effect
   * at the next Record — changing it mid-recording would make sample times,
   * which are `index × period`, disagree with the samples already taken.
   */
  public readonly sampleRateProperty: NumberProperty;

  /**
   * The voltage as of the most recent sample, which is what the graph plots.
   * While idle it mirrors the sensor, so the readout is live before Record;
   * while recording the fixed clock writes it, so the value the graph samples
   * is exactly the one that went into the trace.
   */
  public readonly voltageProperty: NumberProperty;

  /**
   * Fires once per recorded sample, on the fixed clock. The view adds a point to
   * the graph from this rather than from step().
   */
  public readonly sampleEmitter: Emitter;

  /** Toggled whenever the trace changed, so the view can redraw only when needed. */
  public readonly traceChangedProperty: BooleanProperty;

  /** Whether recording can begin right now. */
  public readonly canRecordProperty: TReadOnlyProperty<boolean>;

  /**
   * True from Record until the source has a reading taken for this run. The
   * clock does not start until then, so t = 0 is a real measurement.
   */
  public readonly awaitingFirstReadingProperty: TReadOnlyProperty<boolean>;
  private readonly awaitingProperty: BooleanProperty;

  private readonly trace: Trace;

  /** Leftover time not yet consumed by a whole sample period. */
  private timeAccumulator = 0;

  /** The period the current recording is being taken at, captured at Record. */
  private samplePeriod = 1 / DEFAULT_SAMPLE_RATE_HZ;

  /** Samples the current recording may hold before it stops itself. */
  private maximumSamples = maximumSamplesForRate(DEFAULT_SAMPLE_RATE_HZ);

  /** How many samples the current recording holds. Integer, never derived from a float. */
  private sampleIndex = 0;

  private readonly sourceVoltageListener: (voltage: number) => void;
  private readonly sourceAvailabilityListener: (available: boolean) => void;

  /** Guards against a second dispose(); axon Properties throw if disposed twice. */
  private isDisposed = false;

  /**
   * @param source - shared with the rest of the sim and owned by it; this model
   *   listens to it but never disposes it.
   */
  public constructor(source: TVoltageSource) {
    this.source = source;
    this.trace = new Trace();

    this.runStateProperty = new Property<RunStateValue>(RunState.READY);
    this.timeProperty = new NumberProperty(0, { units: "s" });
    this.sampleRateProperty = new NumberProperty(DEFAULT_SAMPLE_RATE_HZ, {
      units: "Hz",
      validValues: [...SAMPLE_RATE_CHOICES_HZ],
    });
    this.voltageProperty = new NumberProperty(source.voltageProperty.value, { units: "V" });
    this.sampleEmitter = new Emitter();
    this.traceChangedProperty = new BooleanProperty(false);
    this.awaitingProperty = new BooleanProperty(false);
    this.awaitingFirstReadingProperty = this.awaitingProperty;

    this.canRecordProperty = new DerivedProperty(
      [this.runStateProperty, source.isAvailableProperty],
      (state, available) => available && state !== RunState.RECORDING,
    );

    this.sourceVoltageListener = (voltage: number) => {
      if (this.runStateProperty.value !== RunState.RECORDING || this.awaitingProperty.value) {
        this.voltageProperty.value = voltage;
      }
    };
    source.voltageProperty.link(this.sourceVoltageListener);

    // A sensor that disconnects mid-recording would otherwise leave the clock
    // sampling its last reading — a flat line that reads as a steady voltage.
    // The trace up to the loss is real, so it stands; nothing after it is.
    this.sourceAvailabilityListener = (available: boolean) => {
      if (!available) {
        this.stopRecording();
      }
    };
    source.isAvailableProperty.lazyLink(this.sourceAvailabilityListener);
  }

  /** Recorded sample times, in seconds. */
  public getTimeSeries(): readonly number[] {
    return this.trace.getTimes();
  }

  /** Recorded voltages, in volts, index-aligned with {@link getTimeSeries}. */
  public getVoltageSeries(): readonly number[] {
    return this.trace.getVoltages();
  }

  public get sampleCount(): number {
    return this.trace.length;
  }

  /** Begins recording. No effect unless the source is available. */
  public startRecording(): void {
    if (!this.canRecordProperty.value) {
      return;
    }
    this.resetRecording();
    this.source.beginRun();

    // t = 0 is a real sample, taken at the first reading after Record. Set
    // before the run state, so anything listening for RECORDING already sees
    // whether it is waiting.
    this.awaitingProperty.value = true;
    this.runStateProperty.value = RunState.RECORDING;
    this.recordFirstSampleIfReady();
  }

  /**
   * Ends recording. The trace stands — unless there is none, because the source
   * never gave a first reading, in which case the run returns to READY.
   */
  public stopRecording(): void {
    if (this.runStateProperty.value !== RunState.RECORDING) {
      return;
    }
    this.source.endRun();
    this.awaitingProperty.value = false;
    this.runStateProperty.value = this.trace.isEmpty ? RunState.READY : RunState.STOPPED;
    this.voltageProperty.value = this.source.voltageProperty.value;
    this.traceChangedProperty.value = !this.traceChangedProperty.value;
  }

  /** Discards the trace and returns to READY. */
  public clearRun(): void {
    this.resetRecording();
    this.runStateProperty.value = RunState.READY;
    this.voltageProperty.value = this.source.voltageProperty.value;
  }

  public step(dt: number): void {
    if (this.runStateProperty.value !== RunState.RECORDING) {
      return;
    }

    // The clock starts at the first reading; until then there is no time to keep.
    if (this.awaitingProperty.value) {
      this.recordFirstSampleIfReady();
      return;
    }

    // Fixed-timestep sampling: consume whole sample periods, keep the remainder.
    this.timeAccumulator += Math.min(dt, MAXIMUM_DT_S);
    let recorded = false;

    while (
      this.timeAccumulator >= this.samplePeriod - TIME_EPSILON_S &&
      this.runStateProperty.value === RunState.RECORDING
    ) {
      this.timeAccumulator -= this.samplePeriod;
      this.recordSample();
      recorded = true;

      // A recording left running all lesson would grow without bound and outrun
      // the graph's own buffer. Stopping is better than silently dropping the
      // beginning of what the student was watching.
      if (this.sampleIndex >= this.maximumSamples) {
        this.stopRecording();
      }
    }

    if (recorded) {
      this.traceChangedProperty.value = !this.traceChangedProperty.value;
    }
  }

  /** Takes the t = 0 sample once the source has a reading for this run. */
  private recordFirstSampleIfReady(): void {
    if (this.awaitingProperty.value && this.source.hasFreshReading()) {
      this.awaitingProperty.value = false;
      this.recordSample();
      this.traceChangedProperty.value = !this.traceChangedProperty.value;
    }
  }

  /** Takes one sample at the current index. Its time comes from the index. */
  private recordSample(): void {
    const time = this.sampleIndex * this.samplePeriod;
    const voltage = this.source.voltageProperty.value;
    this.trace.add(time, voltage);
    this.sampleIndex += 1;

    this.timeProperty.value = time;
    this.voltageProperty.value = voltage;

    this.sampleEmitter.emit();
  }

  /**
   * Empties the trace and restarts the clock, leaving the run state alone. The
   * chosen sample rate is picked up here, which is what makes it take effect at
   * the next Record rather than in the middle of a run.
   */
  private resetRecording(): void {
    this.awaitingProperty.value = false;
    const sampleRate = this.sampleRateProperty.value;
    this.samplePeriod = 1 / sampleRate;
    this.maximumSamples = maximumSamplesForRate(sampleRate);
    this.trace.clear();
    this.timeProperty.value = 0;
    this.timeAccumulator = 0;
    this.sampleIndex = 0;
    this.traceChangedProperty.value = !this.traceChangedProperty.value;
  }

  public reset(): void {
    this.sampleRateProperty.reset();
    this.clearRun();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    this.stopRecording();
    this.source.voltageProperty.unlink(this.sourceVoltageListener);
    this.source.isAvailableProperty.unlink(this.sourceAvailabilityListener);
    this.canRecordProperty.dispose();
    this.runStateProperty.dispose();
    this.timeProperty.dispose();
    this.sampleRateProperty.dispose();
    this.voltageProperty.dispose();
    this.sampleEmitter.dispose();
    this.traceChangedProperty.dispose();
    this.awaitingProperty.dispose();
  }
}

VoltageSensorNamespace.register("VoltageRecorderModel", VoltageRecorderModel);
