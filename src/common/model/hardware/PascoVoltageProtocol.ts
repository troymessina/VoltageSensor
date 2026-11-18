/**
 * PascoVoltageProtocol.ts
 *
 * Dependency-free PASCO wire protocol, scoped to the PASCO Wireless Voltage
 * Sensor (PS-3211). Pure functions over bytes, so everything here is unit
 * tested without a Bluetooth stack.
 *
 * ── Where this came from ──────────────────────────────────────────────────────
 * The packet layer (GATT layout, READ_ONE_SAMPLE, streaming, the USB envelope)
 * is shared by every PASCO wireless sensor and is copied from OpenLyceum's
 * MotionSensor sim. The voltage-specific facts are transcribed from PASCO's own
 * Python library, PASCOscientific/pasco_python, `src/pasco/datasheets.py`:
 *
 *   Interface 1031 "WirelessVoltage", AdvertisingName="Voltage",
 *     one channel → sensor 2031 "WirelessVoltageSensor" (Model PS-3211)
 *   Measurement 0   RawVoltage  RawDigital, DataSize=2   (unsigned, little-endian)
 *   Measurement 1   CalVoltage  FactoryCal Params="32768,0,65536,5"   (±5 V)
 *   Measurement 2   CalVoltage  FactoryCal Params="32768,0,65536,15"  (±15 V)
 *   Measurement 3   Voltage     Select Inputs="1,2"  (picked by the range)
 *   Measurement 100 VoltageRangeSettings  Values="pm5v:1:pm15v:3", Value="3"
 *
 * That entry is for the original PS-3211. The PS-3211A reads ±30 V; see
 * {@link VoltageRange} for how its larger range is handled.
 *
 * So one sample is two bytes, and the calibration is the straight line through
 * (32768, 0 V) and (65536, full scale): mid-scale is zero volts.
 */

const UUID_PREFIX = "4a5c000";
const UUID_SUFFIX = "5c1e741f1c00";

export const PASCO_CHARACTERISTIC = {
  SERVICE: 0,
  SEND_COMMAND: 2,
  RECEIVE: 3,
  /** Where the device pushes samples once it is sampling on its own clock. */
  STREAM_DATA: 4,
  /** Where the host acknowledges them, or the device stops sending. */
  STREAM_ACK: 5,
} as const;

export const PASCO_DEVICE_SERVICE_ID = 0;
export const VOLTAGE_SENSOR_SERVICE_ID = 1;
/** RawVoltage is one two-byte field. */
const VOLTAGE_SENSOR_SAMPLE_BYTES = 2;
/** What a PS-3211 advertises; its full name carries a serial suffix, e.g. "Voltage 123-456". */
export const VOLTAGE_SENSOR_ADVERTISED_NAME = "Voltage";

/**
 * The two points of the datasheet's factory calibration: raw count 32768 is
 * 0 V, and raw count 65536 is the positive full-scale voltage of the range.
 * @internal Exported for unit tests; not part of the application API.
 */
export const RAW_ZERO_COUNT = 32768;
const RAW_FULL_SCALE_COUNT = 65536;

const READ_ONE_SAMPLE = 0x05;

/**
 * Selects a sensor's measurement range. Absent from PASCO's own libraries;
 * recovered from `PascoBLEDriver::SetRange` in SPARKvue's WebAssembly build,
 * which frames it as `[SET_RANGE, 0x00, ordinal, index]` and waits a second for
 * the ordinary result packet. See doc/implementation-notes.md.
 */
const SET_RANGE = 0x28;

/**
 * Sets the period of the device's own periodic sampler, as a little-endian
 * microsecond count. `BLEInterface::PreStartSampling` scales seconds by 1e6
 * before calling it. Note this configures streaming only — {@link READ_ONE_SAMPLE}
 * is unaffected, so on its own the command changes nothing this sim reads.
 */
const SET_SAMPLE_PERIOD = 0x01;

/**
 * Starts and stops the device's own sampler. `START_SAMPLING` carries one
 * little-endian millisecond period per channel and goes to the device service,
 * not a sensor's — `BLEInterface::StartSampling` scales seconds by 1000 and
 * masks to eleven bits before sending it.
 */
const START_SAMPLING = 0x06;
const STOP_SAMPLING = 0x07;

/** Sequence numbers on streamed packets are five bits and wrap. */
const STREAM_SEQUENCE_MODULUS = 0x20;

/**
 * Streamed packets are acknowledged in batches; `pasco_python` sends one every
 * time its counter passes eight, and captured USB traffic acknowledges at
 * sequence 0x1f and again at 0x07 — eight apart both times.
 */
export const STREAM_ACK_INTERVAL = 8;

/**
 * Which of the sensor's ranged measurements to address, counting only those the
 * datasheet flags `IsRange="1"`. The PS-3211 declares exactly one — measurement
 * 100, `VoltageRangeSettings` — so this is always zero here.
 */
const RANGE_MEASUREMENT_ORDINAL = 0x00;

const RESULT = 0xc0;
const STATUS_OK = 0x00;

/**
 * The sensor's two input ranges, as the values {@link SET_RANGE} takes.
 *
 * PASCO's datasheet only describes the original PS-3211: `pm5v:1:pm15v:3`.
 * Tested on a PS-3211A, which reads ±30 V:
 *   - value 1 is accepted, selects ±5 V, and decodes correctly as ±5 V;
 *   - value 3 is refused, and the sensor stays where it was;
 *   - with the sensor set to its 30 V range in PASCO Capstone, decoding as
 *     ±30 V reads correctly.
 * The numbers below identify the two ranges in this app. What is actually sent
 * for each is decided by {@link rangeCommandValue}.
 */
export const VoltageRange = {
  PLUS_MINUS_5V: 1,
  PLUS_MINUS_30V: 3,
} as const;

export type VoltageRangeValue = (typeof VoltageRange)[keyof typeof VoltageRange];

export function pascoUuid(serviceId: number, characteristicId: number): string {
  return `${UUID_PREFIX}${serviceId}-000${characteristicId}-0000-0000-${UUID_SUFFIX}`;
}

export const VOLTAGE_SENSOR_OPTIONAL_SERVICE_UUIDS: readonly string[] = [
  PASCO_DEVICE_SERVICE_ID,
  VOLTAGE_SENSOR_SERVICE_ID,
].map((serviceId) => pascoUuid(serviceId, PASCO_CHARACTERISTIC.SERVICE));

function toCommandBuffer(bytes: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** Device-service keepalive sent after subscribing to notifications. */
export function keepaliveCommand(): ArrayBuffer {
  return toCommandBuffer([0x00]);
}

/** Channel 0 has one two-byte raw field: the unsigned RawVoltage count. */
export function readVoltageSampleCommand(): ArrayBuffer {
  return toCommandBuffer([READ_ONE_SAMPLE, VOLTAGE_SENSOR_SAMPLE_BYTES]);
}

/**
 * Asks the sensor to switch range. `value` is the datasheet's range value (see
 * {@link rangeCommandValue}). Answered like any other command.
 */
export function setRangeCommand(value: number): ArrayBuffer {
  return toCommandBuffer([SET_RANGE, 0x00, RANGE_MEASUREMENT_ORDINAL, value]);
}

/**
 * The SET_RANGE value to send for a range, or null when the app sends none.
 *
 * On a PS-3211A, value 1 is accepted and selects ±5 V. Value 3 (`pm15v` in the
 * PS-3211 datasheet) is refused. SPARKvue's current datasheet gives no
 * PS-3211A entry. Its PS-4254 Voltage/Current sensor has the same ±5 V / ±30 V
 * calibration, and there `pm30v` is 6 (`Values="pm5v:1:pm30v:6"`). Until a
 * value is confirmed on a PS-3211A, ±30 V is sent only when one is supplied
 * with `?range30Command=`. Otherwise choosing ±30 V only changes the decode,
 * and the user sets the sensor's range in PASCO software.
 *
 * @param plusMinus30Command - the value to try for ±30 V, or null to send none
 */
export function rangeCommandValue(range: VoltageRangeValue, plusMinus30Command: number | null): number | null {
  return range === VoltageRange.PLUS_MINUS_5V ? 1 : plusMinus30Command;
}

/** Opcodes this client sends and then waits to see acknowledged. */
export const AcknowledgedCommand = {
  SET_SAMPLE_PERIOD,
  SET_RANGE,
} as const;

export type AcknowledgedCommandValue = (typeof AcknowledgedCommand)[keyof typeof AcknowledgedCommand];

/** Asks the sensor to reconfigure its periodic sampler. Trailing bytes are reserved. */
export function setSamplePeriodCommand(periodMicroseconds: number): ArrayBuffer {
  const period = Math.round(periodMicroseconds);
  return toCommandBuffer([
    SET_SAMPLE_PERIOD,
    period & 0xff,
    (period >>> 8) & 0xff,
    (period >>> 16) & 0xff,
    (period >>> 24) & 0xff,
    0x00,
    0x00,
  ]);
}

/**
 * Decode [result, status, opcode]. `null` when the packet answers some other
 * command, `false` when the device answered but refused this one.
 */
export function decodeCommandAck(data: Uint8Array, command: AcknowledgedCommandValue): boolean | null {
  if (data.length < 3 || data[0] !== RESULT || data[2] !== command) {
    return null;
  }
  return data[1] === STATUS_OK;
}

/** Starts the device sampling on its own clock, one channel, period in ms. */
export function startSamplingCommand(periodMilliseconds: number): ArrayBuffer {
  const period = Math.round(periodMilliseconds) & 0x7ff;
  return toCommandBuffer([START_SAMPLING, period & 0xff, (period >>> 8) & 0xff]);
}

export function stopSamplingCommand(): ArrayBuffer {
  return toCommandBuffer([STOP_SAMPLING]);
}

/**
 * A streamed sample: `[sequence, raw-low, raw-high]`, sequence below
 * {@link STREAM_SEQUENCE_MODULUS}. Anything else — a result, an event — is not
 * one of these, and `null` says so.
 */
export function decodeStreamPacket(packet: Uint8Array): { sequence: number; rawCount: number } | null {
  if (packet.length < 1 + VOLTAGE_SENSOR_SAMPLE_BYTES || packet[0] === undefined) {
    return null;
  }
  const sequence = packet[0];
  if (sequence >= STREAM_SEQUENCE_MODULUS) {
    return null;
  }
  return {
    sequence: sequence,
    rawCount: (packet[1] ?? 0) | ((packet[2] ?? 0) << 8),
  };
}

/** `[0, 0, 0, 0, sequence]` — acknowledges everything up to that sequence. */
export function streamAckCommand(lastSequence: number): ArrayBuffer {
  return toCommandBuffer([0x00, 0x00, 0x00, 0x00, lastSequence & (STREAM_SEQUENCE_MODULUS - 1)]);
}

/**
 * True when a packet answers a command, rather than being one of the events the
 * device emits unprompted — `85 96 0f 62 00 04` and the like, which interleave
 * with responses and must be skipped rather than mistaken for one.
 */
export function isResultPacket(packet: Uint8Array): boolean {
  return packet.length >= 3 && packet[0] === RESULT;
}

/** Decode [result, ok, read-one, raw-low, raw-high] into the unsigned raw count. */
export function decodeVoltageNotification(data: Uint8Array): number | null {
  if (
    data.length < 3 + VOLTAGE_SENSOR_SAMPLE_BYTES ||
    data[0] !== RESULT ||
    data[1] !== STATUS_OK ||
    data[2] !== READ_ONE_SAMPLE
  ) {
    return null;
  }
  return (data[3] ?? 0) | ((data[4] ?? 0) << 8);
}

// ── USB envelope ──────────────────────────────────────────────────────────────
//
// Over USB the packets above are unchanged; they simply gain a two-byte header
// naming the service and characteristic that GATT would have addressed, and a
// read becomes an explicit request rather than a subscription. Recovered from
// `USBBLEDevice::SendData` / `::RecvData`.

// `USBBLEDevice::RecvData` can build a `[service | 0x80, characteristic, count]`
// read request, but captured SPARKvue traffic contains none: a command is
// written and the IN endpoint is simply read. No such frame is built here.

/** One transfer cannot exceed 64 bytes, two of which are the header. */
const USB_MAXIMUM_PAYLOAD_BYTES = 62;

/** `[service, characteristic, ...packet]` — a write to that characteristic. */
export function usbWriteFrame(serviceId: number, characteristicId: number, packet: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(packet);
  return toCommandBuffer([serviceId, characteristicId, ...bytes.subarray(0, USB_MAXIMUM_PAYLOAD_BYTES)]);
}

/**
 * Strips the two-byte header from a USB IN transfer. `USBBLEDevice::run`
 * rebuilds its handle as `(buf[0] << 8) | buf[1]`, so the header is always
 * there — but a transfer that already starts with a result byte is passed
 * through rather than truncated, because misreading one costs a whole sample.
 */
export function usbPacketBody(transfer: Uint8Array): Uint8Array {
  if (transfer.length >= 3 && transfer[0] === RESULT) {
    return transfer;
  }
  return transfer.subarray(2);
}

/** Positive full-scale voltage of a range, in volts. */
export function fullScaleVolts(range: VoltageRangeValue): number {
  return range === VoltageRange.PLUS_MINUS_5V ? 5 : 30;
}

/**
 * The datasheet's FactoryCal: the line through (32768, 0 V) and
 * (65536, full scale). A raw count is unsigned, so 0 is negative full scale.
 */
export function rawCountToVolts(rawCount: number, range: VoltageRangeValue): number {
  const fullScale = fullScaleVolts(range);
  return ((rawCount - RAW_ZERO_COUNT) * fullScale) / (RAW_FULL_SCALE_COUNT - RAW_ZERO_COUNT);
}

/**
 * Where the sensor's converter stops, as raw counts, per range. Measured on a
 * PS-3211A with inputs well beyond each range (2026-11-18):
 *
 *   ±5 V:  below −5 V the count sits at 140–160; above +5 V it sits at 65535.
 *   ±30 V: at −31 V the count sits at 280–295; at +31 V it is about 65400.
 *
 * The negative end does not reach 0, and on ±30 V neither end reaches the end
 * of the 16-bit scale, so a test against 0 and 65535 alone misses them. Each
 * threshold sits about 50 counts inside the measured limit, clear of the
 * reading noise at the limit, so a pinned reading is always caught. The cost is
 * that a genuine reading in that last sliver of the range — within about 8 mV of
 * −5 V, or about 50 mV of ±30 V — is also flagged, which errs the right way.
 */
const OVER_RANGE_LIMITS: Record<VoltageRangeValue, { readonly low: number; readonly high: number }> = {
  [VoltageRange.PLUS_MINUS_5V]: { low: 210, high: 65519 },
  [VoltageRange.PLUS_MINUS_30V]: { low: 345, high: 65350 },
};

/**
 * Whether a raw count is at the end of the range, where the converter stops.
 * The input is then at or beyond full scale and the true voltage is not known.
 * On ±5 V, for example, 9 V reads as 5.000 V. The student needs to be told to
 * choose a larger range, not shown a plausible number.
 */
export function isRawCountAtLimit(rawCount: number, range: VoltageRangeValue): boolean {
  const limits = OVER_RANGE_LIMITS[range];
  return rawCount <= limits.low || rawCount >= limits.high;
}
