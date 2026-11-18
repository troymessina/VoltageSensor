import { METER_SCREEN_VIEW_SETTINGS } from "../../VoltageSensorConstants.js";
/**
 * MeterScreenView.ts
 *
 * The Meter screen: the voltmeter in the play area, and on the right the same
 * connection and sensor-options panels as the Voltage vs Time screen — bound to
 * the same source, so connecting or zeroing here is connecting or zeroing there.
 */

import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node, Rectangle, RichText, VBox } from "scenerystack/scenery";
import { PhetFont, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { ConnectionState } from "../../common/model/ConnectionState.js";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/VoltageSensorButtonOptions.js";
import { SensorOptionsPanel } from "../../common/view/SensorOptionsPanel.js";
import { SensorPanel } from "../../common/view/SensorPanel.js";
import { VoltmeterNode } from "../../common/view/VoltmeterNode.js";
import { StringManager } from "../../i18n/StringManager.js";
import VoltageSensorColors from "../../VoltageSensorColors.js";
import { SCREEN_VIEW_MARGIN } from "../../VoltageSensorConstants.js";
import type { MeterModel } from "../model/MeterModel.js";

const HINT_FONT = new PhetFont(16);

type MeterScreenViewSelfOptions = {
  readonly showDiagnosticsProperty: TReadOnlyProperty<boolean>;
};

export type MeterScreenViewOptions = MeterScreenViewSelfOptions & ScreenViewOptions;

export class MeterScreenView extends ScreenView {
  private readonly disposeMeterScreenView: () => void;

  public constructor(model: MeterModel, providedOptions: MeterScreenViewOptions) {
    const options = optionize<MeterScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()({}, providedOptions);
    super(options);

    const strings = StringManager.getInstance();
    const source = model.sensorSource;

    this.addChild(
      new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
        fill: VoltageSensorColors.backgroundColorProperty,
      }),
    );

    const comboBoxListParent = new Node();

    const sensorPanel = new SensorPanel({
      source: source,
      a11y: strings.getSensorA11yStrings(),
      showDiagnosticsProperty: providedOptions.showDiagnosticsProperty,
    });
    const sensorOptionsPanel = new SensorOptionsPanel({
      source: source,
      listParent: comboBoxListParent,
    });
    const controlColumn = new VBox({
      align: "left",
      spacing: METER_SCREEN_VIEW_SETTINGS.CONTROL_COLUMN_SPACING,
      children: [sensorPanel, sensorOptionsPanel],
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      top: SCREEN_VIEW_MARGIN,
    });

    const voltmeter = new VoltmeterNode({
      voltageProperty: source.sensorVoltageProperty,
      hasReadingProperty: source.hasReadingProperty,
      rangeProperty: source.rangeProperty,
      overRangeProperty: source.overRangeProperty,
    });

    // Said under the meter, not only in the panel, because the meter is where a
    // student looks first and a placeholder with no explanation looks broken.
    const isDisconnectedProperty = new DerivedProperty(
      [source.connectionStateProperty],
      (state) => state !== ConnectionState.CONNECTED,
    );
    const connectHint = new RichText(strings.getMeterStrings().connectHintStringProperty, {
      font: HINT_FONT,
      fill: VoltageSensorColors.textColorProperty,
      align: "center",
      lineWrap: voltmeter.width,
      visibleProperty: isDisconnectedProperty,
    });

    // Centred in the space left of the control column.
    const playAreaCenterX = SCREEN_VIEW_MARGIN + (controlColumn.left - SCREEN_VIEW_MARGIN) / 2;
    const meterGroup = new VBox({
      spacing: 16,
      children: [voltmeter, connectHint],
      excludeInvisibleChildrenFromBounds: false,
    });
    meterGroup.centerX = playAreaCenterX;
    meterGroup.centerY = this.layoutBounds.centerY;
    this.addChild(meterGroup);
    this.addChild(controlColumn);

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => source.reset(),
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(resetAllButton);

    this.addChild(comboBoxListParent);

    // Connect, then adjust what the reading means, then reset.
    this.addChild(
      new Node({
        pdomOrder: [
          ...(sensorPanel.connectButton ? [sensorPanel.connectButton] : []),
          ...(sensorPanel.connectUsbButton ? [sensorPanel.connectUsbButton] : []),
          sensorPanel.disconnectButton,
          sensorOptionsPanel.rangeComboBox,
          sensorOptionsPanel.changeSignCheckbox,
          sensorOptionsPanel.zeroAtStartCheckbox,
          sensorOptionsPanel.zeroNowButton,
          sensorOptionsPanel.removeZeroButton,
          resetAllButton,
        ],
      }),
    );

    this.disposeMeterScreenView = () => {
      voltmeter.dispose();
      connectHint.dispose();
      isDisconnectedProperty.dispose();
      sensorOptionsPanel.dispose();
      sensorPanel.dispose();
    };
  }

  public override dispose(): void {
    this.disposeMeterScreenView();
    super.dispose();
  }
}
