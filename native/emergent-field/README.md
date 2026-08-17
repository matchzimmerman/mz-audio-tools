# MZ EMERGENT FIELD

A native generative instrument for Ableton Live and other AU/VST3 hosts.

EMERGENT FIELD composes from six continuously interacting internal streams. The streams do not simply stack. They observe one another, make room according to their spectral roles, reduce event density when the field becomes crowded, and distribute themselves across a slowly changing stereo image.

## First-build behavior

- six generative streams: FOUNDATION, BODY, PULSE, FOCUS, GRAIN, AIR
- host-tempo-aware event generation with a free-running option
- tonal generation from selectable root and mode
- section-level evolution that changes density and stream prominence over time
- internal frequency-aware sidechain negotiation between streams
- adaptive density reduction as aggregate mix pressure rises
- automatically distributed stereo positions with slow drift and collision avoidance
- stereo ambience and protected output stage
- one-click field mutation without requiring transport restart
- live telemetry for stream energy, pan position, ducking, aggregate pressure, and effective density

## Macro controls

- **DENSITY** — how populated the field wants to become
- **ENTROPY** — timing, pitch, and sectional unpredictability
- **ENERGY** — event amplitude and sustain tendency
- **MOTION** — speed and depth of stereo movement
- **SPREAD** — available stereo territory
- **SELF MIX** — strength of internal sidechain negotiation and adaptive thinning
- **SPACE** — shared room/reverb amount
- **OUTPUT** — final gain
- **ROOT / MODE** — tonal field
- **CLOCK** — HOST or FREE

## Build

```bash
cmake -S native/emergent-field -B native/emergent-field/build
cmake --build native/emergent-field/build --config Release --target MZEmergentField_All
```

macOS builds AU, VST3, and standalone. Windows builds VST3 and standalone.

## Status

v0.1 is intentionally a single stereo instrument. The internal streams are mixed inside the plug-in so their negotiation can be coherent and sample-aware. Multi-output stem routing is a logical next step once the core generative behavior is musically validated.
