# MZ MIX SYSTEM

MZ MIX SYSTEM is a native role-aware plug-in ecology. Insert the same plug-in on individual tracks as **NODE** instances, then place one instance on a bus or master track and switch it to **CONDUCTOR**.

The goal is not automatic mastering. It is a conservative starting mix that protects the low end, allocates stereo width by role, and lets supporting parts yield only where a more important part is currently competing.

## Roles

- **FOUNDATION** — sub-bass, bass, low drones, and tonal anchors
- **RHYTHM** — kick, drums, percussion, and transient pulse
- **BODY** — guitar, piano, chords, pads, and harmonic support
- **FOCUS** — lead synth, vocal-like material, melody, and featured texture
- **AIR** — atmosphere, noise, reverb, field texture, and upper-space motion

## v0.2 behavior

Each NODE reports its activity, role, importance, width, mono-protection frequency, and five-band spectral energy to a fixed lock-free registry shared by all instances inside the host process.

The five negotiation bands are:

1. **SUB** — centered around 60 Hz
2. **LOW** — centered around 180 Hz
3. **BODY** — centered around 700 Hz
4. **PRESENCE** — centered around 2.5 kHz
5. **AIR** — centered around 8 kHz

Higher-priority NODE activity creates smoothed, role-aware dynamic bell cuts in lower-priority NODE instances. This means BODY can make room around the actual active range of FOCUS without simply turning the whole supporting track down. FOUNDATION and RHYTHM negotiate mainly in the low bands, while AIR responds most strongly in presence and high-frequency space.

The processing path provides:

1. Five-band input telemetry
2. Frequency-selective spectral negotiation
3. Role-aware stereo-width defaults
4. Progressive low-frequency mono protection
5. A small amount of broad safety yielding
6. Special kick/bass and focus/support relationships
7. Gentle or firm automatic behavior
8. Full host automation and saved plug-in state
9. A CONDUCTOR view of all active NODE instances and their maximum carve

Every automatic decision remains visible and overridable. **Spectral Negotiation** can be reduced to 0% on any individual NODE.

## Use in a DAW

1. Insert **MZ MIX SYSTEM** on each relevant track.
2. Leave each instance in **NODE** mode.
3. Select its role and importance from 1 to 5.
4. Choose OFF, GENTLE, or FIRM automatic behavior.
5. Set **Spectral Negotiation** to control the maximum frequency-selective response.
6. Override width, mono protection, density, or output trim where needed.
7. Insert another instance on a bus or master track.
8. Switch that instance to **CONDUCTOR** and set the global automatic strength.

The CONDUCTOR instance is audio-transparent. It publishes the global strength and displays the shared node field.

## Build

### macOS universal AU, VST3, and standalone

```bash
cmake -S native/mix-system -B native/mix-system/build -G Xcode \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0
cmake --build native/mix-system/build --config Release --target MZMixSystem_All
```

### Windows x64 VST3 and standalone

Use the Visual Studio generator installed on the machine, or allow CMake to select the default generator:

```powershell
cmake -S native/mix-system -B native/mix-system/build-windows -A x64
cmake --build native/mix-system/build-windows --config Release `
  --target MZMixSystem_All
```

## Prototype limitations

- Inter-instance communication currently uses process-local shared state. Hosts that sandbox every plug-in instance in a separate process may not expose all NODE instances to CONDUCTOR.
- The five broad bands are intentionally conservative. This is not a surgical mastering equalizer.
- Track names are not requested from the host yet; CONDUCTOR identifies instances by node number and role.
- Builds are unsigned development artifacts until the signing and distribution pipeline is established.
- The system provides guardrails, not universal mixing rules. Final creative decisions remain with the mixer.
