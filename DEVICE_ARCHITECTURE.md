# MZCMG // SONIC LAB — Device Architecture

Every SONIC LAB instrument is developed in two forms:

1. **Standalone** — the focused device by itself. This is the primary place to discover, test, and preserve the instrument's unique interaction model.
2. **Suite** — the integrated version of that device inside a larger compositional environment with shared transport, mixing, sends, routing, ghost layers, and other cross-device behaviors.

## Canonical route structure

```text
app/
  standalone/
    <device-name>/
      page.tsx
  suite/
    <suite-or-device-name>/
      page.tsx
```

Existing legacy routes may remain available so working prototypes and bookmarks are not broken. New development should use the canonical `standalone/` and `suite/` branches.

## Development rule

When a new instrument or interaction model is created:

- Build or preserve a **standalone version first**.
- Keep the standalone version focused on the core embodied/audio interaction.
- Create a **suite version** that integrates the instrument without erasing or replacing the standalone build.
- Do not overwrite an earlier standalone experiment to create a suite variation.
- Preserve especially successful interaction states as named/versioned builds when later changes could alter their character.

## Standalone responsibilities

Standalone builds should:

- expose the instrument's central interaction clearly
- minimize unrelated composition infrastructure
- remain independently playable and testable
- retain their own route even after integration into a suite
- follow `AUDIO_SAFETY.md`
- follow the repository visual and interaction protocols in `AGENTS.md`

## Suite responsibilities

Suite builds may add:

- shared transport and BPM
- persistent master controls
- shared sends and effects
- mixer views
- inter-device ghost layers or visual references
- composition/arrangement systems
- routing between instruments and effects
- shared key/scale state
- cross-device modulation or performance procedures

Suite integration must not require deleting or replacing the standalone device.

## Current mapping

```text
Standalone
  polar-sequencer   -> legacy /obas-polar-sequencer/
  sector-defense    -> legacy /obas-sector-defense/
  kinetic-field     -> legacy /obas-gravity-bass/

Suite
  polar-instrument  -> legacy /obas-polar-instrument/
```

The canonical nested routes may initially re-export the working legacy implementation. Over time, code can be factored into shared components so standalone and suite versions share core engines without becoming the same interface.

## Architectural principle

**Shared engine does not mean shared experience.**

Reusable audio, sequencing, safety, timing, and rendering logic may be extracted into common modules, but standalone and suite interfaces should remain free to evolve toward different interaction goals.
