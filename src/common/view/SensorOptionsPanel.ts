import { SENSOR_OPTIONS_PANEL_SETTINGS } from "../../VoltageSensorConstants.js";
/**
 * SensorOptionsPanel.ts
 *
 * The measurement settings PASCO's own software offers for a voltage sensor:
 * change sign, zero at start, zero now / remove the zero offset, and the range.
 * A note under the range menu says the sensor's range must be set in PASCO
 * software, because the app can command ±5 V but not ±30 V.
 * Shown on both screens, bound to the one shared source, so a setting made on
 * one screen is the setting on the other.
 *
 * They are grouped in their own panel rather than mixed into the connection
 * panel because they answer a different question. The connection panel is about
 * whether there is a sensor; this one is about what its numbers mean.
 *
 * Change sign, zero now, remove zero and the range are locked while a
 * recording runs. Each changes every reading after it at once, so mid-run it
 * would put a step into the trace that the circuit never made. Zero at start
 * only arms the next run, so it stays available.
 */

import {
  type BooleanProperty,
  DerivedProperty,
  PatternStringProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import type { Node } from "scenerystack/scenery";
import { HBox, RichText, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, ComboBox, RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import VoltageSensorColors from "../../VoltageSensorColors.js";
import { CONTROL_PANEL_WIDTH, VOLTAGE_DECIMALS } from "../../VoltageSensorConstants.js";
import { VoltageRange, type VoltageRangeValue } from "../model/hardware/PascoVoltageProtocol.js";
import type { SensorVoltageSource } from "../model/SensorVoltageSource.js";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../VoltageSensorButtonOptions.js";
import { SIM_CHECKBOX_OPTIONS } from "../VoltageSensorControlOptions.js";
import { VoltageSensorPanel } from "../VoltageSensorPanel.js";

const TITLE_FONT = new PhetFont({ size: SENSOR_OPTIONS_PANEL_SETTINGS.TITLE_FONT_SIZE, weight: "bold" });
const LABEL_FONT = new PhetFont(SENSOR_OPTIONS_PANEL_SETTINGS.LABEL_FONT_SIZE);
const BUTTON_FONT = new PhetFont(SENSOR_OPTIONS_PANEL_SETTINGS.BUTTON_FONT_SIZE);
const READOUT_FONT = new PhetFont(SENSOR_OPTIONS_PANEL_SETTINGS.READOUT_FONT_SIZE);

export type SensorOptionsPanelOptions = {
  readonly source: SensorVoltageSource;
  /** Where the range combo box's popup goes, above everything else. */
  readonly listParent: Node;
};

export class SensorOptionsPanel extends VoltageSensorPanel {
  /** Exposed so the ScreenView can order them in the PDOM. */
  public readonly changeSignCheckbox: Checkbox;
  public readonly zeroAtStartCheckbox: Checkbox;
  public readonly zeroNowButton: RectangularPushButton;
  public readonly removeZeroButton: RectangularPushButton;
  public readonly rangeComboBox: ComboBox<VoltageRangeValue>;

  private readonly disposeSensorOptionsPanel: () => void;

  public constructor(providedOptions: SensorOptionsPanelOptions) {
    const source = providedOptions.source;
    const strings = StringManager.getInstance().getSensorOptionsStrings();

    const isIdleProperty = new DerivedProperty([source.runInProgressProperty], (running) => !running);

    const createCheckbox = (
      property: BooleanProperty,
      label: Text,
      enabledProperty?: TReadOnlyProperty<boolean>,
    ): Checkbox =>
      new Checkbox(property, label, {
        ...SIM_CHECKBOX_OPTIONS,
        accessibleName: label.stringProperty,
        ...(enabledProperty ? { enabledProperty: enabledProperty } : {}),
      });

    const changeSignCheckbox = createCheckbox(
      source.changeSignProperty,
      new Text(strings.changeSignStringProperty, {
        font: LABEL_FONT,
        fill: VoltageSensorColors.textColorProperty,
        maxWidth: CONTROL_PANEL_WIDTH - SENSOR_OPTIONS_PANEL_SETTINGS.CHANGE_SIGN_CHECKBOX_MAX_WIDTH_OFFSET,
      }),
      isIdleProperty,
    );
    const zeroAtStartCheckbox = createCheckbox(
      source.zeroAtStartProperty,
      new Text(strings.zeroAtStartStringProperty, {
        font: LABEL_FONT,
        fill: VoltageSensorColors.textColorProperty,
        maxWidth: CONTROL_PANEL_WIDTH - SENSOR_OPTIONS_PANEL_SETTINGS.ZERO_AT_START_CHECKBOX_MAX_WIDTH_OFFSET,
      }),
    );

    // Zeroing needs a reading to zero *to*, so it waits for the first one.
    const canZeroNowProperty = new DerivedProperty(
      [source.hasReadingProperty, isIdleProperty],
      (hasReading, idle) => hasReading && idle,
    );
    const zeroNowButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(strings.zeroNowStringProperty, { font: BUTTON_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => source.zeroNow(),
      accessibleName: strings.zeroNowStringProperty,
      enabledProperty: canZeroNowProperty,
    });

    const hasOffsetProperty = new DerivedProperty([source.zeroOffsetProperty], (offset) => offset !== 0);
    const canRemoveZeroProperty = new DerivedProperty(
      [hasOffsetProperty, isIdleProperty],
      (hasOffset, idle) => hasOffset && idle,
    );
    const removeZeroButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(strings.removeZeroStringProperty, { font: BUTTON_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => source.removeZeroOffset(),
      accessibleName: strings.removeZeroStringProperty,
      enabledProperty: canRemoveZeroProperty,
    });

    // The offset is invisible in the reading itself — the same 0.400 V can mean
    // two different voltages across the leads — so it is stated whenever there is one.
    const offsetValueProperty = new DerivedProperty([source.zeroOffsetProperty], (offset) =>
      toFixed(offset, VOLTAGE_DECIMALS),
    );
    const offsetProperty = new PatternStringProperty(strings.offsetPatternStringProperty, {
      offset: offsetValueProperty,
    });
    const offsetText = new Text(offsetProperty, {
      font: READOUT_FONT,
      fill: VoltageSensorColors.textColorProperty,
      visibleProperty: hasOffsetProperty,
      maxWidth: CONTROL_PANEL_WIDTH - SENSOR_OPTIONS_PANEL_SETTINGS.OFFSET_TEXT_MAX_WIDTH_OFFSET,
    });

    const rangeComboBox = new ComboBox(
      source.rangeProperty,
      [
        {
          value: VoltageRange.PLUS_MINUS_5V,
          createNode: () => new Text(strings.range5StringProperty, comboItemOptions()),
        },
        {
          value: VoltageRange.PLUS_MINUS_30V,
          createNode: () => new Text(strings.range30StringProperty, comboItemOptions()),
        },
      ],
      providedOptions.listParent,
      {
        cornerRadius: SENSOR_OPTIONS_PANEL_SETTINGS.RANGE_COMBO_BOX_CORNER_RADIUS,
        xMargin: SENSOR_OPTIONS_PANEL_SETTINGS.RANGE_COMBO_BOX_X_MARGIN,
        yMargin: SENSOR_OPTIONS_PANEL_SETTINGS.RANGE_COMBO_BOX_Y_MARGIN,
        buttonFill: VoltageSensorColors.panelBackgroundColorProperty,
        buttonStroke: VoltageSensorColors.panelBorderColorProperty,
        listFill: VoltageSensorColors.panelBackgroundColorProperty,
        listStroke: VoltageSensorColors.panelBorderColorProperty,
        highlightFill: VoltageSensorColors.panelBorderColorProperty,
        accessibleName: strings.rangeStringProperty,
        enabledProperty: isIdleProperty,
      },
    );

    // The sensor accepts a command to ±5 V but refuses ±30 V, which only PASCO's
    // own software can set. The menu here picks how readings are decoded, so it
    // has to match the sensor, and that is something only the user can ensure.
    const rangeNoteText = new RichText(strings.rangeNoteStringProperty, {
      font: READOUT_FONT,
      fill: VoltageSensorColors.textColorProperty,
      lineWrap: CONTROL_PANEL_WIDTH - SENSOR_OPTIONS_PANEL_SETTINGS.CONSTRUCTOR_MAX_WIDTH_OFFSET,
    });

    super(
      new VBox({
        align: "left",
        spacing: SENSOR_OPTIONS_PANEL_SETTINGS.CONSTRUCTOR_SPACING,
        preferredWidth: CONTROL_PANEL_WIDTH - 24,
        stretch: false,
        children: [
          new Text(strings.titleStringProperty, {
            font: TITLE_FONT,
            fill: VoltageSensorColors.textColorProperty,
            maxWidth: CONTROL_PANEL_WIDTH - SENSOR_OPTIONS_PANEL_SETTINGS.CONSTRUCTOR_MAX_WIDTH_OFFSET,
          }),
          new HBox({
            spacing: SENSOR_OPTIONS_PANEL_SETTINGS.CONSTRUCTOR_SPACING,
            children: [
              new Text(strings.rangeStringProperty, {
                font: LABEL_FONT,
                fill: VoltageSensorColors.textColorProperty,
                maxWidth: CONTROL_PANEL_WIDTH - 140,
              }),
              rangeComboBox,
            ],
          }),
          rangeNoteText,
          changeSignCheckbox,
          zeroAtStartCheckbox,
          // One per row: side by side the two labels are wider than the control
          // column, and a panel that sticks out past its neighbours reads as a
          // mistake.
          new VBox({
            align: "left",
            spacing: SENSOR_OPTIONS_PANEL_SETTINGS.ITEM_4_SPACING,
            children: [zeroNowButton, removeZeroButton],
          }),
          offsetText,
        ],
      }),
      { minWidth: CONTROL_PANEL_WIDTH },
    );

    this.changeSignCheckbox = changeSignCheckbox;
    this.zeroAtStartCheckbox = zeroAtStartCheckbox;
    this.zeroNowButton = zeroNowButton;
    this.removeZeroButton = removeZeroButton;
    this.rangeComboBox = rangeComboBox;

    this.disposeSensorOptionsPanel = () => {
      // The controls first: they hold listeners on the Properties below.
      for (const disposable of [
        changeSignCheckbox,
        zeroAtStartCheckbox,
        zeroNowButton,
        removeZeroButton,
        rangeComboBox,
        rangeNoteText,
        offsetProperty,
        offsetValueProperty,
        canRemoveZeroProperty,
        hasOffsetProperty,
        canZeroNowProperty,
        isIdleProperty,
      ]) {
        disposable.dispose();
      }
    };
  }

  public override dispose(): void {
    this.disposeSensorOptionsPanel();
    super.dispose();
  }
}

/** Item labels sit on the panel fill, so they take the panel's text colour. */
function comboItemOptions() {
  return { font: LABEL_FONT, fill: VoltageSensorColors.textColorProperty };
}
