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
- smooths all gain changes,
- performs only bounded loops across at most 32 instances.

The editor may allocate when it creates a CONDUCTOR snapshot because that work runs on the message thread.

## Signal flow

```text
TRACK AUDIO
   |
   +-- input activity analysis
   |
   +-- read role + importance
   |
   +-- inspect higher-priority active nodes
   |
   +-- calculate conservative yield request
   |
   +-- width allocation
   |
   +-- low-side mono protection
   |
   +-- smoothed gain yield + output trim
   |
   +-- publish telemetry
   |
OUTPUT
```

## Inter-instance registry

Each instance claims one of 32 process-local slots. A NODE publishes:

- role,
- importance,
- input RMS,
- current yield in dB,
- effective width,
- mono-protection frequency.

The CONDUCTOR publishes a single global automatic-strength value. NODE instances read that value and the telemetry of the other active slots once per audio block.

## Role relationships in v0.1

- BODY and AIR yield most strongly to FOCUS.
- FOUNDATION yields to RHYTHM when kick/drum priority is equal or higher.
- RHYTHM yields lightly to a higher-priority FOUNDATION.
- Lower-importance elements yield conservatively to higher-importance elements.
- FOCUS is protected from broad automatic movement unless another FOCUS node has higher priority.

## Planned v0.2

1. Three-band telemetry: low, presence, and air energy
2. Frequency-selective dynamic yielding instead of broad gain only
3. Host track-name discovery where available
4. Per-node freeze and override controls in CONDUCTOR
5. Audition-safe delta monitoring
6. Meter history and collision visualization
7. Optional named groups for multiple independent ecosystems in one session

## Planned v0.3+

- Separate FOUNDATION, RHYTHM, BODY, FOCUS, and AIR instruments built on the same protocol
- External IPC fallback for hosts that isolate instances in separate processes
- Preset families for acoustic, electronic, cinematic, and experimental arrangements
- Signed and notarized macOS distribution plus signed Windows installers
