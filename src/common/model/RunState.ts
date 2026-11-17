/**
 * RunState.ts
 *
 * Where a recording is in its lifecycle.
 *
 *   READY ──record──▶ RECORDING ──stop / cap reached──▶ STOPPED
 *     ▲                                                    │
 *     └──────────────────── clear ─────────────────────────┘
 *
 * There is no countdown and no score: this app logs voltage rather than grading
 * it, so the only question is whether samples are currently being taken.
 * STOPPED and READY differ in one way that matters to the view — STOPPED has a
 * trace worth looking at, READY does not.
 */

import VoltageSensorNamespace from "../../VoltageSensorNamespace.js";

export const RunState = {
  /** Nothing recorded yet. */
  READY: "ready",
  /** Sampling the active source onto the trace. */
  RECORDING: "recording",
  /** Recording ended — by the student, or by the duration cap. The trace stands. */
  STOPPED: "stopped",
} as const;

export type RunStateValue = (typeof RunState)[keyof typeof RunState];

VoltageSensorNamespace.register("RunState", RunState);
