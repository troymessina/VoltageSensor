/**
 * MeterScreen.ts
 *
 * The Meter screen: a live voltmeter — needle dial and digital readout — fed by
 * the PASCO Wireless Voltage Sensor.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import type { SensorVoltageSource } from "../common/model/SensorVoltageSource.js";
import { createMeterIcon } from "../common/VoltageSensorScreenIcons.js";
import { VoltageSensorKeyboardHelpContent } from "../common/view/VoltageSensorKeyboardHelpContent.js";
import type { VoltageSensorPreferencesModel } from "../preferences/VoltageSensorPreferencesModel.js";
import VoltageSensorColors from "../VoltageSensorColors.js";
import { MeterModel } from "./model/MeterModel.js";
import { MeterScreenSummaryContent } from "./view/MeterScreenSummaryContent.js";
import { MeterScreenView } from "./view/MeterScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type MeterScreenOptions = ScreenOptions & { tandem: Tandem };

export class MeterScreen extends Screen<MeterModel, MeterScreenView> {
  public constructor(
    source: SensorVoltageSource,
    preferences: VoltageSensorPreferencesModel,
    options: MeterScreenOptions,
  ) {
    super(
      () => new MeterModel(source),
      (model) =>
        new MeterScreenView(model, {
          showDiagnosticsProperty: preferences.showDiagnosticsProperty,
          screenSummaryContent: new MeterScreenSummaryContent(model),
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<MeterScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: VoltageSensorColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new VoltageSensorKeyboardHelpContent(),
          homeScreenIcon: createMeterIcon(),
          navigationBarIcon: createMeterIcon(),
        },
        options,
      ),
    );
  }
}
