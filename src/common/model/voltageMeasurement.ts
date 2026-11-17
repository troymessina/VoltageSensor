/**
 * voltageMeasurement.ts
 *
 * The arithmetic between "the device answered" and "this is the voltage the
 * student sees": the two adjustments a student can make to a calibrated
 * reading. (Calibration itself is `rawCountToVolts` in the protocol module.)
 *
 * Pure and free of SceneryStack imports, for the reason the rest of the sensor
 * path is: nothing above the transport can be exercised in CI with real
 * hardware, so everything that can be tested without it is kept where it can be.
 */

/** The student's adjustments to a calibrated voltage. */
export type MeasurementAdjustments = {
  /** Voltage subtracted from the reading, in volts. */
  readonly zeroOffsetV: number;
  /** Whether to negate what is left — the same as swapping the two leads. */
  readonly changeSign: boolean;
};

/**
 * Applies the zero offset and then the sign, in that order.
 *
 * Order matters and this one matches PASCO's: the offset is a point on the
 * device's own axis, so it is subtracted before the axis is reversed. Zeroing at
 * 1.2 V and then flipping the sign still reads zero there.
 */
export function adjustReading(volts: number, adjustments: MeasurementAdjustments): number {
  const zeroed = volts - adjustments.zeroOffsetV;
  return adjustments.changeSign ? -zeroed : zeroed;
}
