/**
 * main.ts
 *
 * Entry point for the app. Initializes SceneryStack, creates the one sensor
 * connection both screens share, creates the screens, and starts the main
 * event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { SensorVoltageSource } from "./common/model/SensorVoltageSource.js";
import { StringManager } from "./i18n/StringManager.js";
import { MeterScreen } from "./meter/MeterScreen.js";
import { VoltageSensorPreferencesModel } from "./preferences/VoltageSensorPreferencesModel.js";
import { VoltageSensorPreferencesNode } from "./preferences/VoltageSensorPreferencesNode.js";
import voltageSensorQueryParameters from "./preferences/voltageSensorQueryParameters.js";
import { RecorderScreen } from "./recorder/RecorderScreen.js";
import VoltageSensorColors from "./VoltageSensorColors.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();

  // Simulation-specific preferences; initial values come from voltageSensorQueryParameters.
  const simPreferences = new VoltageSensorPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  // One sensor, one connection, for the life of the app. Both screens are views
  // of it: connect on either and both read, and a range or zero set on one is
  // the setting on the other.
  const usbBringUp = voltageSensorQueryParameters.usbBringUp;
  const source = new SensorVoltageSource({
    pollIntervalMs: voltageSensorQueryParameters.pollIntervalMs,
    streamingEnabled: voltageSensorQueryParameters.sensorStreaming,
    usbProbeOnly: usbBringUp === "probe" || usbBringUp === "probeAll",
    usbAcceptAllDevices: usbBringUp === "all" || usbBringUp === "probeAll",
    diagnosticsEnabledProperty: simPreferences.showDiagnosticsProperty,
    rangeScan: voltageSensorQueryParameters.rangeScan,
  });

  const screens = [
    new MeterScreen(source, simPreferences, {
      // The screen name Property updates automatically when the locale changes
      name: stringManager.getScreenNames().meterStringProperty,
      tandem: Tandem.ROOT.createTandem("meterScreen"),
      backgroundColorProperty: VoltageSensorColors.backgroundColorProperty,
    }),
    new RecorderScreen(source, simPreferences, {
      name: stringManager.getScreenNames().recorderStringProperty,
      tandem: Tandem.ROOT.createTandem("recorderScreen"),
      backgroundColorProperty: VoltageSensorColors.backgroundColorProperty,
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
    preferencesModel: new PreferencesModel({
      visualOptions: {
        // Adds a "Projector Mode" toggle in Preferences → Visual
        supportsProjectorMode: true,
        // Enables keyboard-navigation highlight outlines
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (tandem: Tandem) => new VoltageSensorPreferencesNode(simPreferences, tandem),
          },
        ],
      },
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
    }),

    credits: {
      softwareDevelopment: "Built on OpenLyceum's MotionSensor and RadioactivityAndStatistics",
    },
  });

  sim.start();
});
