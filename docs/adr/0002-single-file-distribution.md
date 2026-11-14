# ADR 0002: single-file distribution

- Status: accepted
- Date: 2026-11-14

## Context

Saltline is distributed as a single playable HTML file. The original artifact
inlines its engine, shaders, audio and generated content. A conventional
multi-asset Vite build would complicate local play and parity checks.

## Decision

Keep Vite with `vite-plugin-singlefile`. The source entry is `src/index.html`;
the build emits one `dist/index.html` with CSS and JS inlined. Assets remain
generated at runtime or inlined in the source.

The legacy root `index.html` stays in the repository as a parity baseline until
automated golden tests replace manual screenshot comparisons.

## Consequences

- Deployment is still a single file, served over HTTP.
- The bundle is large and the build does not produce source-mapped modules.
- Any new external asset must be explicitly inlined or accepted as a network
  dependency; the current build avoids runtime asset downloads beyond fonts.
