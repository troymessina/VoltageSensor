# Credits — Voltage Sensor

A SceneryStack interface for the PASCO Wireless Voltage Sensor (PS-3211): a live
voltmeter, and a voltage-vs-time recorder with a zoomable graph.

## Upstream code

This app is derived from two OpenLyceum simulations, both licensed AGPL-3.0-or-later:

- [MotionSensor](https://github.com/OpenLyceum/MotionSensor) — the project
  template and build configuration, the PASCO Web Bluetooth and WebUSB
  transports, the recording state machine and fixed-rate clock, the data table
  and CSV export, the connection and sensor-options panels, and the
  configurable graph in `src/common/view/graph/` (itself a copy-fork of the
  component in [ACPhasor](https://github.com/OpenLyceum/ACPhasor),
  [Resonance](https://github.com/OpenLyceum/Resonance) and
  [OscillationsAndChaos](https://github.com/OpenLyceum/OscillationsAndChaos)).
- [RadioactivityAndStatistics](https://github.com/OpenLyceum/RadioactivityAndStatistics)
  — the approach to the PASCO protocol, and the shared styling.

New here: the Meter screen and its voltmeter, the PS-3211 decoding and range
handling, the one shared sensor connection across both screens, and the
per-axis zoom buttons on the graph.

## Hardware support

The PS-3211's advertised name, sample layout, factory calibration and range
values are transcribed from the datasheet in
[PASCO's official Python library](https://github.com/PASCOscientific/pasco_python)
(`src/pasco/datasheets.py`, interface 1031 / sensor 2031).

This app is not affiliated with, endorsed by, or a product of PASCO Scientific.

## Artwork

All artwork — the voltmeter and the screen icons — is drawn programmatically.
There are no third-party images, sounds or fonts.
