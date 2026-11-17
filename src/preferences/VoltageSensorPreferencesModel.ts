/**
 * VoltageSensorPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in voltageSensorQueryParameters.
 */

import { BooleanProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import VoltageSensorNamespace from "../VoltageSensorNamespace.js";
import voltageSensorQueryParameters from "./voltageSensorQueryParameters.js";

export class VoltageSensorPreferencesModel {
  /** Whether to show raw sensor readings on both screens. */
  public readonly showDiagnosticsProperty: BooleanProperty;

  public constructor(tandem?: Tandem) {
    this.showDiagnosticsProperty = new BooleanProperty(
      voltageSensorQueryParameters.showDiagnostics,
      tandem ? { tandem: tandem.createTandem("showDiagnosticsProperty") } : undefined,
    );
  }

  public reset(): void {
    this.showDiagnosticsProperty.reset();
  }
}

VoltageSensorNamespace.register("VoltageSensorPreferencesModel", VoltageSensorPreferencesModel);
