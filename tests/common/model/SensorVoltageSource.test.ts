/**
 * The sensor source against a fake device: sampling for as long as it is
 * connected, the range command, the student's adjustments, and a stream that
 * goes quiet.
 *
 * The transports themselves are tested on their own; these tests replace the
 * USB one with a device whose stream is driven by hand, which is the only way
 * to make a stream go quiet on cue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState } from "../../../src/common/model/ConnectionState.js";
import { RAW_ZERO_COUNT, VoltageRange } from "../../../src/common/model/hardware/PascoVoltageProtocol.js";
import { SensorTransport, SensorVoltageSource } from "../../../src/common/model/SensorVoltageSource.js";

/** The raw count the device would report for `volts` on a range of ±`fullScale`. */
function voltsToRaw(volts: number, fullScale = 5): number {
  return Math.round(RAW_ZERO_COUNT + (volts / fullScale) * RAW_ZERO_COUNT);
}

// Hoisted with the mock below, which runs before this file's own top level.
const { FakeStreamingDevice } = vi.hoisted(() => {
  /** Enough of a PS-3211 to stream on command. */
  class FakeDevice {
    public static latest: FakeDevice | null = null;

    public isConnected = false;
    public readonly name = "Voltage 123-456";
    public onSample: ((rawCount: number) => void) | null = null;
    public readonly rawCounts: number[] = [];
    public readonly rangesSent: number[] = [];
    public refuseRange = false;

    public constructor() {
      FakeDevice.latest = this;
    }

    public connect(): Promise<void> {
      this.isConnected = true;
      return Promise.resolve();
    }

    public disconnect(): Promise<void> {
      this.isConnected = false;
      return Promise.resolve();
    }

    public readRawSample(): Promise<number> {
      const next = this.rawCounts.shift();
      return next === undefined ? Promise.reject(new Error("no reading")) : Promise.resolve(next);
    }

    public setRange(range: number): Promise<void> {
      this.rangesSent.push(range);
      return this.refuseRange ? Promise.reject(new Error("refused")) : Promise.resolve();
    }

    public setSamplePeriod(): Promise<void> {
      return Promise.resolve();
    }

    public startStreaming(_periodMs: number, onSample: (rawCount: number) => void): Promise<void> {
      this.onSample = onSample;
      return Promise.resolve();
    }

    public stopStreaming(): Promise<void> {
      this.onSample = null;
      return Promise.resolve();
    }

    /** Pushes one raw count, as the device would on its own clock. */
    public pushRaw(rawCount: number): void {
      this.onSample?.(rawCount);
    }
  }

  return { FakeStreamingDevice: FakeDevice };
});

type FakeStreamingDevice = InstanceType<typeof FakeStreamingDevice>;

vi.mock("../../../src/common/model/hardware/UsbVoltageSensor.js", () => ({
  UsbVoltageSensor: FakeStreamingDevice,
}));

async function connectedSource(): Promise<{ source: SensorVoltageSource; device: FakeStreamingDevice }> {
  const source = new SensorVoltageSource();
  await source.connect(SensorTransport.USB);
  const device = FakeStreamingDevice.latest;
  if (device === null) {
    throw new Error("no device constructed");
  }
  return { source, device };
}

describe("SensorVoltageSource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    FakeStreamingDevice.latest = null;
  });

  describe("connecting", () => {
    it("samples as soon as it is connected, without a recording asking", async () => {
      const { source, device } = await connectedSource();
      expect(source.isAvailableProperty.value).toBe(true);
      expect(source.hasReadingProperty.value).toBe(false);

      device.pushRaw(voltsToRaw(1.5));

      expect(source.voltageProperty.value).toBeCloseTo(1.5, 3);
      expect(source.hasReadingProperty.value).toBe(true);
      source.dispose();
    });

    it("tells the device its range before the first sample", async () => {
      const { source, device } = await connectedSource();
      expect(device.rangesSent).toEqual([VoltageRange.PLUS_MINUS_5V]);
      expect(source.rangeCommandFailedProperty.value).toBe(false);
      source.dispose();
    });

    it("says so when the device refuses the range, but still reads", async () => {
      const source = new SensorVoltageSource();
      const connecting = source.connect(SensorTransport.USB);
      const device = FakeStreamingDevice.latest as FakeStreamingDevice;
      device.refuseRange = true;
      await connecting;

      expect(source.rangeCommandFailedProperty.value).toBe(true);
      expect(source.isAvailableProperty.value).toBe(true);
      device.pushRaw(voltsToRaw(2));
      expect(source.voltageProperty.value).toBeCloseTo(2, 3);
      source.dispose();
    });

    it("forgets the reading on disconnect, so the meter cannot show a stale one", async () => {
      const { source, device } = await connectedSource();
      device.pushRaw(voltsToRaw(3));
      await source.disconnect();
      expect(source.hasReadingProperty.value).toBe(false);
      expect(source.isAvailableProperty.value).toBe(false);
      expect(source.connectionStateProperty.value).toBe(ConnectionState.DISCONNECTED);
      source.dispose();
    });
  });

  describe("the range", () => {
    it("re-sends the range and recalibrates the last reading when it changes", async () => {
      const { source, device } = await connectedSource();
      const raw = voltsToRaw(3, 5);
      device.pushRaw(raw);
      expect(source.voltageProperty.value).toBeCloseTo(3, 3);

      source.rangeProperty.value = VoltageRange.PLUS_MINUS_30V;
      // The same raw count means six times the voltage on the ±30 V range.
      expect(source.voltageProperty.value).toBeCloseTo(18, 2);

      await vi.advanceTimersByTimeAsync(0);
      expect(device.rangesSent).toEqual([VoltageRange.PLUS_MINUS_5V, VoltageRange.PLUS_MINUS_30V]);
      // Sampling resumed after the command.
      expect(device.onSample).not.toBeNull();
      source.dispose();
    });
  });

  describe("over range", () => {
    it("flags a reading pinned at the end of the scale, and clears when it comes back", async () => {
      const { source, device } = await connectedSource();
      device.pushRaw(65535); // 9 V on the ±5 V range
      expect(source.overRangeProperty.value).toBe(true);
      device.pushRaw(voltsToRaw(4.5));
      expect(source.overRangeProperty.value).toBe(false);
      device.pushRaw(0);
      expect(source.overRangeProperty.value).toBe(true);
      await source.disconnect();
      expect(source.overRangeProperty.value).toBe(false);
      source.dispose();
    });
  });

  describe("adjustments", () => {
    it("zeroes on the current reading and removes the zero again", async () => {
      const { source, device } = await connectedSource();
      device.pushRaw(voltsToRaw(1.2));
      source.zeroNow();
      expect(source.zeroOffsetProperty.value).toBeCloseTo(1.2, 3);
      expect(source.voltageProperty.value).toBeCloseTo(0, 3);

      device.pushRaw(voltsToRaw(1.7));
      expect(source.voltageProperty.value).toBeCloseTo(0.5, 3);

      source.removeZeroOffset();
      expect(source.voltageProperty.value).toBeCloseTo(1.7, 3);
      source.dispose();
    });

    it("changes the sign at once, without waiting for the next sample", async () => {
      const { source, device } = await connectedSource();
      device.pushRaw(voltsToRaw(2.5));
      source.changeSignProperty.value = true;
      expect(source.voltageProperty.value).toBeCloseTo(-2.5, 3);
      source.dispose();
    });

    it("zeroes at start on the run's first reading, not on a republished stale one", async () => {
      const { source, device } = await connectedSource();
      device.pushRaw(voltsToRaw(1.8)); // before Record

      source.zeroAtStartProperty.value = true;
      source.beginRun();
      expect(source.runInProgressProperty.value).toBe(true);
      // An adjustment while the run waits for its first reading republishes
      // the stale 1.8 V; it must not be taken as this run's zero.
      source.changeSignProperty.value = true;
      expect(source.zeroOffsetProperty.value).toBe(0);
      expect(source.hasFreshReading()).toBe(false);

      device.pushRaw(voltsToRaw(0.6));

      expect(source.zeroOffsetProperty.value).toBeCloseTo(0.6, 3);
      expect(source.voltageProperty.value).toBeCloseTo(0, 3);
      expect(source.hasFreshReading()).toBe(true);

      source.endRun();
      expect(source.runInProgressProperty.value).toBe(false);
      source.dispose();
    });

    it("keeps the student's settings but not the connection on reset", async () => {
      const { source } = await connectedSource();
      source.changeSignProperty.value = true;
      source.rangeProperty.value = VoltageRange.PLUS_MINUS_30V;
      source.reset();
      expect(source.changeSignProperty.value).toBe(false);
      expect(source.rangeProperty.value).toBe(VoltageRange.PLUS_MINUS_5V);
      expect(source.isAvailableProperty.value).toBe(true);
      source.dispose();
    });
  });

  describe("a stream that goes quiet", () => {
    it("gives up on the link once samples stop arriving", async () => {
      const { source, device } = await connectedSource();
      for (let i = 0; i < 20; i++) {
        device.pushRaw(voltsToRaw(1));
        vi.advanceTimersByTime(20);
      }
      expect(source.isAvailableProperty.value).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(source.isAvailableProperty.value).toBe(false);
      expect(source.hasReadingProperty.value).toBe(false);
      expect(source.connectionStateProperty.value).toBe(ConnectionState.ERROR);
      expect(device.onSample).toBeNull();
      source.dispose();
    });

    it("does not end a stream that keeps arriving, however long it runs", async () => {
      const { source, device } = await connectedSource();
      for (let i = 0; i < 500; i++) {
        device.pushRaw(voltsToRaw(1));
        vi.advanceTimersByTime(20);
      }
      expect(source.isAvailableProperty.value).toBe(true);
      source.dispose();
    });

    it("falls back to polling when the stream never starts", async () => {
      const { source, device } = await connectedSource();
      for (let i = 0; i < 10; i++) {
        device.rawCounts.push(voltsToRaw(-4.5));
      }

      await vi.advanceTimersByTimeAsync(1100);

      expect(source.isAvailableProperty.value).toBe(true);
      expect(source.voltageProperty.value).toBeCloseTo(-4.5, 3);
      source.dispose();
    });
  });

  describe("a probed device", () => {
    it("is connected but never sampled, so it is not offered as a source", async () => {
      const source = new SensorVoltageSource({ usbProbeOnly: true });
      await source.connect(SensorTransport.USB);
      expect(source.connectionStateProperty.value).toBe(ConnectionState.CONNECTED);
      expect(source.isAvailableProperty.value).toBe(false);
      expect(FakeStreamingDevice.latest?.rangesSent).toEqual([]);
      source.dispose();
    });
  });
});
