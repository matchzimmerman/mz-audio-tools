# Repository Agent Protocol

This file is the shared operating contract for AI coding and design agents working in this repository.

## Instruction precedence

1. Follow the user's explicit request for the current task.
2. Preserve working behavior and intentional product decisions already in the repository.
3. Follow this protocol for implementation and aesthetic continuity.
4. Use `FIELD_SPECIMEN_STYLE_GUIDE.md` as the canonical visual reference.
5. For any audio-generating or audio-processing work, treat `AUDIO_SAFETY.md` as a mandatory completion requirement.

If the user explicitly requests another aesthetic, follow that request and document the intentional departure. Do not force Field Specimen styling onto nonvisual work.

## Canonical aesthetic

The default visual system for sound tools and related creative software in this repository is **Field Specimen**.

Before creating, redesigning, or reviewing an interface, read `FIELD_SPECIMEN_STYLE_GUIDE.md` completely. Do this before editing UI files. Do not rely on remembered summaries from earlier sessions.

The style guide is the source of truth for:

- palette and token values
- typography and hierarchy
- rules, spacing, geometry, and responsive behavior
- component and interaction recipes
- domain-specific naming and interface voice
- accessibility requirements
- retrofit levels and final review criteria

When this protocol and the style guide disagree, the more specific rule in the style guide wins.

## Aesthetic continuity contract

All Field Specimen interfaces must preserve these invariants unless the user asks otherwise:

- Warm bone paper is the primary surface.
- Near-black ink creates structure through type and rules.
- Acid yellow is reserved for activity, selection, focus, and indexed identifiers.
- Oxide red is reserved for recording, destructive actions, or critical faults.
- Display typography is oversized, heavy, and grotesk.
- Technical labels are concise, uppercase, monospaced, and tracked.
- Layout containers use square corners and continuous rules rather than floating cards.
- The primary working surface dominates the first viewport.
- Real product state supplies the telemetry and visual texture.
- Hardware-like controls are used only for genuine continuous or physical-feeling interactions.
- Every meter, preset, status light, scope, and control reports or changes real state.
- Keyboard, pointer, and touch interactions remain accessible and truthful.

Do not introduce rounded dashboard cards, soft container shadows, glassmorphism, decorative gradients, competing accent colors, fake telemetry, or generic sci-fi styling.

## Required design workflow

For every task that changes the visible product:

1. Read `FIELD_SPECIMEN_STYLE_GUIDE.md`.
2. Inspect the existing interface and reuse its tokens and components before adding new variants.
3. Choose the appropriate adoption level:
   - **Level 1 — Field accent:** token and state alignment without structural redesign.
   - **Level 2 — Instrument retrofit:** restructure cards, headers, and status areas while preserving information architecture.
   - **Level 3 — Full specimen system:** use for net-new builds or explicitly authorized redesigns.
4. Identify the primary working surface, live states, and direct-manipulation controls.
5. Map every visual state to real application state.
6. Implement responsive, keyboard, pointer, touch, focus, and reduced-motion behavior in the same pass.
7. Review the result against the checklist in the style guide before declaring it complete.

For an existing product, use the smallest adoption level that achieves continuity. Do not perform a broad reskin when the requested change is local.

## Mandatory audio-safety review

For every synthesizer, sequencer, sampler, effect, feedback system, generative instrument, physics/collision instrument, procedural audio experiment, or other feature that can create or amplify sound:

1. Read `AUDIO_SAFETY.md` completely before finalizing the audio graph.
2. Route all audible sources through a protected master safety chain.
3. Review frequency limits, gain staging, peak accumulation, event/polyphony density, feedback/resonance, and worst-case generative behavior.
4. Complete the checklist in `AUDIO_SAFETY.md` before describing the build as finished.
5. Report `Audio safety: PASS` or `Audio safety: NEEDS REVIEW` in the completion note.

This requirement applies even when audio safety is not mentioned in the current user request. Do not remove, bypass, or weaken an existing safety chain as part of unrelated feature work.

## Sound-tool requirements

For synthesizers, sequencers, samplers, effects, and generative instruments:

- Put the playable or observable surface before explanatory content.
- Preserve the conceptual module order: identity/transport → observation → voice/motion/environment → sequence/record → manual input.
- Give each macro control an audible and nonlinear mapping where appropriate.
- Keep output gain-staged and protected from runaway feedback or polyphony.
- Follow `AUDIO_SAFETY.md`; no sound tool is complete without its required safety review.
- Make presets load complete, audible states rather than changing labels alone.
- Make visual meters and scopes respond to the actual audio graph.
- Use acid yellow for active notes, current steps, selected models, and focus.
- Support direct performance through keyboard and touch when the platform allows it.
- Treat recording/export as a real workflow, never a decorative armed state.
- Prefer native, dependency-light audio primitives unless a library materially improves the instrument.

## New components and tokens

- Reuse existing Field Specimen tokens before creating new values.
- Add a new color only when it communicates a state the current palette cannot express.
- Add a new component variant only when an existing recipe cannot serve the interaction.
- Keep new names domain-specific and functional.
- If a reusable visual rule changes, update `FIELD_SPECIMEN_STYLE_GUIDE.md` in the same change.
- Product-specific values belong in product code; cross-product rules belong in the style guide.

## Multi-agent handoff

When delegating UI work to another agent, include this exact instruction in the task:

> Read `AGENTS.md` and `FIELD_SPECIMEN_STYLE_GUIDE.md` before editing. Preserve the Field Specimen continuity contract and report any intentional deviations.

When delegating audio-generating or audio-processing work, include this exact instruction as well:

> Read `AUDIO_SAFETY.md` before editing the audio graph. Preserve or add the protected master safety chain, complete the safety checklist, and report `Audio safety: PASS` or `Audio safety: NEEDS REVIEW`.

Agents working in parallel must not invent separate palettes, type systems, spacing systems, or names for the same component family. One agent should own shared token changes; other agents should consume them.

## Validation

Before completing a visual change:

- Run the repository's relevant lint, type, test, and production-build checks.
- Confirm essential text is readable and focus states are visible.
- Confirm interactive targets are appropriately sized.
- Confirm mobile layouts feel re-racked rather than merely compressed.
- Confirm active yellow, danger red, and muted metadata follow their semantic roles.
- Confirm no technical-looking element is fabricated.
- Confirm existing product behavior remains intact unless replacement was requested.

Before completing any audio-generating or audio-processing change:

- Complete the `AUDIO_SAFETY.md` pre-completion checklist.
- Confirm every audible source reaches the destination only through the protected master chain.
- Confirm frequency, level, density, resonance, and feedback limits remain bounded.
- Test maximum-energy behavior at low monitoring volume.

## Completion report

In the final handoff or pull-request summary, include a compact continuity note:

```text
Field Specimen: Level 1 | Level 2 | Level 3
Reused: <tokens/components preserved>
Added: <new reusable patterns, if any>
Deviations: none | <intentional departure and reason>
Validated: <checks performed>
```

For audio-generating work, append:

```text
Audio safety: PASS | NEEDS REVIEW
Band limits: <HPF> – <LPF>
Master protection: <limiter/compressor + master gain>
Density/feedback caps: <caps or n/a>
```

Keep these notes factual. They are continuity and safety audits, not marketing copy.
