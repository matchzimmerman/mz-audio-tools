# MZ-04 COASTS — Native Plug-in Foundation

This directory ports the browser instrument at `/coasts/` into a native JUCE audio plug-in while leaving the public web version intact.

## Initial targets

- VST3 — macOS and Windows-capable project target
- Audio Unit — macOS
- Standalone application — macOS and Windows-capable project target

The included GitHub Actions workflow currently produces an **unsigned universal macOS development build** containing VST3, AU, and standalone bundles.

## Signal paths

### East Coast

```text
VCO 1 + VCO 2 → equal-power balance → low-pass filter ×2 → VCA
                                      ↘ filter contour
```

Parameters:

- oscillator 1 waveform
- oscillator 2 waveform
- detune
- balance
- cutoff
- resonance
- filter-envelope amount
- attack, decay, sustain, release

### West Coast

```text
modulator → carrier FM → nonlinear wavefolder → low-pass gate contour
```

Parameters:

- modulation ratio
- FM index
- fold
- symmetry
- uncertainty
- rise
- fall
- one-shot/cycling function
- color
- ring

The first release intentionally matches the browser instrument's **monophonic** behavior. MIDI note velocity acts as expression in the West Coast signal path.

## Build locally

Requirements:

- CMake 3.22 or newer
- Xcode on macOS, or Visual Studio on Windows
- Git access so CMake can fetch the pinned JUCE dependency

### macOS

```bash
cmake -S native/coasts -B native/coasts/build -G Xcode
cmake --build native/coasts/build --config Release --target Coasts_All
```

Build products appear under:

```text
native/coasts/build/Coasts_artefacts/Release/
```

## Distribution status

The CI artifacts are unsigned development builds. Before public release, the project still needs:

1. listening and gain-staging review against the browser version,
2. plug-in validation in Ableton Live, Logic Pro, and REAPER,
3. macOS Developer ID signing and notarization,
4. Windows build and installer work,
5. factory preset management,
6. a final JUCE licensing decision appropriate to distribution and revenue.

JUCE is currently pinned to `8.0.15` for reproducible foundation builds. The framework version and licence should be reviewed before commercial distribution.

## Interface continuity

```text
Field Specimen: Level 3
Reused: bone paper, near-black ink, acid-yellow live state, ruled modules, numbered subsystem headers, real output trace
Added: native rotary control and DAW parameter attachments
Deviations: none
Validated: macOS CI build pending
```
