# MZ-05 VOX//TERM

VOX//TERM is a text-to-machine speech instrument for macOS. It converts a typed phrase into an internal speech buffer, then exposes that buffer as a MIDI-triggered AU, VST3, and standalone instrument.

## v0.1 signal path

1. Type up to 512 characters into the terminal buffer.
2. Choose a voice profile, speech rate, and speech pitch.
3. Press **SYNTHESIZE + TRANSMIT**.
4. Apple AVSpeechSynthesizer renders speech asynchronously outside the real-time audio thread.
5. The phrase is resampled to the host rate and stored as an internal mono buffer.
6. MIDI notes trigger the buffer through the VOX//TERM machine chain.

Machine controls include playback rate, bit depth, sample hold, ring carrier, transmission noise, low-pass filtering, saturation, voltage drift, playback mode, and output level.

## Build

```bash
cmake -S native/voxterm -B native/voxterm/build -G Xcode \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0
cmake --build native/voxterm/build --config Release --target VoxTerm_All
```

The GitHub Actions workflow produces unsigned universal macOS development builds:

- `MZ-05 VOX//TERM.app`
- `MZ-05 VOX//TERM.component`
- `MZ-05 VOX//TERM.vst3`

## Prototype limitations

- v0.1 uses installed Apple English speech voices and is therefore macOS-only.
- Voice rate, pitch, and profile are applied when the phrase is synthesized; press TRANSMIT again after changing them.
- The typed phrase is saved with plug-in state, but the rendered audio buffer is regenerated rather than embedded in the DAW project.
- Builds are unsigned until the distribution/signing pipeline is established.
