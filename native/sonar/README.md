# MZ-05 SONAR — Stereo Spatial Sequencer

SONAR is a tempo-synchronised stereo spatial effect. A rotating sweep turns angle into perceived direction, radius into perceived distance, and sixteen sectors into musical time.

## First native version

- VST3, Audio Unit, and standalone targets
- stereo input and output
- Static, Orbit, and Sequence motion modes
- one, two, four, or eight-bar rotations
- four perceptual distance rings
- sixteen sequence sectors
- speaker and headphone playback profiles
- host automation and saved plug-in state
- universal Intel + Apple Silicon macOS development builds

## Interaction model

### Static

Click anywhere in the radar to place the track. Angle controls left/right/front/rear interpretation. Radius controls perceived distance.

### Orbit

The object follows the host-synchronised sweep. Click a ring to change orbit radius.

### Sequence

Click a sector and ring to place a position event. When the sweep enters that sector, the track glides to the event's angle and distance. Clicking the same cell again removes it.

Each of the sixteen steps is stored as an automatable `Off / Ring 1 / Ring 2 / Ring 3 / Ring 4` parameter.

## Distance model

Distance is not represented by reverb alone. The native DSP couples:

- level attenuation,
- high-frequency loss,
- transient compression,
- direct-to-reflected balance,
- early-reflection delay,
- stereo-width reduction,
- rear-field crossfeed and diffusion.

The result is intentionally a stereo illusion rather than an Atmos renderer.

## Build locally

Requirements:

- CMake 3.22+
- Xcode on macOS or Visual Studio on Windows
- Git access so CMake can fetch JUCE 8.0.15

```bash
cmake -S native/sonar -B native/sonar/build -G Xcode
cmake --build native/sonar/build --config Release --target Sonar_All
```

Build products appear under:

```text
native/sonar/build/Sonar_artefacts/Release/
```

## Development status

The first artifact is unsigned. Before a public release SONAR still needs listening review, host validation, macOS signing/notarisation, Windows builds, final gain staging, preset management, and a distribution-appropriate JUCE licence decision.
