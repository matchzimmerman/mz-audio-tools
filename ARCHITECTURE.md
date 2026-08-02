# MZ Audio Lab Architecture

## Purpose

`mz-audio-tools` is the browser-instrument collection for Match Zimmerman Creative Media Group. The public site must remain statically exportable so every instrument can run directly from GitHub Pages without a server, database, account, or external audio service.

## Public instrument surface

The deployable browser application lives in `app/` and currently exposes:

- `/magpie/` — generative avian signal synthesizer
- `/serial/` — sequential effects-chain laboratory
- `/erd/` — six-voice percussion synthesizer and step sequencer
- `/coasts/` — East Coast / West Coast synthesis comparison

All sound is synthesized in the browser with the Web Audio API. Audio begins only after user interaction.

## Deployment boundary

GitHub Pages builds the static browser application with:

```bash
npm run build:pages
```

The Pages build must not depend on Cloudflare Workers, D1, R2, request headers, server actions, API routes, or runtime environment bindings.

Cloudflare-specific starter files may remain temporarily for the original preview environment, but they are outside the public instrument boundary and must not be imported by the static routes.

## Growth model

New tools should be added as self-contained routes and classified as one of:

- Synths
- Effects
- Rhythm
- Generative
- Utilities

Each instrument should include:

1. a browser route,
2. a card on the collection index,
3. a concise operating description,
4. pointer/touch support where appropriate,
5. output limiting or compression,
6. a clear audio start/stop or panic control,
7. no dependency on server state unless a separate hosted service is intentionally introduced.

## Near-term cleanup

1. Keep the GitHub Pages build green.
2. Remove or relocate unused Cloudflare/database starter code after confirming no instrument imports it.
3. Consolidate shared Field Specimen components and design tokens.
4. Add a lightweight registry so the collection index and MZCMG landing-page hub can draw from the same instrument metadata.
5. Add automated static-build checks for pull requests while deploying only from `main`.
