/**
 * currentDetailsProperty.ts
 *
 * The Voltage vs Time screen's "current details" sentence for the screen
 * summary: what a screen-reader user would see at a glance — whether a sensor
 * is connected, and where the recording is in its lifecycle.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { type RecorderA11yStrings, StringManager } from "../../i18n/StringManager.js";
import { RunState } from "../model/RunState.js";
import type { VoltageRecorderModel } from "../model/VoltageRecorderModel.js";

export type CurrentDetails = {
  readonly property: TReadOnlyProperty<string>;
  readonly dispose: () => void;
};

export function createCurrentDetailsProperty(model: VoltageRecorderModel, a11y: RecorderA11yStrings): CurrentDetails {
  // Spoken time is rounded to whole seconds: a screen reader announcing a tenth
  // of a second ten times a second is unusable.
  const wholeSecondsProperty = new DerivedProperty([model.timeProperty], (time) => Math.round(time));

  const recordingProperty = new PatternStringProperty(a11y.currentDetails.recordingStringProperty, {
    time: wholeSecondsProperty,
  });
  const stoppedProperty = new PatternStringProperty(a11y.currentDetails.stoppedStringProperty, {
    time: wholeSecondsProperty,
  });

  const property = new DerivedProperty(
    [
      model.runStateProperty,
      model.awaitingFirstReadingProperty,
      model.source.isAvailableProperty,
      a11y.currentDetails.readyStringProperty,
      recordingProperty,
      stoppedProperty,
      a11y.currentDetails.waitingForSensorStringProperty,
      // The visible message is already a whole sentence, so it is spoken as is.
      StringManager.getInstance().getRunStrings().waitingForReadingStringProperty,
    ],
    (state, awaitingFirstReading, available, ready, recording, stopped, waiting, waitingForReading) => {
      // A finished recording is still worth describing after the sensor is
      // gone; "ready to record" is not true until something is connected.
      if (!available && state !== RunState.STOPPED) {
        return waiting;
      }
      switch (state) {
        case RunState.RECORDING:
          return awaitingFirstReading ? waitingForReading : recording;
        case RunState.STOPPED:
          return stopped;
        default:
          return ready;
      }
    },
  );

  return {
    property: property,
    dispose: () => {
      property.dispose();
      stoppedProperty.dispose();
      recordingProperty.dispose();
      wholeSecondsProperty.dispose();
    },
  };
}
