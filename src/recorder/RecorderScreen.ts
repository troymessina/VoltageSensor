/**
 * RecorderScreen.ts
 *
 * The Voltage vs Time screen: record the sensor's voltage at a chosen rate and
 * read it off a graph you can zoom, pan and resize, or off a table you can
 * download as CSV.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import type { SensorVoltageSource } from "../common/model/SensorVoltageSource.js";
import { createRecorderIcon } from "../common/VoltageSensorScreenIcons.js";
import { VoltageSensorKeyboardHelpContent } from "../common/view/VoltageSensorKeyboardHelpContent.js";
import { StringManager } from "../i18n/StringManager.js";
import type { VoltageSensorPreferencesModel } from "../preferences/VoltageSensorPreferencesModel.js";
import VoltageSensorColors from "../VoltageSensorColors.js";
import { RecorderModel } from "./model/RecorderModel.js";
import { RecorderScreenSummaryContent } from "./view/RecorderScreenSummaryContent.js";
import { RecorderScreenView } from "./view/RecorderScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type RecorderScreenOptions = ScreenOptions & { tandem: Tandem };

export class RecorderScreen extends Screen<RecorderModel, RecorderScreenView> {
  public constructor(
    source: SensorVoltageSource,
    preferences: VoltageSensorPreferencesModel,
    options: RecorderScreenOptions,
  ) {
    super(
      () => new RecorderModel(source),
      (model) =>
        new RecorderScreenView(model, {
          a11y: StringManager.getInstance().getRecorderA11yStrings(),
          showDiagnosticsProperty: preferences.showDiagnosticsProperty,
          screenSummaryContent: new RecorderScreenSummaryContent(model),
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<RecorderScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: VoltageSensorColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new VoltageSensorKeyboardHelpContent(),
          homeScreenIcon: createRecorderIcon(),
          navigationBarIcon: createRecorderIcon(),
        },
        options,
      ),
    );
  }
}
