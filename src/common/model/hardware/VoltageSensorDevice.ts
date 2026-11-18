/**
 * VoltageSensorDevice.ts
 *
 * What `SensorVoltageSource` needs from a PS-3211, independent of how it is
 * reached. Web Bluetooth and WebUSB carry the same PASCO packets — see
 * doc/implementation-notes.md — so the difference stops at this interface and
 * never reaches the model or the view.
 */

/** Thrown when the user dismisses the browser's device picker. Not a failure. */
export class DeviceSelectionCancelled extends Error {}

/**
 * Thrown when the device answered a command and refused it, as opposed to not
 * answering at all. Carries the device's status byte.
 */
export class CommandRefused extends Error {
  public readonly status: number;

  public constructor(description: string, status: number) {
    super(`Voltage sensor refused the ${description} (status 0x${status.toString(16).padStart(2, "0")})`);
    this.status = status;
  }
}

export interface TVoltageSensorDevice {
  readonly isConnected: boolean;

  /** Advertised name, or null before a connection exists. */
  readonly name: string | null;

  /**
   * Transport-specific detail for `?showDiagnostics=true`, or undefined when
   * the transport has nothing to add beyond the decoded reading.
   */
  readonly diagnosticText?: string;

  /** Opens the picker and connects. Must reach the picker before any `await`. */
  connect(): Promise<void>;

  disconnect(): Promise<void>;

  /** One RawVoltage sample: the unsigned 16-bit count, before calibration. */
  readRawSample(): Promise<number>;

  /** Sends SET_RANGE with the datasheet's range value; rejects if refused or unanswered. */
  setRange(value: number): Promise<void>;

  /** Reconfigures the device's periodic sampler. Does not affect single reads. */
  setSamplePeriod(periodMicroseconds: number): Promise<void>;

  /**
   * Puts the device on its own clock, calling back with each sample it pushes,
   * so the host stops paying a round trip per reading. Present only on
   * transports that can carry the stream; callers fall back to `readRawSample`.
   */
  startStreaming?(periodMilliseconds: number, onSample: (rawCount: number) => void): Promise<void>;

  stopStreaming?(): Promise<void>;
}
