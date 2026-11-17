/**
 * VoltageSource.ts
 *
 * The seam between the recorder model and wherever voltage comes from. A source
 * answers one question — what is the voltage right now — and the recorder
 * samples that answer on its own fixed clock. In the app the only source is the
 * PASCO sensor ({@link SensorVoltageSource}); tests substitute a writable fake.
 *
 * ── Why "latest value", not a running total ───────────────────────────────────
 * Voltage is a continuous signal that is sampled, not accumulated, so the
 * contract is that the source publishes its most recent reading and the model
 * decides when to look. (RadioactivityAndStatistics counts events, and so
 * exposes a monotonically increasing total instead; that trick does not apply.)
 */

import type { TReadOnlyProperty } from "scenerystack/axon";

export type TVoltageSource = {
  /** Most recent reading, in volts, after the student's adjustments. */
  readonly voltageProperty: TReadOnlyProperty<number>;

  /**
   * Whether the source can currently supply readings — for the sensor, while it
   * is connected. A recording cannot start unless this is true.
   */
  readonly isAvailableProperty: TReadOnlyProperty<boolean>;

  /**
   * Called when a recording starts. The source forgets that it has a current
   * reading, so the recording's t = 0 waits for one taken after Record was
   * pressed, and arms zero-at-start if the student asked for it.
   */
  beginRun(): void;

  /** Called when that recording ends, however it ends. */
  endRun(): void;

  /**
   * Whether {@link voltageProperty} holds a reading taken since the last
   * {@link beginRun}.
   */
  hasFreshReading(): boolean;
};
