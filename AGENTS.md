# AGENTS.md — Voltage Sensor

Context for AI assistants and new contributors.

## Project

A web interface for the PASCO Wireless Voltage Sensor (PS-3211), reached over
Web Bluetooth or WebUSB. It has two screens that share one sensor connection:
**Meter** (a live needle dial and digital readout) and **Voltage vs Time** (a
fixed-rate recorder with a zoomable graph, a data table and CSV export).

Derived from OpenLyceum's MotionSensor; the architecture and its rationale are
in [`doc/implementation-notes.md`](doc/implementation-notes.md). Read it before
changing model or hardware code.

## Key files

| File | Purpose |
|---|---|
| `src/main.ts` | Creates the **one** `SensorVoltageSource` and hands it to both screens |
| `src/VoltageSensorConstants.ts` | Rates, caps, poll period, layout, meter proportions |
| `src/common/model/hardware/PascoVoltageProtocol.ts` | PS-3211 packets, range values, `rawCountToVolts` (pure, tested) |
| `src/common/model/hardware/BluetoothVoltageSensor.ts` / `UsbVoltageSensor.ts` | The two transports behind `TVoltageSensorDevice` |
| `src/common/model/SensorVoltageSource.ts` | The link: connect, continuous sampling, range command, zero / sign |
| `src/common/model/VoltageSource.ts` | `TVoltageSource` — the seam the recorder reads through |
| `src/common/model/VoltageRecorderModel.ts` | Recording state machine and fixed-rate clock |
| `src/recorder/model/RecorderModel.ts` | Drives that clock from `stepTimer`, so recording survives a screen switch |
| `src/common/view/VoltmeterNode.ts` | The Meter screen's dial + digital readout |
| `src/common/view/graph/` | `ConfigurableGraph` (copy-fork; per-axis zoom buttons added here) |
| `src/common/view/SensorPanel.ts` / `SensorOptionsPanel.ts` | Connection and measurement settings, shown on both screens |
| `src/recorder/view/RecorderScreenView.ts` | Graph, table, record controls, panels |
| `src/meter/view/MeterScreenView.ts` | Voltmeter, panels |

## Things that will bite

- **There is one source, owned by `main.ts`.** Screen models borrow it and must
  never dispose it. A setting changed on one screen is the setting on the other
  by construction — do not give a screen its own source.
- **The source samples whenever it is connected**, not only while recording:
  the Meter has no Record button. A recording calls `beginRun()` / `endRun()`
  only, which reset `hasFreshReading()` (so t = 0 is a reading taken after
  Record) and arm zero-at-start.
- **The range is both a device command and the calibration.** The raw count is
  unsigned 16-bit; `volts = (raw − 32768) / 32768 × fullScale`. Sending the
  wrong range, or decoding with the wrong one, is a silent ×3 error. If the
  device refuses the command, `rangeCommandFailedProperty` turns on a warning.
  The range values (`pm5v:1`, `pm15v:3`) come from the datasheet; the
  `SET_RANGE` opcode framing came from MotionSensor and is **not yet verified on
  a PS-3211**.
- **A range change halts sampling around the command** (and awaits the stream
  stop over USB) because the link cannot interleave a stream and a command.
- **Both pickers need a user gesture.** `requestDevice()` must be reached
  synchronously from a Connect button — do not add an `await` ahead of it.
- **`connect()` never rejects.** Outcomes land on Properties. A dismissed picker
  is not an error.
- **Never accumulate recording time in a float.** Sample times are
  `index × period`; tests pin it.
- **The recording rate is captured at Record**, never read per tick.
- **Joist only steps the visible screen.** `RecorderModel` runs its clock from
  `stepTimer` instead; keep it that way or a recording freezes when the student
  looks at the Meter.
- **`common/` must not import from `meter/` or `recorder/`** (dependency-cruiser).
- **`dispose()` must stay idempotent** — the memory-leak suite disposes twice.
- **`LocalizedString` suffixes every leaf key**: `axes.voltage` is
  `axes.voltageStringProperty`. Every key must exist in `strings_en/fr/es.json`
  (checked at compile time).

## Query parameters

| Parameter | Effect |
|---|---|
| `?showDiagnostics=true` | Shows the raw count and calibrated volts of every reading, logs them to the console |
| `?pollIntervalMs=20` | Sample period in ms (10–1000) — the poll period, or the device's own clock when streaming |
| `?sensorStreaming=false` | Force polling on USB, which otherwise streams |
| `?usbBringUp=probe` | Claim a USB device and report its descriptors without sending it anything |
| `?screens=1` / `?screens=2` | Open straight onto one screen (SceneryStack) |

## Testing

`npm test` runs the unit and memory-leak suites; the transport and everything
above it is tested against fakes because no CI can hold a sensor. The fuzz
smoke (`npm run test:fuzz:quick`, or on Windows
`FUZZ_DURATION=10 npx playwright test --project=chromium tests/fuzz/`) builds
both screens in a real browser with assertions on.
