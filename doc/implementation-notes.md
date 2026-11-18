# Implementation notes — Voltage Sensor

Architecture, the decisions behind it, and the things that will bite.

## Shape of the app

```
src/
  init.ts assert.ts splash.ts brand.ts main.ts   ← bootstrap chain, do not reorder
  VoltageSensorColors.ts VoltageSensorConstants.ts VoltageSensorNamespace.ts
  i18n/            StringManager.ts + strings_{en,es,fr}.json
  preferences/     model, node, voltageSensorQueryParameters.ts
  common/
    model/         SensorVoltageSource, VoltageRecorderModel, Trace, measurement math
      hardware/    PASCO protocol + Bluetooth and USB transports
    view/          graph/, data table, record control, panels, VoltmeterNode
  meter/           MeterScreen + MeterModel + view
  recorder/        RecorderScreen + RecorderModel + view
```

## One sensor, two screens

`main.ts` constructs a single `SensorVoltageSource` and passes it to both
screens. Neither screen model owns it or disposes it. This is the whole reason
the two screens agree: connecting on the Meter connects the recorder, and a
range or zero offset set on either screen is the setting on both, because there
is only one Property for each.

The connection and sensor-options panels are instantiated once per screen,
bound to the same source.

## The source samples continuously

MotionSensor silences its ultrasonic transducer between recordings and samples
only while recording. A voltmeter cannot work that way: the Meter screen has no
Record button and must read live. So `SensorVoltageSource` starts sampling the
moment a connection is made and stops when it is dropped.

A recording interacts with the source through two calls on the `TVoltageSource`
seam:

- `beginRun()` clears `hasFreshReading()` and arms zero-at-start. The recorder's
  t = 0 waits for the first reading taken after Record, not the last reading
  the meter happened to show.
- `endRun()` disarms zero-at-start and clears `runInProgressProperty`, which
  locks the adjustments in both screens' options panels while a run is going.

Over Bluetooth every reading is one `READ_ONE_SAMPLE` round trip, polled every
`DEFAULT_POLL_INTERVAL_MS` (20 ms). A poll still in flight when the next tick
fires is skipped rather than queued. Over USB the device is put on its own clock
(`START_SAMPLING`) and streams. If the stream says nothing within a second, the
source falls back to polling. If a stream that was working goes quiet, the link
is declared lost.

## The PS-3211 on the wire

From PASCO's datasheet (`pasco_python/src/pasco/datasheets.py`):

| | |
|---|---|
| Advertised name | `Voltage` (interface 1031) |
| Channel | one, sensor 2031, GATT service 1 |
| Sample | `RawVoltage`, 2 bytes, unsigned little-endian |
| Calibration | `FactoryCal` through (32768, 0 V) and (65536, ±full scale) |
| Ranges | `pm5v:1`, `pm15v:3` (PS-3211). On the PS-3211A, 1 → ±5 V works; ±30 V can only be set in PASCO software |

The packet layer (UUID scheme, `READ_ONE_SAMPLE`, the result arriving on device
service 0, streaming, and the USB envelope) is identical across PASCO's
wireless sensors. It is carried over unchanged from MotionSensor, where it was
verified on a PS-3219.

### The range

The datasheet describes the original PS-3211. Its `Voltage` measurement is a
`Select` between the ±5 V and ±15 V calibrations, chosen by the range. The
PS-3211A that this app targets reads ±30 V. pasco_python always picks the first input
(±5 V) and never sends a range, so it cannot be followed blindly here. This app
instead:

1. sends `SET_RANGE` (`[0x28, 0x00, 0x00, 1]`) when ±5 V is chosen, on connect
   and on every change to it, halting sampling around the command. ±30 V is
   never sent (see below);
2. decodes every raw count with the same range's calibration;
3. raises `rangeCommandFailedProperty` (and a visible warning) if the device
   does not acknowledge the command, because the decode is then only right if
   the device happens to be on the chosen range;
4. raises `overRangeProperty` when the raw count reaches the converter limits
   measured for that range (`OVER_RANGE_LIMITS`: the negative end stops near
   150 on ±5 V and 290 on ±30 V, not at 0). A pinned reading is otherwise
   indistinguishable from an ordinary 5.000 V.

Hardware results on a PS-3211A:

| What was tried | Result |
|---|---|
| Command 1, decoded as ±5 V | Accepted; reads correctly |
| Command 3, decoded as ±15 V (the original datasheet) | Command refused; reads wrong |
| Command 3, decoded as ±30 V | Command refused; sensor still on ±5 V, so reads 6× high |
| Sensor set to 30 V in PASCO Capstone, decoded as ±30 V | Reads correctly |

The sensor's range cannot be raised to ±30 V from code, so the app never sends
a ±30 V command (`canCommandRange`). Choosing ±30 V changes only the decode,
and a note under the range menu tells the user to set the sensor's range in
PASCO software to match. Because the ±30 V command is not sent, the yellow
"did not confirm" warning no longer appears for it. The app can still lower the
sensor to ±5 V, so choosing ±5 V and then ±30 V again requires setting the
sensor back to 30 V in PASCO software. The note says this: "This app can switch
the sensor to ±5 V, but not to ±30 V."

### What the device reading goes through

```
raw count ─▶ volts (range calibration) ─▶ − zero offset ─▶ × sign ─▶ published
```

`adjustReading` in `voltageMeasurement.ts` is pure and tested. The offset is
stored in volts, so it survives a range change. Diagnostics report the raw count
and the calibrated volts, before any adjustment.

## The recorder

`VoltageRecorderModel` is MotionSensor's model without the derivative chain: a
READY → RECORDING → STOPPED state machine, a fixed-timestep accumulator at the
student's chosen rate (captured at Record), and sample times computed as
`index × period`, never a float that is added to on every tick. `sampleEmitter`
fires once per sample, and the graph is fed from it rather than from the frame
loop.

A recording stops itself at `MAX_RECORD_DURATION_S` (600 s) or
`MAX_RECORDED_SAMPLES` (6000), whichever comes first.

Joist only steps the selected screen's model, so `RecorderModel` drives the
clock from the global `stepTimer` instead and makes its own `step()` a no-op.
Without that, a student who glanced at the Meter mid-run would come back to a
recording whose clock had frozen while real time went on.

## The graph

`src/common/view/graph/` is a copy-fork of MotionSensor's `ConfigurableGraph`.
There are three changes:

- **Per-axis zoom buttons** (↔+ ↔− ↕+ ↕−), backed by
  `GraphInteractionHandler.zoomAxis()`. The wheel-over-axis and drag-axis
  gestures already existed; the buttons make per-axis zoom discoverable, and
  reachable by keyboard.
- **Button zoom and pan turn auto-rescaling off**, as the pointer gestures
  already did. Upstream left it on, which undoes a zoom at the next data point:
  harmless when a graph is redrawn every frame, useless while recording. The ↻
  button turns auto-rescaling back on.
- **Toolbar glyphs use the text colour.** Upstream drew them in the panel-border
  colour, which is nearly invisible on the dark panel fill.

## Things that will bite

See [AGENTS.md](../AGENTS.md#things-that-will-bite). In short: there is one
source and nobody but `main.ts` owns it; pickers need a synchronous user
gesture; `connect()` never rejects; never add to a float clock; `common/` never
imports a screen package; `dispose()` is idempotent.
