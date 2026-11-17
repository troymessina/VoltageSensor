/**
 * VoltageSensorKeyboardHelpContent.ts
 *
 * The Keyboard Shortcuts dialog for both screens: the combo boxes (axis,
 * column, recording rate and range pickers) and the basic actions.
 */

import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class VoltageSensorKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super([new ComboBoxKeyboardHelpSection()], [new BasicActionsKeyboardHelpSection()]);
  }
}
