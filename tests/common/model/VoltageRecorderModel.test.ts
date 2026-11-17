/**
 * The recorder's clock, lifecycle and trace, against a fake source.
 */

import { BooleanProperty, NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { beforeEach, describe, expect, it } from "vitest";
import { RunState } from "../../../src/common/model/RunState.js";
import { maximumSamplesForRate, VoltageRecorderModel } from "../../../src/common/model/VoltageRecorderModel.js";
import type { TVoltageSource } from "../../../src/common/model/VoltageSource.js";
import {
  DEFAULT_SAMPLE_RATE_HZ,
  MAX_RECORD_DURATION_S,
  MAX_RECORDED_SAMPLES,
  SAMPLE_RATE_CHOICES_HZ,
} from "../../../src/VoltageSensorConstants.js";

const DEFAULT_PERIOD_S = 1 / DEFAULT_SAMPLE_RATE_HZ;

/**
 * Stands in for the PASCO link: always sampling while available, and current
 * for a run only once a reading arrives after {@link beginRun} — which a test
 * delivers with {@link deliver}.
 */
class FakeSource implements TVoltageSource {
  public readonly sensorVoltageProperty = new NumberProperty(0);
  public readonly availableProperty = new BooleanProperty(true);
  public runsBegun = 0;
  public runsEnded = 0;
  private fresh = false;

  public get voltageProperty(): TReadOnlyProperty<number> {
    return this.sensorVoltageProperty;
  }

  public get isAvailableProperty(): TReadOnlyProperty<boolean> {
    return this.availableProperty;
  }

  public beginRun(): void {
    this.runsBegun += 1;
    this.fresh = false;
  }

  public endRun(): void {
    this.runsEnded += 1;
  }

  public hasFreshReading(): boolean {
    return this.fresh;
  }

  /** A reading from the device. */
  public deliver(volts: number): void {
    this.sensorVoltageProperty.value = volts;
    this.fresh = true;
  }

  public dispose(): void {
    this.sensorVoltageProperty.dispose();
    this.availableProperty.dispose();
  }
}

/**
 * Steps the model through `seconds`, `period` at a time — split into frames no
 * longer than 50 ms, since a longer one is clamped as a backgrounded tab.
 */
function advance(model: VoltageRecorderModel, seconds: number, period = DEFAULT_PERIOD_S): void {
  const framesPerPeriod = Math.ceil(period / 0.05);
  const ticks = Math.round(seconds / period);
  for (let i = 0; i < ticks; i++) {
    for (let frame = 0; frame < framesPerPeriod; frame++) {
      model.step(period / framesPerPeriod);
    }
  }
}

/** Starts a recording and delivers the reading its t = 0 waits for. */
function startWithReading(model: VoltageRecorderModel, source: FakeSource, volts = 1): void {
  model.startRecording();
  source.deliver(volts);
  model.step(0);
}

describe("VoltageRecorderModel", () => {
  let source: FakeSource;
  let model: VoltageRecorderModel;

  beforeEach(() => {
    source = new FakeSource();
    model = new VoltageRecorderModel(source);
  });

  it("starts ready, with nothing recorded", () => {
    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.sampleCount).toBe(0);
    expect(model.timeProperty.value).toBe(0);
    expect(model.sampleRateProperty.value).toBe(DEFAULT_SAMPLE_RATE_HZ);
  });

  it("records from the first reading after Record until Stop", () => {
    startWithReading(model, source);
    expect(model.runStateProperty.value).toBe(RunState.RECORDING);
    expect(source.runsBegun).toBe(1);

    // t = 0 is a real sample, so one second of ticks leaves rate + 1 samples.
    advance(model, 1);
    expect(model.sampleCount).toBe(DEFAULT_SAMPLE_RATE_HZ + 1);

    model.stopRecording();
    expect(model.runStateProperty.value).toBe(RunState.STOPPED);
    expect(source.runsEnded).toBe(1);

    // Stepping past the end adds nothing.
    advance(model, 1);
    expect(model.sampleCount).toBe(DEFAULT_SAMPLE_RATE_HZ + 1);
  });

  it("records the voltage the source reads at each tick", () => {
    startWithReading(model, source, 0.5);
    source.deliver(1.25);
    advance(model, DEFAULT_PERIOD_S);
    source.deliver(-2);
    advance(model, DEFAULT_PERIOD_S);
    expect(model.getVoltageSeries()).toEqual([0.5, 1.25, -2]);
    expect(model.voltageProperty.value).toBe(-2);
  });

  it("puts sample times on exact multiples of the period, whatever the frame times were", () => {
    startWithReading(model, source);
    // Uneven frames that add up to one second.
    for (const dt of [0.016, 0.017, 0.033, 0.05, 0.1, 0.2, 0.084, 0.25, 0.25]) {
      model.step(dt);
    }
    const times = model.getTimeSeries();
    times.forEach((time, index) => {
      expect(time).toBe(index * DEFAULT_PERIOD_S);
    });
  });

  it("clamps a huge dt instead of firing a burst of catch-up samples", () => {
    startWithReading(model, source);
    model.step(30);
    expect(model.sampleCount).toBeLessThanOrEqual(Math.ceil(0.25 / DEFAULT_PERIOD_S) + 1);
  });

  it("waits for the run's first reading before starting the clock", () => {
    model.startRecording();
    expect(model.awaitingFirstReadingProperty.value).toBe(true);
    advance(model, 1);
    expect(model.sampleCount).toBe(0);
    expect(model.timeProperty.value).toBe(0);

    source.deliver(3);
    model.step(0);
    expect(model.awaitingFirstReadingProperty.value).toBe(false);
    expect(model.getVoltageSeries()).toEqual([3]);
  });

  it("returns to READY when Stop is pressed before any reading arrived", () => {
    model.startRecording();
    model.stopRecording();
    expect(model.runStateProperty.value).toBe(RunState.READY);
  });

  it("emits once per recorded sample", () => {
    let emitted = 0;
    model.sampleEmitter.addListener(() => {
      emitted += 1;
    });
    startWithReading(model, source);
    advance(model, 0.5);
    expect(emitted).toBe(model.sampleCount);
  });

  it("tracks the source while idle, so the readout is live before Record", () => {
    source.deliver(4.2);
    expect(model.voltageProperty.value).toBe(4.2);
  });

  it("ignores Record while already recording, so a stray press cannot lose the trace", () => {
    startWithReading(model, source);
    advance(model, 0.5);
    const before = model.sampleCount;
    model.startRecording();
    expect(model.sampleCount).toBe(before);
  });

  it("cannot record without a sensor", () => {
    source.availableProperty.value = false;
    model.startRecording();
    expect(model.runStateProperty.value).toBe(RunState.READY);
  });

  it("stops recording when the sensor goes away, keeping what was recorded", () => {
    startWithReading(model, source);
    advance(model, 0.5);
    const recorded = model.sampleCount;
    source.availableProperty.value = false;
    expect(model.runStateProperty.value).toBe(RunState.STOPPED);
    advance(model, 0.5);
    expect(model.sampleCount).toBe(recorded);
  });

  it("clears the trace and the clock", () => {
    startWithReading(model, source);
    advance(model, 1);
    model.stopRecording();
    model.clearRun();
    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.sampleCount).toBe(0);
    expect(model.timeProperty.value).toBe(0);
  });

  it("recording again after a stop discards the first trace", () => {
    startWithReading(model, source);
    advance(model, 1);
    model.stopRecording();
    startWithReading(model, source);
    expect(model.sampleCount).toBe(1);
  });

  describe("recording rate", () => {
    it("records at whichever rate was chosen, with times on exact multiples", () => {
      for (const rate of SAMPLE_RATE_CHOICES_HZ) {
        model.clearRun();
        model.sampleRateProperty.value = rate;
        startWithReading(model, source);
        advance(model, 2, 1 / rate);
        model.stopRecording();
        expect(model.sampleCount).toBe(2 * rate + 1);
        model.getTimeSeries().forEach((time, index) => {
          expect(time).toBeCloseTo(index / rate, 12);
        });
      }
    });

    it("holds a rate change until the next recording, so one trace has one spacing", () => {
      startWithReading(model, source);
      model.sampleRateProperty.value = 50;
      advance(model, 1);
      expect(model.sampleCount).toBe(DEFAULT_SAMPLE_RATE_HZ + 1);
    });

    it("caps a recording by duration at slow rates and by sample count at fast ones", () => {
      expect(maximumSamplesForRate(1)).toBe(MAX_RECORD_DURATION_S);
      expect(maximumSamplesForRate(50)).toBe(MAX_RECORDED_SAMPLES);

      model.sampleRateProperty.value = 50;
      startWithReading(model, source);
      advance(model, MAX_RECORDED_SAMPLES / 50 + 5, 1 / 50);
      expect(model.runStateProperty.value).toBe(RunState.STOPPED);
      expect(model.sampleCount).toBe(MAX_RECORDED_SAMPLES);
    });

    it("puts the rate back to the default on reset", () => {
      model.sampleRateProperty.value = 2;
      model.reset();
      expect(model.sampleRateProperty.value).toBe(DEFAULT_SAMPLE_RATE_HZ);
    });
  });

  it("survives being disposed twice", () => {
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it("ends the run on the source if disposed mid-recording", () => {
    startWithReading(model, source);
    model.dispose();
    expect(source.runsEnded).toBe(1);
  });
});
