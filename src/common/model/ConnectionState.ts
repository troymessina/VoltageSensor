/**
 * ConnectionState.ts
 *
 * Lifecycle of the link to the PASCO Wireless Voltage Sensor.
 *
 * A cancelled device picker is NOT an error — it returns to DISCONNECTED. ERROR
 * is reserved for a link that failed or dropped, and always carries a message
 * on the source's `errorMessageProperty`.
 */

import VoltageSensorNamespace from "../../VoltageSensorNamespace.js";

export const ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
} as const;

export type ConnectionStateValue = (typeof ConnectionState)[keyof typeof ConnectionState];

VoltageSensorNamespace.register("ConnectionState", ConnectionState);
