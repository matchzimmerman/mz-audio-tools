# MZ Visual Engine — Prototype 01

A browser-native proof of concept for the proposed **MZ Visual Send + MZ Visual Engine** system.

## What works now

- Six simulated Visual Send lanes
- Separate audio-stem loading per lane
- Visual role assignment per track
- Per-track visual influence and mute controls
- Live microphone / mixer-feed analysis
- Five Organic Bit rendering scenes
- Fullscreen projector output
- Blackout, freeze, reseed, loop, and transport controls
- Real-time WebM canvas capture with mixed stem audio when supported by the browser

## Visual roles

- **Impact** — transients and pressure events
- **Mass** — sub/bass gravity and orbital motion
- **Form** — midrange cohesion and structure
- **Texture** — upper-mid/high-frequency turbulence
- **Atmosphere** — persistence, drift, and air
- **Master** — global system energy

## Product architecture represented by this prototype

```text
DAW TRACKS / MIXER CHANNELS
        ↓
MZ VISUAL SEND (future VST3/AU)
        ↓
MZ VISUAL ENGINE
        ↓
LIVE PROJECTOR / VIDEO CAPTURE
```

The browser prototype simulates plug-in instances using six stem lanes. A native version should preserve the same role-and-influence model while replacing stem uploads with IPC/OSC/network messages from VST3/AU instances.

## Important current limitation

The capture button records in real time to WebM. It is not yet a deterministic offline renderer, and this folder does not yet contain compiled VST3/AU binaries. The next native phase should use JUCE for plug-in and standalone targets and a dedicated frame-render/export pipeline.
