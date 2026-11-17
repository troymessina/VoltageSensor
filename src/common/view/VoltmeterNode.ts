import { VOLTMETER_NODE_SETTINGS } from "../../VoltageSensorConstants.js";
/**
 * VoltmeterNode.ts
 *
 * The Meter screen's instrument: a centre-zero needle dial over a large digital
 * readout, on one face, the way a bench voltmeter with both displays looks.
 *
 * ── Why both ──────────────────────────────────────────────────────────────────
 * The digits are the measurement — three decimal places of it. The needle is
 * how a student sees a voltage *change*: a slow drift, a sign reversal when the
 * leads are swapped, how far a reading is from the end of the range. Neither
 * does the other's job.
 *
 * ── The scale follows the range ───────────────────────────────────────────────
 * The dial is centre-zero and spans the sensor's range, ±5 V or ±15 V, and is
 * redrawn when the range changes. A reading beyond the range pegs the needle a
 * few degrees past the last tick rather than leaving the face.
 *
 * Until the sensor has given a reading the needle rests at zero, dimmed, and
 * the digits show a placeholder, so a meter that is not measuring never shows a
 * plausible-looking 0.000 V.
 */

import { DerivedProperty, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, HBox, Line, Node, Path, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import VoltageSensorColors from "../../VoltageSensorColors.js";
import { VOLTAGE_DECIMALS } from "../../VoltageSensorConstants.js";
import { fullScaleVolts, VoltageRange, type VoltageRangeValue } from "../model/hardware/PascoVoltageProtocol.js";

const S = VOLTMETER_NODE_SETTINGS;
const TICK_LABEL_FONT = new PhetFont({ size: S.TICK_LABEL_FONT_SIZE, weight: "bold" });
const READOUT_FONT = new PhetFont({ size: S.READOUT_FONT_SIZE, weight: "bold" });
const UNIT_FONT = new PhetFont({ size: S.UNIT_FONT_SIZE, weight: "bold" });
const CAPTION_FONT = new PhetFont(S.CAPTION_FONT_SIZE);

const DEGREES_TO_RADIANS = Math.PI / 180;

/** How far past the end of the scale an over-range reading pegs the needle (degrees). */
const PEG_DEGREES = 4;

export type VoltmeterNodeOptions = {
  /** The voltage to show, in volts. */
  readonly voltageProperty: TReadOnlyProperty<number>;
  /** False until the sensor has given a reading; the meter then shows a placeholder. */
  readonly hasReadingProperty: TReadOnlyProperty<boolean>;
  /** The sensor's range, which sets the scale. */
  readonly rangeProperty: TReadOnlyProperty<VoltageRangeValue>;
};

export class VoltmeterNode extends Node {
  private readonly disposeVoltmeterNode: () => void;

  public constructor(options: VoltmeterNodeOptions) {
    super();

    const meterStrings = StringManager.getInstance().getMeterStrings();
    const radius = S.DIAL_RADIUS;
    const halfSweep = S.HALF_SWEEP_DEGREES;

    // ── Dial ──────────────────────────────────────────────────────────────────
    // The pivot is the origin; angles are measured from straight up, positive
    // clockwise, so a positive voltage swings the needle to the right.
    const pointAt = (angleDegrees: number, distance: number) => ({
      x: distance * Math.sin(angleDegrees * DEGREES_TO_RADIANS),
      y: -distance * Math.cos(angleDegrees * DEGREES_TO_RADIANS),
    });

    const scaleNode = new Node();
    const drawScale = (range: VoltageRangeValue) => {
      for (const child of scaleNode.children) {
        child.dispose();
      }
      scaleNode.removeAllChildren();

      const fullScale = fullScaleVolts(range);
      const majorStep = range === VoltageRange.PLUS_MINUS_15V ? 5 : 1;
      const minorStep = majorStep / (S.MINOR_TICKS_PER_MAJOR + 1);

      // Arc of the scale, from the left end to the right end.
      scaleNode.addChild(
        new Path(
          new Shape().arc(
            0,
            0,
            radius,
            (-90 - halfSweep) * DEGREES_TO_RADIANS,
            (-90 + halfSweep) * DEGREES_TO_RADIANS,
            false,
          ),
          { stroke: VoltageSensorColors.meterScaleColorProperty, lineWidth: S.TICK_LINE_WIDTH },
        ),
      );

      const minorCount = Math.round((2 * fullScale) / minorStep);
      for (let i = 0; i <= minorCount; i++) {
        const volts = -fullScale + i * minorStep;
        const isMajor = i % (S.MINOR_TICKS_PER_MAJOR + 1) === 0;
        const angle = (volts / fullScale) * halfSweep;
        const inner = pointAt(angle, radius - (isMajor ? S.MAJOR_TICK_LENGTH : S.MINOR_TICK_LENGTH));
        const outer = pointAt(angle, radius);
        scaleNode.addChild(
          new Line(inner.x, inner.y, outer.x, outer.y, {
            stroke: VoltageSensorColors.meterScaleColorProperty,
            lineWidth: isMajor ? S.TICK_LINE_WIDTH : S.TICK_LINE_WIDTH / 2,
          }),
        );
        if (isMajor) {
          const labelPoint = pointAt(angle, radius + S.TICK_LABEL_GAP);
          // "−" (U+2212), not a hyphen, and an explicit "+" so a centre-zero
          // scale reads symmetrically.
          const rounded = Math.round(volts);
          const label = rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${-rounded}` : "0";
          scaleNode.addChild(
            new Text(label, {
              font: TICK_LABEL_FONT,
              fill: VoltageSensorColors.meterScaleColorProperty,
              centerX: labelPoint.x,
              centerY: labelPoint.y,
            }),
          );
        }
      }
    };
    options.rangeProperty.link(drawScale);

    const needle = new Line(0, 0, 0, -(radius - S.MINOR_TICK_LENGTH), {
      stroke: VoltageSensorColors.meterNeedleColorProperty,
      lineWidth: S.NEEDLE_LINE_WIDTH,
      lineCap: "round",
    });
    const pivot = new Circle(S.PIVOT_RADIUS, { fill: VoltageSensorColors.meterNeedleColorProperty });

    const needleAngleProperty = new DerivedProperty(
      [options.voltageProperty, options.hasReadingProperty, options.rangeProperty],
      (volts, hasReading, range) => {
        if (!hasReading) {
          return 0;
        }
        const angle = (volts / fullScaleVolts(range)) * halfSweep;
        const limit = halfSweep + PEG_DEGREES;
        return Math.max(-limit, Math.min(limit, angle));
      },
    );
    const needleListener = (angle: number) => {
      needle.rotation = angle * DEGREES_TO_RADIANS;
    };
    needleAngleProperty.link(needleListener);

    const needleOpacityListener = (hasReading: boolean) => {
      needle.opacity = hasReading ? 1 : 0.35;
      pivot.opacity = hasReading ? 1 : 0.35;
    };
    options.hasReadingProperty.link(needleOpacityListener);

    const dial = new Node({ children: [scaleNode, needle, pivot] });

    // ── Digital readout ───────────────────────────────────────────────────────
    const readoutStringProperty = new DerivedProperty(
      [options.voltageProperty, options.hasReadingProperty, meterStrings.noReadingStringProperty],
      (volts, hasReading, noReading) => {
        if (!hasReading) {
          return noReading;
        }
        // Explicit sign and the true minus sign, so the digits do not shift
        // sideways as the reading crosses zero.
        const magnitude = toFixed(Math.abs(volts), VOLTAGE_DECIMALS);
        const isZero = Number(magnitude) === 0;
        return isZero ? ` ${magnitude}` : volts < 0 ? `−${magnitude}` : `+${magnitude}`;
      },
    );
    const readoutText = new Text(readoutStringProperty, {
      font: READOUT_FONT,
      fill: VoltageSensorColors.accentColorProperty,
      maxWidth: S.READOUT_WIDTH - 90,
    });
    const unitText = new Text(meterStrings.unitStringProperty, {
      font: UNIT_FONT,
      fill: VoltageSensorColors.accentColorProperty,
    });
    const readoutRow = new HBox({ spacing: 10, align: "bottom", children: [readoutText, unitText] });
    const readoutWindow = new Rectangle(0, 0, S.READOUT_WIDTH, readoutRow.height + 20, 8, 8, {
      fill: VoltageSensorColors.meterReadoutBackgroundColorProperty,
      stroke: VoltageSensorColors.panelBorderColorProperty,
      lineWidth: 2,
    });
    // Recentred whenever the digits change width.
    const readoutLayoutListener = () => {
      readoutRow.center = readoutWindow.center;
    };
    readoutRow.boundsProperty.link(readoutLayoutListener);
    const readout = new Node({ children: [readoutWindow, readoutRow] });

    const rangeValueProperty = new DerivedProperty([options.rangeProperty], (range) => fullScaleVolts(range));
    const captionProperty = new PatternStringProperty(meterStrings.rangePatternStringProperty, {
      range: rangeValueProperty,
    });
    const caption = new Text(captionProperty, {
      font: CAPTION_FONT,
      fill: VoltageSensorColors.meterScaleColorProperty,
      maxWidth: S.READOUT_WIDTH,
    });

    const content = new VBox({
      spacing: S.READOUT_SPACING,
      children: [dial, readout, caption],
    });

    const face = new Rectangle(content.bounds.dilated(S.FACE_MARGIN), S.FACE_CORNER_RADIUS, S.FACE_CORNER_RADIUS, {
      fill: VoltageSensorColors.meterFaceColorProperty,
      stroke: VoltageSensorColors.panelBorderColorProperty,
      lineWidth: S.FACE_LINE_WIDTH,
    });

    this.children = [face, content];

    this.disposeVoltmeterNode = () => {
      options.rangeProperty.unlink(drawScale);
      options.hasReadingProperty.unlink(needleOpacityListener);
      readoutRow.boundsProperty.unlink(readoutLayoutListener);
      needleAngleProperty.unlink(needleListener);
      needleAngleProperty.dispose();
      readoutText.dispose();
      unitText.dispose();
      caption.dispose();
      captionProperty.dispose();
      rangeValueProperty.dispose();
      readoutStringProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeVoltmeterNode();
    super.dispose();
  }
}
