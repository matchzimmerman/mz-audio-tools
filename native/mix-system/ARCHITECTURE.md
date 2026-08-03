# MZ MIX SYSTEM — Architecture

## Product shape

One plug-in binary serves two interface modes:

- **NODE** processes an individual track and publishes telemetry.
- **CONDUCTOR** passes audio unchanged, publishes global behavior, and visualizes the connected node field.

Using one binary allows all instances loaded into the same host process to share a fixed registry without sockets, files, background services, or audio-thread locks.

## Real-time constraints

The audio thread:

- never allocates memory,
- never takes a mutex,
- never reads files,
- never performs network or IPC work,
- communicates through fixed-size atomic slots,
- smooths gain and spectral changes,
- performs only bounded loops across at most 32 instances and five spectral bands.

The editor may allocate when it creates a CONDUCTOR snapshot because that work runs on the message thread.

## v0.2 signal flow

```text
TRACK AUDIO
   |
   +-- five-band input analysis
   |      SUB / LOW / BODY / PRESENCE / AIR
   |
   +-- read role + importance
   |
   +-- inspect higher-priority active nodes
   |
   +-- calculate broad safety yield
   |
   +-- calculate per-band spectral yield requests
   |
   +-- smoothed five-band dynamic bell cuts
   |
   +-- width allocation
   |
   +-- low-side mono protection
   |
   +-- smoothed safety gain + output trim
   |
   +-- publish telemetry and active carve values
   |
OUTPUT
```

## Spectral analysis

The analyser uses four stateful one-pole low-pass filters at approximately 100 Hz, 300 Hz, 1.2 kHz, and 5 kHz. Differences between adjacent low-pass outputs form five broad energy estimates without FFT allocation or background work.

The shared bands are represented by broad negotiation filters centered at approximately:

- 60 Hz
- 180 Hz
- 700 Hz
- 2.5 kHz
- 8 kHz

These are intentionally wide musical territories, not surgical crossover bands.

## Spectral negotiation

Each NODE compares its role and importance with the other active NODE instances. A higher-priority active node produces a request in the bands where it currently has energy. The receiving node scales those requests through a role-specific sensitivity profile.

Examples:

- BODY responds strongly in the body and presence bands when FOCUS becomes active.
- FOUNDATION responds primarily in sub and low bands when RHYTHM has equal or greater priority.
- AIR responds most strongly in presence and air.
- FOCUS remains comparatively protected unless another FOCUS node has higher priority.

Five custom transposed-direct-form biquads apply smoothed bell attenuation. Coefficients are calculated in place and do not allocate on the audio thread.

## Inter-instance registry

Each instance claims one of 32 process-local slots. A NODE publishes:

- role,
- importance,
- input RMS,
- five-band energy,
- current broad yield in dB,
- five current spectral carve values,
- effective width,
- mono-protection frequency.

The CONDUCTOR publishes a single global automatic-strength value. NODE instances read that value and the telemetry of the other active slots once per audio block.

## Current boundaries

- Communication is process-local; isolated plug-in processes require a future IPC fallback.
- Five broad bands prioritize stability and musical transparency over surgical resolution.
- CONDUCTOR observes and controls global strength but does not yet issue per-node overrides.
- Host track names are not currently requested.

## Planned v0.3

1. Per-node freeze, bypass, and override controls in CONDUCTOR
2. Audition-safe delta monitoring
3. Collision history and spectral-pressure visualization
4. Named groups for multiple independent ecosystems in one session
5. Host track-name discovery where available
6. Attack/release character controls and role-specific presets

## Planned v0.4+

- Separate FOUNDATION, RHYTHM, BODY, FOCUS, and AIR instruments built on the same protocol
- External IPC fallback for hosts that isolate instances in separate processes
- Preset families for acoustic, electronic, cinematic, and experimental arrangements
- Signed and notarized macOS distribution plus signed Windows installers
