/**
 * voltageSensorQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in VoltageSensorPreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?pollIntervalMs=80` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import { DEFAULT_POLL_INTERVAL_MS } from "../VoltageSensorConstants.js";
import VoltageSensorNamespace from "../VoltageSensorNamespace.js";

const voltageSensorQueryParameters = QueryStringMachine.getAll({
  /**
   * Show the raw sensor reading and connection detail on both screens.
   * For hardware bring-up, not for students.
   */
  showDiagnostics: {
    type: "boolean",
    defaultValue: false,
  },

  /**
   * How often to take a reading from the sensor, in milliseconds — the poll
   * period, or the period the device keeps when it is streaming. Lower is more
   * responsive and more likely to saturate the link; raise it when debugging a
   * flaky one.
   */
  pollIntervalMs: {
    type: "number",
    defaultValue: DEFAULT_POLL_INTERVAL_MS,
    isValidValue: (value: number) => value >= 10 && value <= 1000,
  },

  /**
   * Let a transport that can carry a stream put the device on its own clock at
   * the period above, instead of paying a round trip per reading. USB can;
   * Bluetooth cannot and polls regardless. False forces polling everywhere,
   * which is the fallback when a device dislikes being asked to stream.
   */
  sensorStreaming: {
    type: "boolean",
    defaultValue: true,
  },

  /**
   * USB bring-up only. `probe` opens the sensor, reports its descriptors and
   * sends nothing — the safe first look, since a PASCO sensor can be knocked off the
   * bus by transfers it dislikes. `all` drops the vendor filter from the picker.
   */
  /**
   * Hardware bring-up: on connect, send every SET_RANGE value from 0 to 15 and
   * report which the sensor accepts, refuses, or ignores, then restore the
   * chosen range. Pair with `showDiagnostics=true` to see the result.
   */
  rangeScan: {
    type: "boolean",
    defaultValue: false,
  },

  usbBringUp: {
    type: "string",
    defaultValue: "off",
    validValues: ["off", "probe", "all", "probeAll"],
  },
});

VoltageSensorNamespace.register("voltageSensorQueryParameters", voltageSensorQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default voltageSensorQueryParameters;
