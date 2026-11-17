/**
 * RecorderModel.ts
 *
 * The Voltage vs Time screen's model: {@link VoltageRecorderModel} with its
 * clock driven from the global `stepTimer` instead of from Joist.
 *
 * Joist steps only the model of the screen being shown. A student who presses
 * Record and then glances at the Meter screen would otherwise freeze the
 * recording's clock while the sensor kept reading, and come back to a trace
 * with a gap of real time missing from it. `stepTimer` ticks whichever screen
 * is showing, so the recording carries on.
 */

import { stepTimer } from "scenerystack/axon";
import type { SensorVoltageSource } from "../../common/model/SensorVoltageSource.js";
import { VoltageRecorderModel } from "../../common/model/VoltageRecorderModel.js";

export class RecorderModel extends VoltageRecorderModel {
  /** Kept as a concrete type so the view can show the connection and options panels. */
  public readonly sensorSource: SensorVoltageSource;

  private readonly clockListener: (dt: number) => void;

  public constructor(source: SensorVoltageSource) {
    super(source);
    this.sensorSource = source;
    this.clockListener = (dt: number) => super.step(dt);
    stepTimer.addListener(this.clockListener);
  }

  /** Joist's per-screen step is ignored; see the class comment. */
  public override step(_dt: number): void {
    // intentionally empty — the clock runs from stepTimer
  }

  public override dispose(): void {
    if (stepTimer.hasListener(this.clockListener)) {
      stepTimer.removeListener(this.clockListener);
    }
    super.dispose();
  }
}
