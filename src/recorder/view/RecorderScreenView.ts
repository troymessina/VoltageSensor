import { RECORDER_SCREEN_VIEW_SETTINGS } from "../../VoltageSensorConstants.js";
/**
 * RecorderScreenView.ts
 *
 * The Voltage vs Time screen: the configurable graph on the left with the view
 * checkboxes under it, and on the right the record controls with the recording-rate
 * chooser, and the connection and sensor-options panels shared with the Meter
 * screen.
 *
 * ── Why the graph is fed from an emitter ──────────────────────────────────────
 * ConfigurableGraph samples whichever two Properties are on its axes when
 * addDataPoint() is called. Calling that once per animation frame would space
 * points by frame time; here the model owns a fixed clock at the student's
 * chosen rate and emits on it, and the view listens.
 *
 * ── Graph and table share one display area ────────────────────────────────────
 * Both are views of the same recording, so the table opens over the graph's
 * right-hand side rather than squeezing it. The graph is draggable and both are
 * one checkbox away, so a student who wants both moves the graph, and one who
 * only wants numbers turns the graph off.
 */

import { BooleanProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Checkbox } from "scenerystack/sun";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/VoltageSensorButtonOptions.js";
import { SIM_CHECKBOX_OPTIONS } from "../../common/VoltageSensorControlOptions.js";
import { DataTableNode } from "../../common/view/DataTableNode.js";
import { ConfigurableGraph } from "../../common/view/graph/ConfigurableGraph.js";
import type { PlottableProperty } from "../../common/view/graph/PlottableProperty.js";
import { RecordControl } from "../../common/view/RecordControl.js";
import { SensorOptionsPanel } from "../../common/view/SensorOptionsPanel.js";
import { SensorPanel } from "../../common/view/SensorPanel.js";
import type { RecorderA11yStrings } from "../../i18n/StringManager.js";
import { StringManager } from "../../i18n/StringManager.js";
import VoltageSensorColors from "../../VoltageSensorColors.js";
import { GRAPH_HEIGHT, GRAPH_WIDTH, MAX_GRAPH_DATA_POINTS, SCREEN_VIEW_MARGIN } from "../../VoltageSensorConstants.js";
import type { RecorderModel } from "../model/RecorderModel.js";

const LABEL_FONT = new PhetFont(RECORDER_SCREEN_VIEW_SETTINGS.LABEL_FONT_SIZE);

/**
 * Height of the graph's own header bar, which is part of its bounds and sits
 * above the plot. The table clears it rather than covering the axis pickers.
 */
const GRAPH_HEADER_HEIGHT: number = RECORDER_SCREEN_VIEW_SETTINGS.GRAPH_HEADER_HEIGHT;

/** Gap between the data table and the graph's edges, in pixels. */
const TABLE_INSET: number = RECORDER_SCREEN_VIEW_SETTINGS.TABLE_INSET;

type RecorderScreenViewSelfOptions = {
  readonly a11y: RecorderA11yStrings;
  readonly showDiagnosticsProperty: TReadOnlyProperty<boolean>;
};

export type RecorderScreenViewOptions = RecorderScreenViewSelfOptions & ScreenViewOptions;

export class RecorderScreenView extends ScreenView {
  private readonly graph: ConfigurableGraph;
  private readonly dataTable: DataTableNode;
  private readonly showTableProperty: BooleanProperty;
  private readonly disposeRecorderScreenView: () => void;

  public constructor(model: RecorderModel, providedOptions: RecorderScreenViewOptions) {
    const options = optionize<RecorderScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()({}, providedOptions);
    super(options);

    const a11y = providedOptions.a11y;
    const strings = StringManager.getInstance();
    const axes = strings.getAxesStrings();
    const source = model.sensorSource;

    this.addChild(
      new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
        fill: VoltageSensorColors.backgroundColorProperty,
      }),
    );

    // The combo boxes' popups have to be added above everything else, so they
    // get their own layer created before the controls that fill it.
    const comboBoxListParent = new Node();

    // What may go on either axis. Every entry carries its SI unit, so the axis
    // label reads "Voltage (V)", and its recorded series, so swapping the axes
    // redraws the recording instead of blanking it.
    const voltagePlottable: PlottableProperty = {
      name: axes.voltageStringProperty,
      property: model.voltageProperty,
      unit: "V",
      samples: () => model.getVoltageSeries(),
    };
    const timePlottable: PlottableProperty = {
      name: axes.timeStringProperty,
      property: model.timeProperty,
      unit: "s",
      samples: () => model.getTimeSeries(),
    };
    const plottableProperties: PlottableProperty[] = [voltagePlottable, timePlottable];

    const graph = new ConfigurableGraph(
      plottableProperties,
      timePlottable,
      voltagePlottable,
      GRAPH_WIDTH,
      GRAPH_HEIGHT,
      comboBoxListParent,
      MAX_GRAPH_DATA_POINTS,
    );
    graph.left = SCREEN_VIEW_MARGIN + RECORDER_SCREEN_VIEW_SETTINGS.CONSTRUCTOR_LEFT_OFFSET;
    graph.top = SCREEN_VIEW_MARGIN + RECORDER_SCREEN_VIEW_SETTINGS.CONSTRUCTOR_TOP_OFFSET;
    this.graph = graph;
    this.addChild(graph);

    // One point per model sample, not per frame — see the class comment.
    const sampleListener = () => graph.addDataPoint();
    model.sampleEmitter.addListener(sampleListener);

    // Clearing the run clears the plot: the points on screen came from a
    // recording that no longer exists.
    const traceListener = () => {
      if (model.sampleCount === 0) {
        graph.clearData();
      }
    };
    model.traceChangedProperty.link(traceListener);

    // Off to begin with: the graph is this screen's primary display and the
    // table is the second look a student takes at the same recording.
    const showTableProperty = new BooleanProperty(false);
    this.showTableProperty = showTableProperty;

    const dataTable = new DataTableNode({
      model: model,
      plottableProperties: plottableProperties,
      listParent: comboBoxListParent,
      visibleProperty: showTableProperty,
    });
    dataTable.right = graph.right - TABLE_INSET;
    dataTable.top = graph.top + GRAPH_HEADER_HEIGHT + TABLE_INSET;
    this.dataTable = dataTable;
    this.addChild(dataTable);

    const recordControl = new RecordControl(model, a11y, comboBoxListParent);

    const showGraphCheckbox = RecorderScreenView.createCheckbox(
      graph.getGraphVisibleProperty(),
      strings.getShowGraphStringProperty(),
    );
    const showTableCheckbox = RecorderScreenView.createCheckbox(
      showTableProperty,
      strings.getShowTableStringProperty(),
    );
    // Under the graph rather than at the top of the control column: the column
    // has to leave room for the connection panel's warnings above Reset All.
    const viewControl = new HBox({
      spacing: RECORDER_SCREEN_VIEW_SETTINGS.VIEW_CONTROL_SPACING,
      children: [showGraphCheckbox, showTableCheckbox],
      left: SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(viewControl);

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
      spacing: RECORDER_SCREEN_VIEW_SETTINGS.CONTROL_COLUMN_SPACING,
      children: [recordControl, sensorPanel, sensorOptionsPanel],
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      top: SCREEN_VIEW_MARGIN,
    });
    this.addChild(controlColumn);

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        source.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(resetAllButton);

    this.addChild(comboBoxListParent);

    // Traversal order follows the task: decide what the graph is showing, turn
    // the extra views on, record, connect hardware, adjust it, reset last.
    this.addChild(
      new Node({
        pdomOrder: [
          graph,
          showGraphCheckbox,
          showTableCheckbox,
          dataTable.columnAComboBox,
          dataTable.columnBComboBox,
          dataTable.scrollUpButton,
          dataTable.scrollDownButton,
          dataTable.downloadButton,
          recordControl.recordButton,
          recordControl.stopButton,
          recordControl.clearButton,
          recordControl.sampleRateComboBox,
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

    this.disposeRecorderScreenView = () => {
      model.sampleEmitter.removeListener(sampleListener);
      model.traceChangedProperty.unlink(traceListener);
      sensorOptionsPanel.dispose();
      sensorPanel.dispose();
      recordControl.dispose();
      showTableProperty.dispose();
    };
  }

  /** A labelled checkbox in the shared style. */
  private static createCheckbox(property: BooleanProperty, labelProperty: TReadOnlyProperty<string>): Checkbox {
    return new Checkbox(
      property,
      new Text(labelProperty, {
        font: LABEL_FONT,
        fill: VoltageSensorColors.textColorProperty,
        maxWidth: RECORDER_SCREEN_VIEW_SETTINGS.CREATE_CHECKBOX_MAX_WIDTH,
      }),
      {
        ...SIM_CHECKBOX_OPTIONS,
        accessibleName: labelProperty,
      },
    );
  }

  public reset(): void {
    this.graph.reset();
    this.dataTable.reset();
    this.showTableProperty.reset();
  }

  public override dispose(): void {
    this.disposeRecorderScreenView();
    this.graph.dispose();
    // Like the graph, the table owns combo boxes and derived Properties that
    // outlive plain child disposal.
    this.dataTable.dispose();
    super.dispose();
  }
}
