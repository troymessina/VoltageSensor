/**
 * VoltageSensorConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * ranges, rates) belong here rather than inline in model or view code, so they
 * are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Model values use SI units (volts, seconds, hertz, …); note the unit in a
 *    comment on each value.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in VoltageSensorColors.ts, not here.
 */

import VoltageSensorNamespace from "./VoltageSensorNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/**
 * Plot area of the configurable graph, excluding axis labels and tick labels.
 * The graph can be resized by dragging a corner; this is where it starts and
 * where Reset All puts it back.
 */
export const GRAPH_WIDTH = 560;
export const GRAPH_HEIGHT = 420;

/**
 * Width of the control column on the right of both screens. Narrow enough to
 * leave the graph its full width without the two overlapping, wide enough for
 * the sensor panel's status sentences.
 */
export const CONTROL_PANEL_WIDTH = 300;

// ── The recording (SI units) ──────────────────────────────────────────────────

/**
 * Longest recording allowed, in seconds. Ten minutes covers a slow RC discharge
 * or a battery run-down read at 1 Hz.
 */
export const MAX_RECORD_DURATION_S = 600;

/**
 * Most samples one recording may hold, whatever the rate. At the faster rates
 * this, not {@link MAX_RECORD_DURATION_S}, is what ends a run: 6000 samples is
 * ten minutes at 10 Hz, five at 20 Hz and two at 50 Hz — enough for any
 * classroom run, and few enough that the graph stays responsive.
 */
export const MAX_RECORDED_SAMPLES = 6000;

/**
 * Most points the graph keeps. Above {@link MAX_RECORDED_SAMPLES}, so the
 * sample cap is what ends a recording, never the buffer.
 */
export const MAX_GRAPH_DATA_POINTS = 6100;

/**
 * Recording rates a student may choose from, in hertz. The recorder samples
 * the sensor on its own fixed clock at the chosen rate.
 *
 * Bounded above at 50 Hz because over Bluetooth every reading is one round
 * trip of tens of milliseconds; faster than that, the trace would mostly repeat
 * stale readings rather than resolve anything new.
 */
export const SAMPLE_RATE_CHOICES_HZ: readonly number[] = [1, 2, 5, 10, 20, 50];

/** Rate the Voltage vs Time screen starts at, and the one Reset All returns to. */
export const DEFAULT_SAMPLE_RATE_HZ = 10;

// ── Sensor ────────────────────────────────────────────────────────────────────

/**
 * How often the sensor is asked for a reading, in milliseconds, whenever it is
 * connected. 20 ms keeps a fresh reading waiting for the recorder's clock at
 * every rate up to 50 Hz, link permitting; a Bluetooth round trip that has not
 * returned simply skips a tick.
 */
export const DEFAULT_POLL_INTERVAL_MS = 20;

/**
 * Consecutive failed reads tolerated before the source declares an error. A
 * single dropped BLE round trip is normal; ten in a row is not.
 */
export const MAXIMUM_CONSECUTIVE_FAILURES = 10;

/** Human-readable name of the measurement read from the PS-3211. */
export const VOLTAGE_MEASUREMENT = "Voltage (RawVoltage, factory calibration)";

/** Decimal places on every voltage shown to a student: a millivolt. */
export const VOLTAGE_DECIMALS = 3;

/** Settings for common/model/VoltageRecorderModel.ts. */
export const VOLTAGE_RECORDER_MODEL_SETTINGS = {
  /** A dt larger than this is a tab that was backgrounded, not a slow frame. */
  MAXIMUM_DT_S: 0.25,
  /** Slack for the accumulator comparison, in seconds. */
  TIME_EPSILON_S: 1e-9,
} as const;

/** Settings for common/model/SensorVoltageSource.ts. */
export const SENSOR_VOLTAGE_SOURCE_SETTINGS = {
  /** How long a stream may say nothing before it is given up on (ms). */
  STREAM_SILENCE_TIMEOUT_MS: 1000,
  /** Sample periods of silence tolerated, so a raised `?pollIntervalMs=` is not mistaken for a dead stream. */
  STREAM_SILENCE_PERIODS: 5,
} as const;

/** Settings for common/view/VoltmeterNode.ts. */
export const VOLTMETER_NODE_SETTINGS = {
  /** Radius of the dial's scale arc (px). */
  DIAL_RADIUS: 210,
  /** Half the sweep of the scale, either side of vertical (degrees). */
  HALF_SWEEP_DEGREES: 60,
  /** Major tick length (px). */
  MAJOR_TICK_LENGTH: 18,
  /** Minor tick length (px). */
  MINOR_TICK_LENGTH: 9,
  /** Minor ticks between two major ticks (count). */
  MINOR_TICKS_PER_MAJOR: 4,
  /** Tick line width (px). */
  TICK_LINE_WIDTH: 2,
  /** Tick label font size (px). */
  TICK_LABEL_FONT_SIZE: 16,
  /** Gap between the end of a major tick and its label (px). */
  TICK_LABEL_GAP: 16,
  /** Needle line width (px). */
  NEEDLE_LINE_WIDTH: 4,
  /** Pivot radius (px). */
  PIVOT_RADIUS: 12,
  /** Digital readout font size (px). */
  READOUT_FONT_SIZE: 64,
  /** Unit font size on the digital readout (px). */
  UNIT_FONT_SIZE: 32,
  /** Range caption font size (px). */
  CAPTION_FONT_SIZE: 15,
  /** Padding inside the meter's face (px). */
  FACE_MARGIN: 28,
  /** Corner radius of the meter's face (px). */
  FACE_CORNER_RADIUS: 18,
  /** Face border width (px). */
  FACE_LINE_WIDTH: 3,
  /** Width of the digital readout window (px). */
  READOUT_WIDTH: 340,
  /** Vertical gap between the dial and the readout (px). */
  READOUT_SPACING: 18,
} as const;

/** Settings for meter/view/MeterScreenView.ts. */
export const METER_SCREEN_VIEW_SETTINGS = {
  /** Control column spacing (px). */
  CONTROL_COLUMN_SPACING: 14,
} as const;

/** Settings for common/VoltageSensorControlOptions.ts. */
export const VOLTAGE_SENSOR_CONTROL_OPTIONS_SETTINGS = {
  /** Checkbox box width (px). */
  CHECKBOX_BOX_WIDTH: 16,
  /** Sim checkbox options spacing (px). */
  SIM_CHECKBOX_OPTIONS_SPACING: 4,
} as const;

/** Settings for common/VoltageSensorPanel.ts. */
export const VOLTAGE_SENSOR_PANEL_SETTINGS = {
  /** Options x margin (px). */
  OPTIONS_X_MARGIN: 12,
  /** Options y margin (px). */
  OPTIONS_Y_MARGIN: 10,
} as const;

/** Settings for common/VoltageSensorScreenIcons.ts. */
export const VOLTAGE_SENSOR_SCREEN_ICONS_SETTINGS = {
  /** Inset of the plot area from the icon's left edge, leaving room for the axis (px). */
  PLOT_LEFT: 74,
  /** Plot top (px). */
  PLOT_TOP: 40,
  /** Grid line width (px). */
  AXES_AND_GRID_LINE_WIDTH: 3,
  /** Axis, scale and face border line width (px). */
  AXIS_LINE_WIDTH: 6,
  /** Segments in the charging curve (count). */
  STEPS: 48,
  /** Time constants spanned by the icon's charging curve (dimensionless). */
  CURVE_TIME_CONSTANTS: 4,
  /** Trace path line width (px). */
  TRACE_PATH_LINE_WIDTH: 14,
  /** Inset of the meter face from the icon edge (px). */
  METER_FACE_INSET: 24,
  /** Meter face corner radius (px). */
  METER_FACE_CORNER_RADIUS: 28,
  /** Distance of the needle pivot above the icon's bottom edge (px). */
  METER_PIVOT_BOTTOM_INSET: 70,
  /** Radius of the meter's scale arc (px). */
  METER_RADIUS: 230,
  /** Half the scale's sweep either side of vertical (degrees). */
  METER_HALF_SWEEP_DEGREES: 55,
  /** Major tick length (px). */
  METER_TICK_LENGTH: 36,
  /** Where the needle points (degrees right of vertical). */
  METER_NEEDLE_DEGREES: 28,
  /** Needle line width (px). */
  METER_NEEDLE_LINE_WIDTH: 12,
  /** Pivot radius (px). */
  METER_PIVOT_RADIUS: 22,
} as const;

/** Settings for common/util/GraphAnnouncer.ts. */
export const GRAPH_ANNOUNCER_SETTINGS = {
  /** Milliseconds of quiet required before an axis change is spoken. Long enough to swallow a run of rapid selections, short enough not to feel laggy. */
  GRAPH_CHANGE_ANNOUNCEMENT_DELAY: 200,
} as const;

/** Settings for common/view/DataTableNode.ts. */
export const DATA_TABLE_NODE_SETTINGS = {
  FOOTER_MAX_WIDTH_OFFSET: 70, // px

  ITEM_2_SPACING: 3, // px
  ITEM_3_SPACING: 6, // px

  /** Header font size (px). */
  HEADER_FONT_SIZE: 11,
  /** Cell font size (px). */
  CELL_FONT_SIZE: 11,
  /** Combo box font size (px). */
  COMBO_BOX_FONT_SIZE: 11,
  /** Footer font size (px). */
  FOOTER_FONT_SIZE: 10,
  /** Button font size (px). */
  BUTTON_FONT_SIZE: 11,
  /** Scroll button font size (px). */
  SCROLL_BUTTON_FONT_SIZE: 11,
  /** Rows on screen at once. Enough to see a turnaround, and chosen so the panel fits inside the graph's plot area rather than hanging over its tick labels; the rest of a recording is a scroll — or a download — away. */
  VISIBLE_ROWS: 10,
  /** Row height (px). */
  ROW_HEIGHT: 17,
  /** Column width (px). */
  COLUMN_WIDTH: 84,
  /** Column gap (px). */
  COLUMN_GAP: 12,
  /** Rows moved by one press of a scroll button, or one notch of the wheel. */
  SCROLL_STEP_ROWS: 3,
  /** Decimals in every cell and in the CSV: a millivolt, and a millisecond. */
  VALUE_DECIMALS: 3,
  /** Create combo box corner radius (px). */
  CREATE_COMBO_BOX_CORNER_RADIUS: 4,
  /** Create combo box x margin (px). */
  CREATE_COMBO_BOX_X_MARGIN: 5,
  /** Create combo box y margin (px). */
  CREATE_COMBO_BOX_Y_MARGIN: 2,
  /** Create scroll button x margin (px). */
  CREATE_SCROLL_BUTTON_X_MARGIN: 7,
  /** Create scroll button y margin (px). */
  CREATE_SCROLL_BUTTON_Y_MARGIN: 3,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 7,
  /** Constructor x margin (px). */
  CONSTRUCTOR_X_MARGIN: 10,
  /** Constructor y margin (px). */
  CONSTRUCTOR_Y_MARGIN: 8,
} as const;

/** Settings for recorder/view/RecorderScreenView.ts. */
export const RECORDER_SCREEN_VIEW_SETTINGS = {
  CONSTRUCTOR_LEFT_OFFSET: 44, // px
  CONSTRUCTOR_TOP_OFFSET: 24, // px

  /** Label font size (px). */
  LABEL_FONT_SIZE: 12,
  /** Width of the track beneath the graph. */
  PLAY_AREA_WIDTH: 560,
  /** Height of the graph's own header bar, which is part of its bounds and sits above the plot. The table clears it rather than covering the axis pickers. */
  GRAPH_HEADER_HEIGHT: 30,
  /** Gap between the data table and the graph's edges, in pixels. */
  TABLE_INSET: 10,
  /** View control spacing (px). */
  VIEW_CONTROL_SPACING: 7,
  /** Control column spacing (px). */
  CONTROL_COLUMN_SPACING: 14,
  /** Create checkbox max width (px). */
  CREATE_CHECKBOX_MAX_WIDTH: 300,
} as const;

/** Settings for common/view/RecordControl.ts. */
export const RECORD_CONTROL_SETTINGS = {
  SAMPLE_RATE_ROW_MAX_WIDTH_OFFSET: 140, // px
  ELAPSED_TEXT_MAX_WIDTH_OFFSET: 40, // px
  CONNECT_FIRST_TEXT_LINE_WRAP_OFFSET: 40, // px
  WAITING_TEXT_LINE_WRAP_OFFSET: 40, // px

  /** Button font size (px). */
  BUTTON_FONT_SIZE: 15,
  /** Label font size (px). */
  LABEL_FONT_SIZE: 12,
  /** Time font size (px). */
  TIME_FONT_SIZE: 26,
  /** Message font size (px). */
  MESSAGE_FONT_SIZE: 14,
  /** Sample rate combo box corner radius (px). */
  SAMPLE_RATE_COMBO_BOX_CORNER_RADIUS: 4,
  /** Sample rate combo box x margin (px). */
  SAMPLE_RATE_COMBO_BOX_X_MARGIN: 6,
  /** Sample rate combo box y margin (px). */
  SAMPLE_RATE_COMBO_BOX_Y_MARGIN: 3,
  /** Sample rate row spacing (px). */
  SAMPLE_RATE_ROW_SPACING: 8,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 10,
} as const;

/** Settings for common/view/SensorOptionsPanel.ts. */
export const SENSOR_OPTIONS_PANEL_SETTINGS = {
  CHANGE_SIGN_CHECKBOX_MAX_WIDTH_OFFSET: 60, // px
  ZERO_AT_START_CHECKBOX_MAX_WIDTH_OFFSET: 60, // px
  OFFSET_TEXT_MAX_WIDTH_OFFSET: 40, // px
  CONSTRUCTOR_MAX_WIDTH_OFFSET: 40, // px

  ITEM_4_SPACING: 6, // px

  /** Title font size (px). */
  TITLE_FONT_SIZE: 13,
  /** Label font size (px). */
  LABEL_FONT_SIZE: 12,
  /** Button font size (px). */
  BUTTON_FONT_SIZE: 12,
  /** Readout font size (px). */
  READOUT_FONT_SIZE: 11,
  /** Range combo box corner radius (px). */
  RANGE_COMBO_BOX_CORNER_RADIUS: 4,
  /** Range combo box x margin (px). */
  RANGE_COMBO_BOX_X_MARGIN: 6,
  /** Range combo box y margin (px). */
  RANGE_COMBO_BOX_Y_MARGIN: 3,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 8,
} as const;

/** Settings for common/view/SensorPanel.ts. */
export const SENSOR_PANEL_SETTINGS = {
  STATUS_ROW_MAX_WIDTH_OFFSET: 60, // px
  DEVICE_NAME_TEXT_MAX_WIDTH_OFFSET: 40, // px
  ERROR_TEXT_LINE_WRAP_OFFSET: 40, // px
  UNAVAILABLE_TEXT_LINE_WRAP_OFFSET: 40, // px
  DIAGNOSTICS_TEXT_MAX_WIDTH_OFFSET: 40, // px
  MEASUREMENT_LIST_TEXT_MAX_WIDTH_OFFSET: 40, // px
  RAW_READING_TEXT_MAX_WIDTH_OFFSET: 40, // px

  /** Label font size (px). */
  LABEL_FONT_SIZE: 13,
  /** Message font size (px). */
  MESSAGE_FONT_SIZE: 12,
  /** Status dot radius (px). */
  STATUS_DOT_RADIUS: 5,
  /** Status row spacing (px). */
  STATUS_ROW_SPACING: 8,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 8,
} as const;

/** Settings for common/view/graph/ConfigurableGraph.ts. */
export const CONFIGURABLE_GRAPH_SETTINGS = {
  RESIZE_GRAPH_TOP_OFFSET: 35, // px

  /** Grid line width (px). */
  GRID_LINE_WIDTH: 0.5,
  /** Plot line width (px). */
  PLOT_LINE_WIDTH: 2,
  /** Tick extent (px). */
  TICK_EXTENT: 8,
  /** Tick label font size (px). */
  TICK_LABEL_FONT_SIZE: 10,
  /** Decimal places on axis tick labels (digits). */
  TICK_LABEL_DECIMALS: 2,
  /** Axis label font size (px). */
  AXIS_LABEL_FONT_SIZE: 12,
  /** Axis label offset (px). */
  AXIS_LABEL_OFFSET: 35,
  /** Y axis interaction width (px). */
  Y_AXIS_INTERACTION_WIDTH: 60,
  /** X axis interaction height (px). */
  X_AXIS_INTERACTION_HEIGHT: 30,
  /** Button size (px). */
  BUTTON_SIZE: 24,
  /** Button padding (px). */
  BUTTON_PADDING: 4,
  /** Button spacing (px). */
  BUTTON_SPACING: 2,
  /** Button corner radius (px). */
  BUTTON_CORNER_RADIUS: 3,
  /** Button font size (px). */
  BUTTON_FONT_SIZE: 14,
  /** Button hover opacity (dimensionless). */
  BUTTON_HOVER_OPACITY: 0.8,
  /** Title bottom offset (px). */
  TITLE_BOTTOM_OFFSET: -5,
  /** Default maximum samples retained on the graph (count). */
  DEFAULT_MAX_DATA_POINTS: 2000,
  /** Initial range min (control/model units). */
  INITIAL_RANGE_MIN: -10,
  /** Initial range max (control/model units). */
  INITIAL_RANGE_MAX: 10,
  /** Default button-background opacity when not hovered (dimensionless). */
  OPACITY: 1.0,
  /** Axis interaction width (px). */
  AXIS_INTERACTION_WIDTH: 60,
  /** Axis interaction height (px). */
  AXIS_INTERACTION_HEIGHT: 30,
} as const;

/** Settings for common/view/graph/GraphControlsPanel.ts. */
export const GRAPH_CONTROLS_PANEL_SETTINGS = {
  /** Combo box font size (px). */
  COMBO_BOX_FONT_SIZE: 12,
  /** Title font size (px). */
  TITLE_FONT_SIZE: 14,
  /** Combo box corner radius (px). */
  COMBO_BOX_CORNER_RADIUS: 5,
  /** Combo box x margin (px). */
  COMBO_BOX_X_MARGIN: 6,
  /** Combo box y margin (px). */
  COMBO_BOX_Y_MARGIN: 3,
  /** Title spacing (px). */
  TITLE_SPACING: 3,
  /** Header height (px). */
  HEADER_HEIGHT: 30,
  /** Header corner radius (px). */
  HEADER_CORNER_RADIUS: 5,
  /** Header line width (px). */
  HEADER_LINE_WIDTH: 2,
  /** Header darken factor (dimensionless). */
  HEADER_DARKEN_FACTOR: 0.1,
} as const;

/** Settings for common/view/graph/GraphDataManager.ts. */
export const GRAPH_DATA_MANAGER_SETTINGS = {
  /** Trail min radius (px). */
  TRAIL_MIN_RADIUS: 3,
  /** Trail max radius (px). */
  TRAIL_MAX_RADIUS: 5,
  /** Trail min opacity (dimensionless). */
  TRAIL_MIN_OPACITY: 0.2,
  /** Trail max opacity (dimensionless). */
  TRAIL_MAX_OPACITY: 0.8,
  /** Default range min (control/model units). */
  DEFAULT_RANGE_MIN: -10,
  /** Default range max (control/model units). */
  DEFAULT_RANGE_MAX: 10,
} as const;

/** Settings for common/view/graph/GraphInteractionHandler.ts. */
export const GRAPH_INTERACTION_HANDLER_SETTINGS = {
  /** Handle size (px). */
  HANDLE_SIZE: 12,
  /** Handle offset (px). */
  HANDLE_OFFSET: -6,
  /** Handle corner x (px). */
  HANDLE_CORNER_X: 2,
  /** Handle corner y (px). */
  HANDLE_CORNER_Y: 2,
  /** Handle line width (px). */
  HANDLE_LINE_WIDTH: 2,
  /** Min width (px). */
  MIN_WIDTH: 200,
  /** Min height (px). */
  MIN_HEIGHT: 150,
} as const;

/** Settings for preferences/VoltageSensorPreferencesNode.ts. */
export const VOLTAGE_SENSOR_PREFERENCES_NODE_SETTINGS = {
  DIAGNOSTICS_CHECKBOX_MAX_WIDTH_OFFSET: 40, // px

  /** Label font size (px). */
  LABEL_FONT_SIZE: 14,
  /** Content width (px). */
  CONTENT_WIDTH: 440,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 12,
} as const;

VoltageSensorNamespace.register("VoltageSensorConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  GRAPH_WIDTH,
  GRAPH_HEIGHT,
  MAX_RECORD_DURATION_S,
  MAX_RECORDED_SAMPLES,
  MAX_GRAPH_DATA_POINTS,
  SAMPLE_RATE_CHOICES_HZ,
  DEFAULT_SAMPLE_RATE_HZ,
});
