/**
 * Fleet-standard memory-leak regression suite (SceneryStackTemplate / QubitSketch pattern).
 *
 * Creates a disposable model object inside a function boundary, disposes it, forces
 * garbage collection via global.gc (--expose-gc in vitest.config.ts), then asserts via
 * WeakRef that the object was collected. V8 requires a function boundary (not merely
 * a block scope) so local strong references die when the helper returns.
 */

import { Property } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { SensorVoltageSource } from "../src/common/model/SensorVoltageSource.js";
import { VoltageRecorderModel } from "../src/common/model/VoltageRecorderModel.js";
import { GraphControlsPanel } from "../src/common/view/graph/GraphControlsPanel.js";
import type { PlottableProperty } from "../src/common/view/graph/PlottableProperty.js";
import { VoltmeterNode } from "../src/common/view/VoltmeterNode.js";
import { MeterModel } from "../src/meter/model/MeterModel.js";
import { MeterScreenSummaryContent } from "../src/meter/view/MeterScreenSummaryContent.js";
import { RecorderModel } from "../src/recorder/model/RecorderModel.js";
import { RecorderScreenSummaryContent } from "../src/recorder/view/RecorderScreenSummaryContent.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

/** The app's one source lives as long as the sim; the models only borrow it. */
const sharedSource = new SensorVoltageSource();

function createAndDisposeModel(): WeakRef<object> {
  const model = new VoltageRecorderModel(sharedSource);
  const ref = new WeakRef<object>(model);
  model.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("VoltageRecorderModel is collected after dispose", async () => {
    const ref = createAndDisposeModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const model = new RecorderModel(sharedSource);
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeModel());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});

const recorderModel = new RecorderModel(sharedSource);
const meterModel = new MeterModel(sharedSource);
const graphPlotA: PlottableProperty = { name: "Time", property: new Property(0), unit: "s" };
const graphPlotB: PlottableProperty = { name: "Voltage", property: new Property(1), unit: "V" };
const graphXProperty = new Property(graphPlotA);
const graphYProperty = new Property(graphPlotB);

describeDisposalLeaks([
  { name: "SensorVoltageSource", create: () => new SensorVoltageSource() },
  {
    name: "RecorderModel",
    create: () => new RecorderModel(sharedSource),
    keepAlive: () => [sharedSource],
  },
  {
    name: "RecorderScreenSummaryContent",
    create: () => new RecorderScreenSummaryContent(recorderModel),
    keepAlive: () => [recorderModel, sharedSource],
  },
  {
    name: "MeterScreenSummaryContent",
    create: () => new MeterScreenSummaryContent(meterModel),
    keepAlive: () => [meterModel, sharedSource],
  },
  {
    name: "VoltmeterNode",
    create: () =>
      new VoltmeterNode({
        voltageProperty: sharedSource.voltageProperty,
        hasReadingProperty: sharedSource.hasReadingProperty,
        rangeProperty: sharedSource.rangeProperty,
      }),
    keepAlive: () => [sharedSource],
  },
  {
    name: "GraphControlsPanel",
    create: () => new GraphControlsPanel([graphPlotA, graphPlotB], graphXProperty, graphYProperty, 300),
    keepAlive: () => [graphXProperty, graphYProperty, graphPlotA.property, graphPlotB.property],
  },
]);
