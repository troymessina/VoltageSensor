/**
 * The student's adjustments to a reading.
 *
 * These are the numbers a student changes when they press Zero Sensor Now or
 * Change Sign, and they are the part of the sensor path that can be exercised
 * without a PS-3211 on the desk — which is exactly why they are pure.
 */

import { describe, expect, it } from "vitest";
import { adjustReading } from "../../../src/common/model/voltageMeasurement.js";

describe("adjustReading", () => {
  it("leaves a reading alone with no adjustments", () => {
    expect(adjustReading(1.5, { zeroOffsetV: 0, changeSign: false })).toBe(1.5);
  });

  it("subtracts the zero offset", () => {
    expect(adjustReading(1.5, { zeroOffsetV: 0.5, changeSign: false })).toBeCloseTo(1, 12);
  });

  it("negates, like swapping the leads", () => {
    expect(adjustReading(1.5, { zeroOffsetV: 0, changeSign: true })).toBe(-1.5);
  });

  it("zeroes before it negates, so a zeroed reading still reads zero after the flip", () => {
    expect(adjustReading(1.2, { zeroOffsetV: 1.2, changeSign: true })).toBeCloseTo(0, 12);
    expect(adjustReading(2, { zeroOffsetV: 1.2, changeSign: true })).toBeCloseTo(-0.8, 12);
  });
});
