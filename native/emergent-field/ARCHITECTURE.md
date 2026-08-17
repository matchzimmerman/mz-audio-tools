# MZ EMERGENT FIELD — Architecture

## Intent

EMERGENT FIELD is not a randomizer placed in front of a synthesizer. Composition, orchestration, stereo placement, and mix behavior share one bounded real-time system so each generated stream can respond to the state created by the others.

## Signal model

```text
HOST CLOCK / FREE CLOCK
        |
        +-- SECTION ENGINE
        |      long-form stream prominence + density bias
        |
        +-- EVENT ENGINE
        |      six coupled probabilistic generators
        |      pitch + timing + envelope + pan targets
        |
        +-- RAW STREAMS
        |      FOUNDATION / BODY / PULSE / FOCUS / GRAIN / AIR
        |
        +-- STREAM ENERGY FOLLOWERS
        |
        +-- SPECTRAL-ROLE NEGOTIATION
        |      pairwise overlap matrix
        |      priority + duckability
        |      fast attack / slower release
        |
        +-- ADAPTIVE DENSITY FEEDBACK
        |      aggregate pressure reduces future event probability
        |
        +-- SPATIAL FIELD
        |      stream-specific width limits
        |      candidate pan selection avoids crowding
        |      slow continuous drift
        |
        +-- SHARED SPACE
        |
        +-- OUTPUT PROTECTION
        |
      STEREO OUT
```

## Why the sidechain system is internal

Each stream has a known broad spectral territory and a continuously measured energy envelope. A fixed pairwise overlap matrix describes how strongly two territories can mask one another. Higher-pressure streams request more space; receiving streams respond according to their own duckability. The result is equivalent to a network of musically weighted internal sidechains without requiring users to create routing manually.

SELF MIX controls both the depth of this negotiation and the strength of adaptive thinning. At high field pressure the engine does not only turn things down: it also schedules fewer future events, allowing the arrangement itself to breathe.

## Form and emergence

A separate section engine changes stream prominence over spans measured in beats. One stream may become focal, several may recede, and the requested density can rise or fall. Event generators operate inside that changing field, so local randomness occurs inside a slower evolving form.

ENTROPY changes the amount of timing, pitch, pan, and sectional variance. DENSITY and ENERGY remain user-facing attractors rather than literal fixed values; the adaptive system is allowed to move around them.

## Stereo field

Each stream has a different maximum width. FOUNDATION remains close to center; upper and transient material can occupy wider territory. When a new pan target is chosen, several candidates are evaluated against the current positions of the other streams and the least-crowded candidate wins. A slow per-stream drift is added afterward.

This keeps stereo motion generative while reducing the common failure mode where several independently modulated voices randomly collapse onto the same side.

## Real-time constraints

The audio thread uses fixed arrays and bounded loops only. It performs no file I/O, networking, locks, heap allocation, or dynamic container growth. Telemetry crosses to the editor through atomics.

## Future extensions

1. Optional multi-output stems for Ableton routing and recording
2. External sidechain input that can make the entire field yield to drums, voice, or another track
3. Per-stream freeze, solo, bias, and spectral-role editing
4. MIDI-note steering of root, density, or mutation
5. Capture/export of deterministic seeds and generated sections
6. Deeper spectral negotiation using the same five-band territories as MZ MIX SYSTEM
