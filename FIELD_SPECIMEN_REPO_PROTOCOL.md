# Field Specimen Repository Protocol

Version 1.0

This protocol keeps the Field Specimen aesthetic consistent when multiple coding agents or agent platforms work on the same product.

## Repository files

| File | Role | Intended readers |
|---|---|---|
| `FIELD_SPECIMEN_STYLE_GUIDE.md` | Complete canonical design system | Humans and agents doing visual work |
| `AGENTS.md` | Concise cross-platform operating contract | Codex and agents that support `AGENTS.md` |
| `CLAUDE.md` | Claude Code adapter that imports `AGENTS.md` | Claude Code |
| `.claude/rules/field-specimen.md` | UI-file-scoped continuity reminder | Claude Code when interface files are opened |

The style guide owns the visual language. `AGENTS.md` owns the workflow. Platform adapters should remain thin so the rules cannot drift.

## How it works

```text
FIELD_SPECIMEN_STYLE_GUIDE.md
              ↑
          AGENTS.md
          ↗       ↖
     Codex       CLAUDE.md
                    +
       .claude/rules/field-specimen.md
```

1. An agent enters the repository and loads its platform-native instruction file.
2. The adapter points to the shared `AGENTS.md` contract.
3. Before visual work begins, the contract requires the agent to read the complete style guide.
4. The agent chooses an adoption level, implements the task, and reports aesthetic continuity in its handoff.
5. Reusable design changes are added to the style guide so the next agent receives the same source of truth.

## Installing the protocol in another repository

Copy these four tracked artifacts into the new repository while preserving their paths:

```text
AGENTS.md
CLAUDE.md
FIELD_SPECIMEN_STYLE_GUIDE.md
.claude/rules/field-specimen.md
```

Then:

1. Keep the `@AGENTS.md` line at the top of `CLAUDE.md`.
2. Adjust the path globs in `.claude/rules/field-specimen.md` if the project uses different UI directories or extensions.
3. Add project-specific build and validation commands to `AGENTS.md` without duplicating the design guide.
4. Commit all four artifacts so every contributor, worktree, CI agent, and clone receives them.
5. Ask each new platform to use `AGENTS.md` as its canonical repository instruction source. If it needs a proprietary instruction file, make that file a small adapter rather than a second copy of the rules.

## Claude Code verification

Run Claude Code from the repository root without `--bare` or `--safe-mode`. Those modes disable normal project customization or `CLAUDE.md` discovery.

Inside Claude Code:

1. Run `/memory` and confirm the project `CLAUDE.md` is listed.
2. Ask Claude to open a UI file.
3. Run `/memory` again and confirm `.claude/rules/field-specimen.md` is active for the matching file.
4. Ask: `Summarize the Field Specimen continuity contract for this repository.`
5. Confirm the response names the canonical style guide, the three adoption levels, truthful instrumentation, and the required completion note.

Do not ask Claude to save a duplicate summary in auto memory. The tracked repository files should remain canonical.

## Multi-agent task template

Include this paragraph whenever an orchestrator delegates visual work:

> Read `AGENTS.md` and `FIELD_SPECIMEN_STYLE_GUIDE.md` before editing. Preserve the Field Specimen continuity contract and report any intentional deviations. Reuse existing tokens and components. Do not introduce a parallel palette, type system, spacing system, or component vocabulary.

For parallel work, assign one agent ownership of shared tokens and primitives. Other agents should consume those decisions rather than editing the same design foundation independently.

## Pull-request or handoff template

```text
## Field Specimen continuity

- Adoption level: Level 1 | Level 2 | Level 3
- Primary working surface: <surface>
- Reused tokens/components: <items>
- New reusable patterns: none | <items>
- Truthful state mappings: <visual state → real state>
- Responsive/accessibility checks: <checks>
- Intentional deviations: none | <deviation and reason>
```

## Updating the system

When a build produces a successful reusable pattern:

1. Decide whether it is product-specific or cross-product.
2. Keep product-specific behavior in the product repository.
3. Add only cross-product rules to `FIELD_SPECIMEN_STYLE_GUIDE.md`.
4. Update `AGENTS.md` only when the required workflow or non-negotiable contract changes.
5. Keep platform adapters unchanged unless the platform's instruction mechanism changes.
6. Increase the protocol version when the continuity contract changes materially.

## Conflict policy

- The user's explicit current request has highest priority.
- Existing intentional product behavior should be preserved unless replacement is requested.
- The style guide controls aesthetic detail.
- `AGENTS.md` controls agent workflow.
- A platform adapter must never silently override the shared contract.
- Intentional deviations are allowed, but they must be named in the final handoff.

## Portability rule

The protocol is successful when two agents can implement different tools without producing identical screens, while both results unmistakably share:

- bone paper
- near-black structural ink
- semantic acid-yellow activity
- square continuous modules
- grotesk display hierarchy
- monospaced truthful telemetry
- a dominant working surface
- accessible mechanical interaction

Continuity means shared grammar, not cloned layouts.
