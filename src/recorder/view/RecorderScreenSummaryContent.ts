/**
 * RecorderScreenSummaryContent.ts
 *
 * Screen-reader summary of the Voltage vs Time screen: what is on it, what can
 * be done, and — live — where the recording is.
 */
import { ScreenSummaryContent } from "scenerystack/sim";
import type { VoltageRecorderModel } from "../../common/model/VoltageRecorderModel.js";
import { createCurrentDetailsProperty } from "../../common/view/currentDetailsProperty.js";
import { StringManager } from "../../i18n/StringManager.js";

export class RecorderScreenSummaryContent extends ScreenSummaryContent {
  private readonly disposeRecorderScreenSummaryContent: () => void;

  public constructor(model: VoltageRecorderModel) {
    const a11y = StringManager.getInstance().getRecorderA11yStrings();
    const currentDetails = createCurrentDetailsProperty(model, a11y);

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetails.property,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });

    this.disposeRecorderScreenSummaryContent = currentDetails.dispose;
  }

  public override dispose(): void {
    this.disposeRecorderScreenSummaryContent();
    super.dispose();
  }
}
