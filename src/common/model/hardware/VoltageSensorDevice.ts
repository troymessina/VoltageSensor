/**
 * VoltageSensorDevice.ts
 *
 * What `SensorVoltageSource` needs from a PS-3211, independent of how it is
 * reached. Web Bluetooth and WebUSB carry the same PASCO packets — see
 * doc/implementation-notes.md — so the difference stops at this interface and
 * never reaches the model or the view.
 */

import type { VoltageRangeValue } from "./PascoVoltageProtocol.js";

/** Thrown when the user dismisses the browser's device picker. Not a failure. */
export class DeviceSelectionCancelled extends Error {}

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

  setRange(range: VoltageRangeValue): Promise<void>;

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
