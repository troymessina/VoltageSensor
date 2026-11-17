/**
 * MeterModel.ts
 *
 * The Meter screen's model. A voltmeter keeps no state of its own — it shows
 * what the sensor reads now — so this only hands the shared source to the view.
 * The source is owned by the sim, not by this model, and is not disposed here.
 */

import type { TModel } from "scenerystack/joist";
import type { SensorVoltageSource } from "../../common/model/SensorVoltageSource.js";

export class MeterModel implements TModel {
  public readonly sensorSource: SensorVoltageSource;

  public constructor(source: SensorVoltageSource) {
    this.sensorSource = source;
  }

  /** Nothing to reset: the sensor's settings are reset by the view's Reset All. */
  public reset(): void {
    // intentionally empty
  }
}
