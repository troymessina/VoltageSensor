import { VOLTAGE_SENSOR_PANEL_SETTINGS } from "../VoltageSensorConstants.js";
/**
 * VoltageSensorPanel.ts
 *
 * A pre-themed Panel that automatically uses VoltageSensorColors for background and
 * border. Use this for all control panels and info boxes in the sim so that
 * default / projector mode switching is handled automatically.
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   import { VoltageSensorPanel } from "../../common/VoltageSensorPanel.js";
 *   import { VBox, Text } from "scenerystack/scenery";
 *
 *   const content = new VBox({
 *     children: [ new Text("label"), slider ],
 *     spacing: 8,
 *   });
 *   const panel = new VoltageSensorPanel(content);
 *
 * ── Overriding defaults ───────────────────────────────────────────────────────
 *
 *   // Wider margins, sharper corners, custom stroke
 *   const panel = new VoltageSensorPanel(content, { xMargin: 20, cornerRadius: 0 });
 *
 *   // Transparent background (decorative border only)
 *   const panel = new VoltageSensorPanel(content, { fill: "transparent" });
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { Node } from "scenerystack/scenery";
import { Panel, type PanelOptions } from "scenerystack/sun";
import VoltageSensorColors from "../VoltageSensorColors.js";
import { PANEL_CORNER_RADIUS } from "../VoltageSensorConstants.js";

export type VoltageSensorPanelOptions = PanelOptions;

export class VoltageSensorPanel extends Panel {
  public constructor(content: Node, providedOptions?: VoltageSensorPanelOptions) {
    const options = optionize<VoltageSensorPanelOptions, EmptySelfOptions, PanelOptions>()(
      {
        fill: VoltageSensorColors.panelBackgroundColorProperty,
        stroke: VoltageSensorColors.panelBorderColorProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: VOLTAGE_SENSOR_PANEL_SETTINGS.OPTIONS_X_MARGIN,
        yMargin: VOLTAGE_SENSOR_PANEL_SETTINGS.OPTIONS_Y_MARGIN,
      },
      providedOptions,
    );
    super(content, options);
  }
}
