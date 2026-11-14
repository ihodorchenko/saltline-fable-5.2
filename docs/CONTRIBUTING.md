# Contributing to GLASSLINE

GLASSLINE is an original first-person rooftop-parkour vertical slice built on the
shared engine in `src/engine`. The original Saltline artifact is intentionally
kept at the repository root as a legacy reference; it is not part of the active
source build and must not be reintroduced into `src/`.

## Setup

Requirements: Node 22 (see `.nvmrc`), npm, and a Chromium-based browser.

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright test
npm run check
```

For local Playwright with installed Edge:

```sh
PLAYWRIGHT_CHANNEL=msedge npx playwright test
```

## Branches and merge rules

- `project/glassline` is the long-lived Phase 2 branch. It never merges into
  `dev` or `main`.
- Short-lived work branches start from `project/glassline` and use the
  `feat/glassline-*` prefix.
- Merge into `project/glassline` only after an explicit owner command.
- **After every merge, delete the merged branch immediately, locally and on
  origin.** Do not leave merged branches behind.
- Shared engine fixes are separate `fix/engine-*` branches from `dev`; merge them
  only by owner command, then rebase/cherry-pick into GLASSLINE.

## Commit and test discipline

- Use short imperative subjects, optionally scoped: `feat:`, `fix:`, `perf:`,
  `docs:`, `chore:`.
- Every gameplay or UI change needs relevant unit and/or Playwright coverage.
- Run `npm run check`, `npm test`, `npx playwright test` and `npm run build`
  before requesting a merge.
- Do not commit generated `dist/`, `artifacts/`, `test-results/` or the local
  reference video.
- Keep the original root `index.html` untouched; it is the preserved legacy
  Saltline artifact.

## Assets and IP

- Use only original or properly licensed assets.
- Do not copy Mirror's Edge or other third-party assets, logos, characters,
  level layouts, music or textures.
- Prefer procedural/generated assets for the vertical slice.
- Record third-party licenses in [`THIRD_PARTY.md`](THIRD_PARTY.md) and keep the
  original-artifact attribution in [`NOTICE.md`](../NOTICE.md).
- Reference analysis belongs in [`REFERENCE.md`](REFERENCE.md); the video remains
  local, ignored and uncommitted.

## Documentation

- User-facing setup: [`README.md`](../README.md).
- Phase 2 plan and agent contract: [`PLAN.md`](../PLAN.md), [`AGENT.md`](../AGENT.md).
- Visual language and screen system: [`DESIGN.md`](DESIGN.md).
- QA/IP audit: [`GLASSLINE_AUDIT.md`](GLASSLINE_AUDIT.md).
- Performance profile: [`PERFORMANCE.md`](PERFORMANCE.md).
- Level inspector: `?show=glassline-editor&q=high`.
