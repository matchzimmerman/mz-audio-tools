# MZCMG // SONIC LAB — Audio Safety Protocol

This document is the canonical safety review for every sound-generating tool in this repository.

It applies to synthesizers, sequencers, samplers, effects, feedback systems, generative instruments, collision/physics audio, procedural sound, and any prototype that can create or amplify audio.

## Core rule

No audio-generating build is complete until its full signal path has been reviewed against this document.

Frequency filtering alone does not guarantee hearing safety. Risk depends primarily on sound pressure level, peak level, spectral content, playback hardware, and exposure duration. Browser audio code cannot know the actual SPL at a listener's ear, so these rules are engineering guardrails, not a guarantee of safe listening.

## Mandatory output architecture

All generated audio must pass through a shared master safety chain before reaching `AudioContext.destination`.

Do not connect oscillators, samplers, filters, delay returns, collision voices, or feedback nodes directly to the destination.

Recommended order:

`source/voice -> local voice gain/filter -> mix bus -> high-pass -> low-pass -> limiter/compressor -> conservative master gain -> destination`

## Frequency guardrails

Default master-band limits for experimental tools:

- High-pass filter: approximately 25–30 Hz.
- Low-pass filter: approximately 12–16 kHz.
- Do not intentionally generate sustained subsonic content below 20 Hz.
- Do not intentionally generate ultrasonic content above 18 kHz.
- Clamp oscillator and procedural-frequency parameters to an explicitly defined musical range.
- If a tool has a creative reason to extend beyond the default band, document the reason and keep the master safety filters in place.

Use sufficiently steep filtering for generators capable of producing strong out-of-band energy. Cascaded filters are appropriate when one biquad stage is not enough.

## Level and peak protection

Every tool must include all of the following where technically applicable:

- Conservative per-voice gain staging.
- Conservative master output gain; do not initialize at full-scale output.
- A final dynamics limiter or high-ratio compressor before the destination.
- Peak accumulation review for simultaneous notes, stacked collisions, dense random events, delays, reverbs, and feedback paths.
- Hard limits on polyphony/event density where uncontrolled summing is possible.
- Rate limiting or cooldowns for collision/event systems that can retrigger many voices in milliseconds.

A limiter is not permission to run the upstream graph excessively hot. Gain-stage first, limit second.

## Feedback safety

Any recursive or feedback audio path requires special review.

- Never allow an unconstrained feedback coefficient at or above unity.
- Clamp user-facing feedback controls below the instability point.
- Place gain control and filtering inside feedback loops.
- Consider a limiter inside the loop as well as on the master bus for experimental systems.
- Test maximum feedback, resonance, regeneration, and delay settings before release.

## Procedural and generative systems

Generative systems must be reviewed for worst-case behavior, not only typical behavior.

Check:

- maximum simultaneous voices
- maximum collision/event rate
- maximum random velocity/amplitude
- maximum resonance/Q
- minimum and maximum generated frequencies
- cumulative gain from multiple buses
- pathological random states
- long-running behavior

If a random system can eventually create an unsafe state, cap the state in code rather than relying on probability.

## Interaction defaults

- Audio should begin only after a user gesture where required by the platform.
- Initial output should be conservative.
- Sudden parameter changes should be smoothed/ramped when they can create clicks or extreme transients.
- Reset/reseed/randomize actions must not bypass master protection.
- New voices added at runtime must route through the same safety chain.

## Listening and QA

During development:

- Start monitoring at low playback volume.
- Test through the meter/scope and code path before increasing listening level.
- Test maximum-density and maximum-energy states at reduced monitor volume.
- Do not use perceived loudness alone to judge safety; inaudible or barely audible low/high-frequency energy still belongs behind the master filters.
- Treat unexpected clicks, runaway resonance, sudden level jumps, or sustained limiter engagement as bugs to investigate.

## Required pre-completion checklist

Before declaring any audio-generating change complete, verify:

- [ ] Every audible source routes through the master safety chain.
- [ ] No source connects directly to `AudioContext.destination` unless it is the final protected master node.
- [ ] Master high-pass filtering is present.
- [ ] Master low-pass filtering is present.
- [ ] Generated frequencies are explicitly bounded.
- [ ] Per-voice levels are conservative.
- [ ] Final limiting/compression is present and configured.
- [ ] Master gain initializes below full output.
- [ ] Polyphony/event density is bounded where applicable.
- [ ] Feedback/resonance values are bounded where applicable.
- [ ] Random/generative worst cases have been considered.
- [ ] Sudden parameter changes are ramped where necessary.
- [ ] Maximum-energy behavior has been tested at low monitor volume.
- [ ] The implementation does not claim that software safeguards guarantee hearing safety.

## Completion note

Any handoff for an audio-generating build should include a compact safety line:

```text
Audio safety: PASS | NEEDS REVIEW
Band limits: <HPF> – <LPF>
Master protection: <limiter/compressor + master gain>
Density/feedback caps: <caps or n/a>
```

If the result is `NEEDS REVIEW`, do not describe the build as finished.
