# MZ MIX SYSTEM

MZ MIX SYSTEM is the first native prototype of a role-aware plug-in ecology. Insert the same plug-in on individual tracks as **NODE** instances, then place one instance on a bus or master track and switch it to **CONDUCTOR**.

The initial goal is not automatic mastering. It is a conservative starting mix that protects the low end, allocates stereo width by role, and lets supporting parts yield when a more important part becomes active.

## Roles

- **FOUNDATION** — sub-bass, bass, low drones, and tonal anchors
- **RHYTHM** — kick, drums, percussion, and transient pulse
- **BODY** — guitar, piano, chords, pads, and harmonic support
- **FOCUS** — lead synth, vocal-like material, melody, and featured texture
- **AIR** — atmosphere, noise, reverb, field texture, and upper-space motion

## v0.1 behavior

Each NODE reports its activity, role, importance, effective width, mono-protection frequency, and current automatic yield amount to a fixed lock-free registry shared by all instances of the plug-in inside the host process.

The processing path currently provides:

1. Role-aware stereo-width defaults
2. Progressive low-frequency mono protection
3. Importance-aware automatic gain yielding
4. Special kick/bass and focus/support relationships
5. Gentle or firm automatic behavior
6. Full host automation and saved plug-in state
7. A CONDUCTOR view of all active NODE instances

Every automatic decision remains visible and overridable.

## Use in a DAW

1. Insert **MZ MIX SYSTEM** on each relevant track.
2. Leave each instance in **NODE** mode.
3. Select its role and importance from 1 to 5.
4. Choose AUTO, GENTLE, or FIRM behavior and optional manual width/mono policies.
5. Insert another instance on a bus or master track.
6. Switch that instance to **CONDUCTOR** and set the global automatic strength.

The CONDUCTOR instance is audio-transparent in v0.1. It publishes the global strength and displays the shared node field.

## Build

### macOS universal AU, VST3, and standalone

```bash
cmake -S native/mix-system -B native/mix-system/build -G Xcode \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0
cmake --build native/mix-system/build --config Release --target MZMixSystem_All
```

### Windows x64 VST3 and standalone

```powershell
cmake -S native/mix-system -B native/mix-system/build-windows `
  -G "Visual Studio 17 2022" -A x64
cmake --build native/mix-system/build-windows --config Release `
  --target MZMixSystem_All
```

## Prototype limitations

- Inter-instance communication currently uses process-local shared state. Hosts that sandbox every plug-in instance in a separate process may not expose all NODE instances to CONDUCTOR.
- v0.1 uses broad, smooth gain yielding. Frequency-selective masking relief and multiband interaction are planned next.
- Track names are not requested from the host yet; CONDUCTOR identifies instances by node number and role.
- Builds are unsigned development artifacts until the signing and distribution pipeline is established.
- The system provides guardrails, not universal mixing rules. Final creative decisions remain with the mixer.
