/**
 * MeterScreenSummaryContent.ts
 *
 * Screen-reader summary of the Meter screen, including — live — what the meter
 * reads. The spoken value is rounded to two decimal places: a screen reader
 * re-announcing millivolt jitter many times a second is unusable.
 */
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { ScreenSummaryContent } from "scenerystack/sim";
import { ConnectionState } from "../../common/model/ConnectionState.js";
import { fullScaleVolts } from "../../common/model/hardware/PascoVoltageProtocol.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MeterModel } from "../model/MeterModel.js";

/** Decimal places in the spoken reading. */
const SPOKEN_DECIMALS = 2;

export class MeterScreenSummaryContent extends ScreenSummaryContent {
  private readonly disposeMeterScreenSummaryContent: () => void;

  public constructor(model: MeterModel) {
    const a11y = StringManager.getInstance().getMeterA11yStrings();
    const source = model.sensorSource;

    const spokenVoltageProperty = new DerivedProperty([source.sensorVoltageProperty], (volts) =>
      toFixed(volts, SPOKEN_DECIMALS),
    );
    const rangeValueProperty = new DerivedProperty([source.rangeProperty], (range) => fullScaleVolts(range));
    const readingProperty = new PatternStringProperty(a11y.currentDetails.readingPatternStringProperty, {
      voltage: spokenVoltageProperty,
      range: rangeValueProperty,
    });

    const currentDetailsProperty = new DerivedProperty(
      [
        source.connectionStateProperty,
        source.hasReadingProperty,
        readingProperty,
        a11y.currentDetails.awaitingReadingStringProperty,
        a11y.currentDetails.waitingForSensorStringProperty,
      ],
      (state, hasReading, reading, awaiting, waiting) => {
        if (state !== ConnectionState.CONNECTED) {
          return waiting;
        }
        return hasReading ? reading : awaiting;
      },
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });

    this.disposeMeterScreenSummaryContent = () => {
      currentDetailsProperty.dispose();
      readingProperty.dispose();
      rangeValueProperty.dispose();
      spokenVoltageProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeMeterScreenSummaryContent();
    super.dispose();
  }
}
