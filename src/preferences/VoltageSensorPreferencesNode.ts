import { VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS } from "../VoltageSensorConstants.js";
/**
 * VoltageSensorPreferencesNode.ts
 *
 * The Preferences → Simulation tab.
 *
 * One teacher-facing control: raw sensor diagnostics, for hardware bring-up.
 *
 * Note the text colour: the Preferences dialog is always light, whatever colour
 * profile the sim is in, so labels here use `controlSurfaceTextColorProperty`
 * and never `textColorProperty`.
 */

import { Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import { StringManager } from "../i18n/StringManager.js";
import VoltageSensorColors from "../VoltageSensorColors.js";
import VoltageSensorNamespace from "../VoltageSensorNamespace.js";
import type { VoltageSensorPreferencesModel } from "./VoltageSensorPreferencesModel.js";

const LABEL_FONT = new PhetFont(VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS.LABEL_FONT_SIZE);
const CONTENT_WIDTH: number = VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS.CONTENT_WIDTH;

export class VoltageSensorPreferencesNode extends Node {
  public constructor(preferences: VoltageSensorPreferencesModel, tandem?: Tandem) {
    const strings = StringManager.getInstance().getPreferences();

    const diagnosticsCheckbox = new Checkbox(
      preferences.showDiagnosticsProperty,
      new Text(strings.showDiagnosticsStringProperty, {
        font: LABEL_FONT,
        fill: VoltageSensorColors.controlSurfaceTextColorProperty,
        maxWidth: CONTENT_WIDTH - VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS.DIAGNOSTICS_CHECKBOX_MAX_WIDTH_OFFSET,
      }),
      {
        accessibleName: strings.showDiagnosticsStringProperty,
        ...(tandem ? { tandem: tandem.createTandem("diagnosticsCheckbox") } : {}),
      },
    );

    super({
      children: [
        new VBox({
          align: "left",
          spacing: VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS.CONSTRUCTOR_SPACING,
          children: [diagnosticsCheckbox],
        }),
      ],
    });
  }
}

VoltageSensorNamespace.register("VoltageSensorPreferencesNode", VoltageSensorPreferencesNode);
