/**
 * VoltageSensorScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each screen, drawn on the
 * standard PhET 548 × 373 canvas using VoltageSensorColors.
 *
 * The Meter icon is the voltmeter's centre-zero dial with its needle swung to
 * the right; the Voltage vs Time icon is a capacitor-charging curve on the
 * graph's axes. Everything is drawn from ProfileColorProperty values, so the
 * icons follow projector mode, and from fixed numbers, so they are identical on
 * every launch.
 */
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import VoltageSensorColors from "../VoltageSensorColors.js";
import { VOLTAGE_SENSOR_SCREEN_ICONS_SETTINGS } from "../VoltageSensorConstants.js";

const W = 548;
const H = 373;
const S = VOLTAGE_SENSOR_SCREEN_ICONS_SETTINGS;

/** Inset of the plot area from the icon edge, leaving room for the axes. */
const PLOT_LEFT: number = S.PLOT_LEFT;
const PLOT_RIGHT = W - 40;
const PLOT_TOP: number = S.PLOT_TOP;
const PLOT_BOTTOM = H - 60;

const DEGREES_TO_RADIANS = Math.PI / 180;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, { fill: VoltageSensorColors.backgroundColorProperty });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: VoltageSensorColors.backgroundColorProperty,
  });
}

/** Two axes and a light grid, so the curve reads as a plot rather than a doodle. */
function axesAndGrid(): Node {
  const children: Node[] = [];
  for (let i = 1; i <= 3; i++) {
    const x = PLOT_LEFT + (i * (PLOT_RIGHT - PLOT_LEFT)) / 4;
    children.push(
      new Line(x, PLOT_TOP, x, PLOT_BOTTOM, {
        stroke: VoltageSensorColors.chartGridColorProperty,
        lineWidth: S.AXES_AND_GRID_LINE_WIDTH,
      }),
    );
  }
  for (let i = 1; i <= 2; i++) {
    const y = PLOT_TOP + (i * (PLOT_BOTTOM - PLOT_TOP)) / 3;
    children.push(
      new Line(PLOT_LEFT, y, PLOT_RIGHT, y, {
        stroke: VoltageSensorColors.chartGridColorProperty,
        lineWidth: S.AXES_AND_GRID_LINE_WIDTH,
      }),
    );
  }
  children.push(
    new Line(PLOT_LEFT, PLOT_TOP, PLOT_LEFT, PLOT_BOTTOM, {
      stroke: VoltageSensorColors.chartBorderColorProperty,
      lineWidth: S.AXIS_LINE_WIDTH,
    }),
    new Line(PLOT_LEFT, PLOT_BOTTOM, PLOT_RIGHT, PLOT_BOTTOM, {
      stroke: VoltageSensorColors.chartBorderColorProperty,
      lineWidth: S.AXIS_LINE_WIDTH,
    }),
  );
  return new Node({ children: children });
}

/** V(t) = V₀(1 − e^(−t/τ)): the curve a first voltage-vs-time lab usually draws. */
function chargingCurve(): Path {
  const shape = new Shape();
  const steps: number = S.STEPS;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = PLOT_LEFT + t * (PLOT_RIGHT - PLOT_LEFT);
    const y = PLOT_BOTTOM - (1 - Math.exp(-t * S.CURVE_TIME_CONSTANTS)) * (PLOT_BOTTOM - PLOT_TOP - 20);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  return new Path(shape, {
    stroke: VoltageSensorColors.traceColorProperty,
    lineWidth: S.TRACE_PATH_LINE_WIDTH,
    lineCap: "round",
    lineJoin: "round",
  });
}

export function createRecorderIcon(): ScreenIcon {
  return iconFrom(new Node({ children: [background(), axesAndGrid(), chargingCurve()] }));
}

export function createMeterIcon(): ScreenIcon {
  const centerX = W / 2;
  const pivotY = H - S.METER_PIVOT_BOTTOM_INSET;
  const radius: number = S.METER_RADIUS;
  const halfSweep: number = S.METER_HALF_SWEEP_DEGREES;

  const pointAt = (angleDegrees: number, distance: number) => ({
    x: centerX + distance * Math.sin(angleDegrees * DEGREES_TO_RADIANS),
    y: pivotY - distance * Math.cos(angleDegrees * DEGREES_TO_RADIANS),
  });

  const children: Node[] = [
    background(),
    new Rectangle(S.METER_FACE_INSET, S.METER_FACE_INSET, W - 2 * S.METER_FACE_INSET, H - 2 * S.METER_FACE_INSET, {
      cornerRadius: S.METER_FACE_CORNER_RADIUS,
      fill: VoltageSensorColors.meterFaceColorProperty,
      stroke: VoltageSensorColors.panelBorderColorProperty,
      lineWidth: S.AXIS_LINE_WIDTH,
    }),
    new Path(
      new Shape().arc(
        centerX,
        pivotY,
        radius,
        (-90 - halfSweep) * DEGREES_TO_RADIANS,
        (-90 + halfSweep) * DEGREES_TO_RADIANS,
        false,
      ),
      { stroke: VoltageSensorColors.meterScaleColorProperty, lineWidth: S.AXIS_LINE_WIDTH },
    ),
  ];

  // Seven major ticks, the centre one being zero.
  for (let i = -3; i <= 3; i++) {
    const angle = (i / 3) * halfSweep;
    const inner = pointAt(angle, radius - S.METER_TICK_LENGTH);
    const outer = pointAt(angle, radius);
    children.push(
      new Line(inner.x, inner.y, outer.x, outer.y, {
        stroke: VoltageSensorColors.meterScaleColorProperty,
        lineWidth: S.AXIS_LINE_WIDTH,
      }),
    );
  }

  const tip = pointAt(S.METER_NEEDLE_DEGREES, radius - S.METER_TICK_LENGTH / 2);
  children.push(
    new Line(centerX, pivotY, tip.x, tip.y, {
      stroke: VoltageSensorColors.meterNeedleColorProperty,
      lineWidth: S.METER_NEEDLE_LINE_WIDTH,
      lineCap: "round",
    }),
    new Circle(S.METER_PIVOT_RADIUS, {
      fill: VoltageSensorColors.meterNeedleColorProperty,
      centerX: centerX,
      centerY: pivotY,
    }),
  );

  return iconFrom(new Node({ children: children }));
}
