import { describe, expect, it } from "vitest";
import {
  AcknowledgedCommand,
  decodeCommandAck,
  decodeCommandStatus,
  decodeStreamPacket,
  decodeVoltageNotification,
  fullScaleVolts,
  isRawCountAtLimit,
  isResultPacket,
  PASCO_CHARACTERISTIC,
  pascoUuid,
  RAW_ZERO_COUNT,
  rawCountToVolts,
  readVoltageSampleCommand,
  STREAM_ACK_INTERVAL,
  setRangeCommand,
  setSamplePeriodCommand,
  startSamplingCommand,
  stopSamplingCommand,
  streamAckCommand,
  usbPacketBody,
  usbWriteFrame,
  VOLTAGE_SENSOR_ADVERTISED_NAME,
  VOLTAGE_SENSOR_OPTIONAL_SERVICE_UUIDS,
  VOLTAGE_SENSOR_SERVICE_ID,
  VoltageRange,
} from "../../../src/common/model/hardware/PascoVoltageProtocol.js";

const bytes = (buffer: ArrayBuffer): number[] => Array.from(new Uint8Array(buffer));

describe("PASCO voltage-sensor protocol", () => {
  it("builds device and sensor GATT UUIDs", () => {
    expect(pascoUuid(0, 3)).toBe("4a5c0000-0003-0000-0000-5c1e741f1c00");
    expect(pascoUuid(1, 2)).toBe("4a5c0001-0002-0000-0000-5c1e741f1c00");
    expect(VOLTAGE_SENSOR_OPTIONAL_SERVICE_UUIDS).toHaveLength(2);
  });

  it("requests the PS-3211 two-byte RawVoltage sample", () => {
    expect(Array.from(new Uint8Array(readVoltageSampleCommand()))).toEqual([0x05, 0x02]);
  });

  it("decodes a successful service-0 response little-endian", () => {
    expect(decodeVoltageNotification(new Uint8Array([0xc0, 0x00, 0x05, 0x88, 0x13]))).toBe(5000);
  });

  it("rejects unrelated, failed, and short notifications", () => {
    expect(decodeVoltageNotification(new Uint8Array([0x03, 0x88, 0x13]))).toBeNull();
    expect(decodeVoltageNotification(new Uint8Array([0xc0, 0x01, 0x05, 0x88, 0x13]))).toBeNull();
    expect(decodeVoltageNotification(new Uint8Array([0xc0, 0x00, 0x05, 0x88]))).toBeNull();
  });

  it("addresses the sensor's one ranged measurement with the datasheet's range values", () => {
    // Found on a PS-3211A by scanning: only 1 (±5 V) and 2 (±30 V) are accepted.
    expect(bytes(setRangeCommand(VoltageRange.PLUS_MINUS_5V))).toEqual([0x28, 0x00, 0x00, 0x01]);
    expect(bytes(setRangeCommand(VoltageRange.PLUS_MINUS_30V))).toEqual([0x28, 0x00, 0x00, 0x02]);
  });

  it("reports the status byte of a refusal", () => {
    expect(decodeCommandStatus(new Uint8Array([0xc0, 0x00, 0x28]), AcknowledgedCommand.SET_RANGE)).toBe(0);
    expect(decodeCommandStatus(new Uint8Array([0xc0, 0x05, 0x28]), AcknowledgedCommand.SET_RANGE)).toBe(5);
    expect(decodeCommandStatus(new Uint8Array([0xc0, 0x00, 0x05]), AcknowledgedCommand.SET_RANGE)).toBeNull();
  });

  it("separates an accepted command from a refused one", () => {
    expect(decodeCommandAck(new Uint8Array([0xc0, 0x00, 0x28]), AcknowledgedCommand.SET_RANGE)).toBe(true);
    expect(decodeCommandAck(new Uint8Array([0xc0, 0x01, 0x28]), AcknowledgedCommand.SET_RANGE)).toBe(false);
  });

  it("ignores packets that answer a different command", () => {
    const sample = new Uint8Array([0xc0, 0x00, 0x05, 0x88, 0x13]);
    expect(decodeCommandAck(sample, AcknowledgedCommand.SET_RANGE)).toBeNull();
    expect(decodeCommandAck(new Uint8Array([0x03, 0x00, 0x28]), AcknowledgedCommand.SET_RANGE)).toBeNull();
    expect(decodeCommandAck(new Uint8Array([0xc0, 0x00]), AcknowledgedCommand.SET_RANGE)).toBeNull();
    // A range acknowledgement must not satisfy a pending sample-period wait.
    expect(decodeCommandAck(new Uint8Array([0xc0, 0x00, 0x28]), AcknowledgedCommand.SET_SAMPLE_PERIOD)).toBeNull();
    expect(decodeVoltageNotification(sample)).toBe(5000);
  });

  it("encodes the sample period as little-endian microseconds", () => {
    // 20 Hz is 50 ms is 50000 us is 0x0000c350.
    expect(bytes(setSamplePeriodCommand(50_000))).toEqual([0x01, 0x50, 0xc3, 0x00, 0x00, 0x00, 0x00]);
    // 250 Hz, the datasheet's MaxRate, is 4000 us.
    expect(bytes(setSamplePeriodCommand(4_000))).toEqual([0x01, 0xa0, 0x0f, 0x00, 0x00, 0x00, 0x00]);
  });

  it("wraps packets in the USB service/characteristic header", () => {
    expect(
      bytes(usbWriteFrame(VOLTAGE_SENSOR_SERVICE_ID, PASCO_CHARACTERISTIC.SEND_COMMAND, readVoltageSampleCommand())),
    ).toEqual([0x01, 0x02, 0x05, 0x02]);
  });

  it("reads a sample out of a captured USB transfer", () => {
    // Captured from a PS-3219, whose packet layer the PS-3211 shares:
    // OUT `01 02 05 02` answered by this on IN 2.
    const transfer = new Uint8Array([0x00, 0x03, 0xc0, 0x00, 0x05, 0xd9, 0x5a]);
    expect(decodeVoltageNotification(usbPacketBody(transfer))).toBe(0x5ad9);
  });

  it("tells a captured event packet apart from an answer", () => {
    // Both off the wire. The 0x85 event arrives unprompted between answers.
    const event = new Uint8Array([0x00, 0x03, 0x85, 0x96, 0x0f, 0x62, 0x00, 0x04]);
    const answer = new Uint8Array([0x00, 0x03, 0xc0, 0x00, 0x05, 0xd9, 0x5a]);
    expect(isResultPacket(usbPacketBody(event))).toBe(false);
    expect(isResultPacket(usbPacketBody(answer))).toBe(true);
  });

  it("finds the packet whether or not the USB header is echoed back", () => {
    const bare = new Uint8Array([0xc0, 0x00, 0x05, 0x88, 0x13]);
    const prefixed = new Uint8Array([0x00, 0x03, 0xc0, 0x00, 0x05, 0x88, 0x13]);
    expect(decodeVoltageNotification(usbPacketBody(bare))).toBe(5000);
    expect(decodeVoltageNotification(usbPacketBody(prefixed))).toBe(5000);
  });

  it("starts and stops the device's own sampler", () => {
    // 20 Hz is 50 ms, and the period is eleven bits little-endian.
    expect(bytes(startSamplingCommand(50))).toEqual([0x06, 0x32, 0x00]);
    expect(bytes(startSamplingCommand(4))).toEqual([0x06, 0x04, 0x00]);
    expect(bytes(stopSamplingCommand())).toEqual([0x07]);
  });

  it("decodes streamed samples captured off the wire", () => {
    // `01 04 1b d9 5a` (PS-3219 capture) — service 1, characteristic 4, sequence 0x1b, sample 0x5ad9.
    const transfer = new Uint8Array([0x01, 0x04, 0x1b, 0xd9, 0x5a]);
    expect(decodeStreamPacket(usbPacketBody(transfer))).toEqual({
      sequence: 0x1b,
      rawCount: 0x5ad9,
    });
  });

  it("keeps results and events out of the streamed-sample path", () => {
    // 0xc0 and 0x85 both exceed the five-bit sequence space, so neither can be
    // mistaken for a sample however the transfer is sliced.
    expect(decodeStreamPacket(new Uint8Array([0xc0, 0x00, 0x05, 0xd9, 0x5a]))).toBeNull();
    expect(decodeStreamPacket(new Uint8Array([0x85, 0x96, 0x0f, 0x62]))).toBeNull();
    expect(decodeStreamPacket(new Uint8Array([0x1b, 0xd9]))).toBeNull();
  });

  it("acknowledges a run of streamed samples", () => {
    // `01 05 00 00 00 00 1f` on the wire, minus its service/characteristic header.
    expect(bytes(streamAckCommand(0x1f))).toEqual([0x00, 0x00, 0x00, 0x00, 0x1f]);
    expect(bytes(streamAckCommand(0x07))).toEqual([0x00, 0x00, 0x00, 0x00, 0x07]);
    expect(STREAM_ACK_INTERVAL).toBe(8);
  });

  it("looks for the name a PS-3211 advertises", () => {
    expect(VOLTAGE_SENSOR_ADVERTISED_NAME).toBe("Voltage");
  });

  it("calibrates with the datasheet line through (32768, 0 V) and (65536, full scale)", () => {
    expect(rawCountToVolts(RAW_ZERO_COUNT, VoltageRange.PLUS_MINUS_30V)).toBe(0);
    expect(rawCountToVolts(65536, VoltageRange.PLUS_MINUS_30V)).toBe(30);
    expect(rawCountToVolts(0, VoltageRange.PLUS_MINUS_30V)).toBe(-30);
    expect(rawCountToVolts(65536, VoltageRange.PLUS_MINUS_5V)).toBe(5);
    expect(rawCountToVolts(0, VoltageRange.PLUS_MINUS_5V)).toBe(-5);
    // A 1.5 V cell on each range.
    expect(rawCountToVolts(34406, VoltageRange.PLUS_MINUS_30V)).toBeCloseTo(1.5, 3);
    expect(rawCountToVolts(42598, VoltageRange.PLUS_MINUS_5V)).toBeCloseTo(1.5, 3);
  });

  it("reads the raw count unsigned, so the top bit is not a sign", () => {
    // 0x8000 is mid-scale (0 V), not -32768.
    expect(decodeVoltageNotification(new Uint8Array([0xc0, 0x00, 0x05, 0x00, 0x80]))).toBe(32768);
    expect(decodeVoltageNotification(new Uint8Array([0xc0, 0x00, 0x05, 0xff, 0xff]))).toBe(65535);
  });

  it("knows each range's full scale", () => {
    expect(fullScaleVolts(VoltageRange.PLUS_MINUS_5V)).toBe(5);
    expect(fullScaleVolts(VoltageRange.PLUS_MINUS_30V)).toBe(30);
  });

  it("flags the measured converter limits of each range as over range", () => {
    const { PLUS_MINUS_5V: r5, PLUS_MINUS_30V: r30 } = VoltageRange;
    // ±5 V: pinned at 65535 above +5 V, and at 140–160 below −5 V.
    expect(isRawCountAtLimit(65535, r5)).toBe(true);
    for (const raw of [140, 150, 160]) {
      expect(isRawCountAtLimit(raw, r5)).toBe(true);
    }
    // ±30 V: about 65400 at +31 V, and 280–295 at −31 V.
    expect(isRawCountAtLimit(65400, r30)).toBe(true);
    for (const raw of [280, 290, 295]) {
      expect(isRawCountAtLimit(raw, r30)).toBe(true);
    }
  });

  it("does not flag readings inside either range", () => {
    const rawFor = (volts: number, fullScale: number) => Math.round(RAW_ZERO_COUNT * (1 + volts / fullScale));
    for (const volts of [0, 4.9, -4.9, 1.5, -1.5]) {
      expect(isRawCountAtLimit(rawFor(volts, 5), VoltageRange.PLUS_MINUS_5V)).toBe(false);
    }
    for (const volts of [0, 29.5, -29.5, 12, -12]) {
      expect(isRawCountAtLimit(rawFor(volts, 30), VoltageRange.PLUS_MINUS_30V)).toBe(false);
    }
  });
});
