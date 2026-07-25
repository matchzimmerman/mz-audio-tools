# Field Specimen Interface System

Version 1.0  
Origin: Magpie Avian Signal Synthesizer  
Use: websites, creative tools, dashboards, utilities, installations, portfolios, archives, and retrofits of existing products

## 1. The idea

Field Specimen is an editorial interface language that makes software feel like a precise physical instrument found in a research station.

It combines:

- Swiss editorial composition
- scientific field-note typography
- analog control-panel geometry
- warm archival paper
- stark black technical ink
- one high-energy fluorescent signal color

The result should feel intelligent, tactile, slightly eccentric, and highly legible. It is not nostalgia for its own sake. The visual language should make the product's state, structure, and controls easier to understand.

> The interface is a working instrument first and an aesthetic object second.

## 2. Core principles

| Principle | Rule |
|---|---|
| Instrument, not dashboard | Organize the product into named functional modules instead of generic cards. |
| Warm field material | Use a bone-paper ground rather than pure white. |
| Ink creates structure | Let rules, dividers, labels, and type define the layout. Avoid container shadows. |
| Fluorescence means activity | Reserve acid yellow for selections, live states, focus, and numbered identifiers. |
| Information is ornament | Use measurements, coordinates, status labels, timestamps, and specimen codes as visual texture. |
| Tactility is earned | Use dimensional treatment only for controls that genuinely behave like hardware. |
| Controlled eccentricity | Pair strict grids with one unusual move: an oversized title, vertical plate, crosshair, scope, or indexed strip. |
| Every affordance is truthful | If something resembles a control, meter, preset, or status light, it must work and reflect real state. |

## 3. Signature at a glance

| Element | Field Specimen treatment |
|---|---|
| Background | Warm bone paper |
| Primary text and rules | Near-black charcoal |
| Active color | Fluorescent acid yellow |
| Secondary text | Warm gray |
| Error/record color | Oxide red, used sparingly |
| Display type | Oversized, heavy grotesk |
| Technical type | Bold monospace, uppercase, tracked |
| Containers | Square corners, 1–2 px rules, little or no fill |
| Spacing | Tight inside modules; generous between major observations |
| Motion | Fast, mechanical, state-driven |
| Imagery | Rare; prefer live data, diagrams, scopes, and CSS geometry |

## 4. Color system

### Primary palette

| Token | Value | Purpose |
|---|---:|---|
| `--fs-paper` | `#EEE9DC` | Main application surface |
| `--fs-paper-deep` | `#D5D0C4` | Outer canvas or page surround |
| `--fs-paper-light` | `#FAF6EB` | Raised keys, editable areas, subtle contrast |
| `--fs-ink` | `#1D1D1B` | Text, borders, icons, active bars |
| `--fs-signal` | `#DFFF00` | Selection, focus, live data, section indices |
| `--fs-muted` | `#77756E` | Metadata and secondary labels |
| `--fs-line` | `rgba(29, 29, 27, 0.32)` | Internal dividers and grids |
| `--fs-danger` | `#B82618` | Recording, destructive actions, critical faults |

### Usage ratios

- Paper: 70–85%
- Ink: 12–25%
- Signal yellow: 2–5%
- Red: less than 1%

Signal yellow loses meaning when it becomes decoration. A large yellow area must indicate a selected mode, active sequence, live measurement, focus target, or primary action.

### Contrast and color behavior

- Body text uses ink on paper.
- Small metadata uses muted gray only when it remains readable.
- Yellow state fills retain black text.
- Red should be paired with text or a shape; never rely on red alone.
- Do not create pastel variations of the palette. Use opacity of ink for quieter hierarchy.

## 5. Typography

### Font roles

Use two typographic voices:

1. **Grotesk display and headings** — Arial, Helvetica, or a similarly sturdy neo-grotesk.
2. **Monospaced telemetry** — the system monospace stack or a restrained technical mono.

Recommended stacks:

```css
--fs-font-display: Arial, Helvetica, sans-serif;
--fs-font-data: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

Avoid decorative retro fonts. The period character comes from the composition, not from novelty typography.

### Type scale

| Role | Suggested size | Weight | Tracking | Case |
|---|---:|---:|---:|---|
| Product mark | `clamp(48px, 6.2vw, 92px)` | 900 | `-0.075em` | Uppercase |
| Module heading | 17–22 px | 800–900 | `-0.03em` | Uppercase |
| Primary readout | 13–20 px | 700–800 | 0 | Usually uppercase |
| Control label | 9–11 px | 700–800 | `0.06em–0.10em` | Uppercase |
| Metadata | 8–10 px | 700 | `0.08em–0.16em` | Uppercase |
| Decorative telemetry | 7–8 px | 700 | `0.08em` | Uppercase |

Seven-pixel text is appropriate only for nonessential decorative telemetry. Instructions, controls, and required information should generally be at least 9–10 px, preferably larger.

### Typographic behavior

- Use strong weight contrast more than size contrast.
- Keep labels terse: `FIELD TAKE`, `OBSERVATION 02`, `SYSTEM ONLINE`.
- Use slashes, middots, em dashes, arrows, numbers, and units as structural punctuation.
- Set prose in sentence case. Set interface nomenclature in uppercase.
- Use tabular figures for measurements and timers when available.

## 6. Geometry and spacing

### Shape language

- Default corner radius: `0`
- Default rule: `1px solid var(--fs-ink)`
- Major rule: `1.5px–2px solid var(--fs-ink)`
- Internal divider: `1px solid var(--fs-line)`
- Circles are reserved for knobs, indicators, targets, and radial measurements.
- Shadows are generally prohibited on layout containers.
- A shallow inset rule may indicate current focus or transport position.

### Spacing rhythm

Use a compact 4 px base rhythm:

```text
4   micro separation
8   label/readout separation
12  control padding
16  module padding
24  major section separation
30  desktop page gutter
```

Suggested application frame:

```css
.fs-app {
  width: min(100%, 1720px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 24px 30px 14px;
}
```

Avoid stacking several padded containers inside one another. Borders and alignment should create grouping before background fills do.

## 7. Composition

### Page anatomy

A full Field Specimen interface commonly contains:

1. **Masthead** — oversized product mark, edition plate, compact purpose statement
2. **Transport or global actions** — aligned as a row of equal technical controls
3. **Primary observation** — the main visualization, editor, preview, canvas, map, or result
4. **Observation register** — a one-row strip of important live values
5. **Functional modules** — two to four numbered operating groups
6. **Sequence or record surface** — steps, rows, timeline, table, or activity log
7. **Manual input** — keyboard, command area, form, upload target, or direct manipulation surface
8. **Footer telemetry** — product family, capabilities, unit or version number

Not every build needs all eight. Preserve the hierarchy: identity → primary work → supporting controls → detailed records.

### Grid behavior

- Use rigid shared edges.
- Prefer two, three, five, eight, or sixteen repeated units where the content supports them.
- Let dividers span across adjacent modules to create a continuous instrument panel.
- Use narrow gaps, usually 5–8 px, for repeated controls.
- Use whitespace rather than rounded cards to separate major ideas.

## 8. Component recipes

### Masthead

- Place a 2 px rule above and below.
- Make the product name intentionally oversized and tightly tracked.
- Add one small vertical or boxed edition plate such as `MZ–02`, `UNIT 04`, or `REV–B`.
- Keep the subtitle technical and specific.

```text
[REV–B]  ATLAS
         SPATIAL RESEARCH CONSOLE
```

### Numbered module header

- Use a 22–26 px acid-yellow square.
- Pair it with a functional noun and a smaller technical description.
- Place a short subsystem code on the far edge.

```text
[03]  HABITAT                         HBT
      ACOUSTIC ENVIRONMENT
```

### Technical button

- Square corners
- 1–1.5 px ink border
- Transparent idle background
- Acid-yellow hover, active, or selected fill
- Uppercase monospaced label
- Minimum target: 44 × 44 px
- Transition: 100–160 ms

### Segmented mode strip

- Use one continuous outer border.
- Separate options with internal vertical rules.
- Show a primary name and an optional muted descriptor.
- Fill only the selected option with signal yellow.

### Observation register

- Use a single bordered strip divided into equal cells.
- Put a muted micro-label above a stronger value.
- Favor actual state: counts, frequency, status, time, mode, location, progress, or current operator choice.

```text
LATENCY       ACTIVE MODEL     ARCHIVE STATE
12 ms         FORMANT          SAVED / 04
```

### Primary observation surface

This is the hero of the product—not a marketing image.

Possible forms:

- waveform or spectrum
- live preview
- editing canvas
- map or spatial field
- large data plot
- document or asset under inspection
- primary form/result pair

Give it a major rule, subtle grid, sparse axes, and one status plate. If it is interactive, show a concise instruction directly on the surface.

### Knobs and tactile controls

Use hardware-like dimension only when a value is continuously adjustable. Include:

- tick marks
- a clear position indicator
- a numeric readout
- an accessible native input underneath
- keyboard and touch support

Do not use a knob for binary choices, navigation, or decoration.

### Tables, lists, and archives

- Use horizontal rules instead of floating rows.
- Keep the header monospaced, uppercase, and muted.
- Use a yellow left index or full-row fill for the current selection.
- Align measurements and dates consistently.
- Let status text remain explicit even when a status dot is present.

### Forms

- Labels sit above fields in small uppercase mono.
- Inputs use paper or paper-light backgrounds and ink borders.
- Use visible units next to numeric inputs.
- Helper text is brief and technical.
- Validation messages use oxide red plus plain-language text.

## 9. Interaction language

### State mapping

| State | Treatment |
|---|---|
| Idle | Paper background, ink border |
| Hover | Signal-yellow background or stronger bottom rule |
| Selected | Signal-yellow fill with ink text |
| Current position | 2–3 px inset ink rule |
| Focus | 3 px signal-yellow outline with 2 px offset |
| Recording/destructive | Oxide-red text, dot, or inset rule |
| Disabled | Reduced ink opacity, explicit label when necessary |
| Processing | Moving measurement or status text, not a decorative spinner alone |
| Success | State label such as `SAVED`, `ONLINE`, or `COMPLETE` |

### Interaction rules

- The product should respond immediately to direct manipulation.
- Use verbs that describe the domain: `FLY`, `CAPTURE`, `OBSERVE`, `INDEX`, `MUTATE`, `CALIBRATE`.
- Keep conventional meaning understandable through supporting labels or icons.
- Show keyboard shortcuts as telemetry, not as floating tooltip clutter.
- Preserve user state while changing layout across breakpoints.
- Use native HTML controls where possible and style them into the system.

## 10. Motion

Motion should resemble measurement, calibration, transport, or mechanical response.

Recommended:

- 100–160 ms state transitions
- stepped sequence movement
- crosshair or cursor tracking
- live scope traces
- subtle meter interpolation
- brief inset flashes on activation

Avoid:

- floating decorative particles
- springy card entrances
- slow cinematic fades
- parallax
- ornamental loading animation

Honor `prefers-reduced-motion`. A reduced-motion version should retain every status change through color, text, and position.

## 11. Data visualization

- Draw grids with low-opacity ink.
- Use ink for the principal trace and signal yellow for energy, selection, or secondary live data.
- Label axes sparingly in monospace.
- Put units directly beside values.
- Avoid rainbow scales unless the data genuinely requires one.
- Use a crosshair, target, or current-position rule to make interaction legible.
- Never fabricate telemetry purely to make the interface look technical.

## 12. Voice and naming

The writing should sound like a precise field technician with a poetic streak.

### Preferred vocabulary

```text
observation · specimen · field · signal · register · unit · station
capture · calibrate · trace · sequence · morphology · archive · live
```

Adapt the vocabulary to the product. A finance tool might use `LEDGER`, `POSITION`, and `SETTLEMENT`; a writing tool might use `DRAFT`, `PASSAGE`, and `REVISION`.

### Naming pattern

```text
PLAIN FUNCTION
TECHNICAL OR DOMAIN DESCRIPTION
```

Examples:

```text
VOICE
VOCAL MORPHOLOGY

ARCHIVE
CAPTURED OBSERVATIONS

ROUTE
ACTIVE DELIVERY PATH
```

Avoid fake military jargon, excessive serial numbers, or nonsense scientific terms. Specificity is more convincing than volume.

## 13. Imagery and texture

- Prefer typography, rules, data, and CSS geometry.
- When imagery is necessary, treat it like evidence: crop it cleanly, label it, index it, and place it within the grid.
- Use one image rather than a decorative gallery.
- Optional paper grain should be extremely subtle and must not reduce readability.
- Avoid glossy glass panels, neon glows, cartoon illustration, and generic 3D device renders.
- Gradients are permitted inside tactile controls or scientific plots, not as atmospheric page backgrounds.

## 14. Responsive behavior

### Desktop

- Preserve the continuous instrument-panel layout.
- Use three-column modules when each column can remain at least 260–320 px wide.
- Keep global transport visible near the masthead.

### Tablet

- Stack functional modules vertically.
- Collapse repeated registers into two columns.
- Keep horizontal sequences at eight units per row when practical.
- Preserve direct-manipulation surfaces at useful height.

### Mobile

- Reduce page gutters to approximately 15 px.
- Use a two-column transport grid.
- Stack observation registers into one column.
- Place sequences at four units per row.
- Keep controls at least 44 px high.
- Remove secondary helper text before shrinking essential labels below readable sizes.

Responsive adaptation should feel like the same instrument re-racked, not a different mobile theme.

## 15. Accessibility requirements

- Maintain WCAG AA contrast for functional text.
- Use semantic headings and landmarks.
- Give every control an accessible name.
- Ensure all interactions work with keyboard input.
- Provide a visible focus state using signal yellow.
- Pair status color with text or shape.
- Do not use microtype for essential instructions.
- Give pointer-driven canvases a keyboard-accessible alternative.
- Use `touch-action: none` only on true direct-manipulation surfaces.
- Keep motion optional and avoid rapid flashing.

## 16. Starter tokens

```css
:root {
  --fs-paper: #eee9dc;
  --fs-paper-deep: #d5d0c4;
  --fs-paper-light: #faf6eb;
  --fs-ink: #1d1d1b;
  --fs-signal: #dfff00;
  --fs-muted: #77756e;
  --fs-line: rgba(29, 29, 27, 0.32);
  --fs-danger: #b82618;

  --fs-font-display: Arial, Helvetica, sans-serif;
  --fs-font-data: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --fs-rule: 1px solid var(--fs-ink);
  --fs-rule-major: 2px solid var(--fs-ink);
  --fs-transition: 140ms ease;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--fs-paper);
  color: var(--fs-ink);
  font-family: var(--fs-font-display);
}

.fs-label {
  color: var(--fs-muted);
  font: 700 0.625rem/1.2 var(--fs-font-data);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fs-button {
  min-height: 44px;
  border: var(--fs-rule);
  border-radius: 0;
  background: transparent;
  color: var(--fs-ink);
  padding: 8px 12px;
  font: 800 0.6875rem/1 var(--fs-font-data);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: background var(--fs-transition);
}

.fs-button:hover,
.fs-button[aria-pressed="true"],
.fs-button[data-selected="true"] {
  background: var(--fs-signal);
}

:where(button, input, select, textarea, a):focus-visible {
  outline: 3px solid var(--fs-signal);
  outline-offset: 2px;
}

.fs-module {
  border-top: var(--fs-rule-major);
  border-bottom: var(--fs-rule);
  padding: 16px 0;
}

.fs-index {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: var(--fs-rule);
  background: var(--fs-signal);
  font: 800 0.5rem/1 var(--fs-font-data);
}
```

## 17. Applying the system to existing builds

### Level 1: Field accent

Use when the current interface is established and should not be structurally redesigned.

- Replace pure white with bone paper.
- Replace multiple accent colors with one signal yellow.
- Square the interactive geometry.
- Convert secondary labels to uppercase mono.
- Add stronger rules between major sections.
- Restyle focus and selected states.

### Level 2: Instrument retrofit

Use when the information architecture is sound but the interface lacks identity.

- Add an oversized masthead and edition plate.
- Replace cards with continuous bordered modules.
- Number the primary operating sections.
- Add an observation register for real system state.
- Convert tabs into a segmented mode strip.
- Rework generic action copy into domain-specific verbs.

### Level 3: Full specimen system

Use for new builds or major redesigns.

- Structure the product around observation, modules, records, and manual input.
- Design the primary working surface as the first visual priority.
- Create domain-specific telemetry and status language.
- Build responsive behavior as a re-racking of the same instrument.
- Validate that every technical-looking element communicates genuine state.

## 18. Adaptation examples

| Product | Primary observation | Module names | Register examples |
|---|---|---|---|
| Writing editor | Active document | Voice, Structure, Revision | Words, Reading time, Draft state |
| Analytics tool | Main trend plot | Intake, Signals, Forecast | Range, Sample, Confidence |
| Photo editor | Image canvas | Exposure, Color, Grain | Dimensions, Profile, Export state |
| Project tracker | Active timeline | Queue, Flight, Archive | Open items, Velocity, Last sync |
| Portfolio | Featured case study | Practice, Process, Index | Discipline, Year, Role |
| Music tool | Scope or sequence | Voice, Motion, Habitat | Frequency, Scale, Capture state |

## 19. What breaks the aesthetic

Do not combine Field Specimen with:

- rounded floating dashboard cards
- large soft drop shadows
- glassmorphism or blurred translucent panels
- several competing accent colors
- gradient page backgrounds
- bubbly geometric display fonts
- decorative icons on every label
- fake charts, measurements, or status lights
- excessive badges and pills
- long marketing copy inside the working interface
- technical language that has no relationship to the product

The system can be playful, but its playfulness comes from naming, scale, fluorescent activity, and unexpected precision—not from visual clutter.

## 20. Review checklist

Before calling a Field Specimen build finished, confirm:

- [ ] The primary task is obvious in the first viewport.
- [ ] The product has one dominant working surface.
- [ ] Functional areas are grouped by rules and alignment before background fills.
- [ ] Signal yellow marks real activity or choice.
- [ ] Every instrument-like affordance works.
- [ ] Presets, statuses, and measurements report real values.
- [ ] Essential labels are readable without zooming.
- [ ] Keyboard focus is obvious.
- [ ] Touch targets are at least 44 px where practical.
- [ ] Mobile layouts feel reconfigured rather than merely compressed.
- [ ] The copy vocabulary belongs to the product's domain.
- [ ] The interface still works with all decorative telemetry removed.
- [ ] Reduced-motion users receive the same state information.

## 21. Reusable creative brief

Copy and adapt this paragraph when applying the system to another build:

> Design this as a Field Specimen interface: a warm bone-paper working instrument with near-black technical ink, fluorescent acid-yellow activity states, Swiss editorial hierarchy, oversized grotesk titling, compact uppercase monospaced telemetry, square corners, continuous ruled modules, numbered subsystem labels, and one dominant observation surface. Use real product state as visual texture. Avoid floating cards, soft shadows, glass effects, decorative gradients, and fake instrumentation. Preserve excellent accessibility, responsive behavior, and truthful interaction feedback.

---

Field Specimen is a transferable system, not a Magpie skin. Keep the grammar—paper, ink, signal, rules, typography, truthful telemetry—and let each product supply its own vocabulary and instrument layout.
