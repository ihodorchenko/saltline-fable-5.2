# Contributing

This repository is a fork of Saltline. The original game, art and audio belong
to their author; the Phase 1 refactor, engine boundaries and documentation added
here are MIT-licensed (see `LICENSE` and `NOTICE.md`).

## Setup

Requirements: Node 22 (see `.nvmrc`), npm from `package.json`, and a
Chromium-based browser for local smoke.

```sh
npm ci
npm run dev       # http://127.0.0.1:5173
npm run build     # dist/index.html
npm test          # Vitest unit tests
npm run test:e2e  # build + Playwright (boot, golden, physics, perf)
npm run check     # ESLint + Prettier check
npm run smoke     # legacy headless screenshot smoke
```

For local Playwright without downloading Chromium:

```sh
PLAYWRIGHT_CHANNEL=msedge npm run test:e2e
```

## Branch rules

- `main` is the original mirror plus accepted local docs/remaps. Do not push or
  merge into `main` without an explicit owner command.
- `dev` is the Saltline integration branch. Merge into it only with an explicit
  owner command.
- Work in a short-lived branch from `dev`: `feat/…`, `fix/…`, `test/…`,
  `docs/…`.
- **Always delete a merged short-lived branch immediately after the merge —
  locally and on origin.** This applies to `dev` and `project/*`; do not leave
  merged branches behind.
- Phase 2 lives in its own long-lived `project/…` branch and does not merge back
  into `dev`.
- Shared engine bugfixes go to a separate `fix/engine-…` branch and reach `dev`
  by command; the Phase 2 branch can then rebase or cherry-pick them.

## Commits

Use a short imperative subject, optionally scoped:

```text
feat: add double-jump buffer
fix: prevent wall-run state sticking
test: cover rail raycasts
docs: document engine context
```

Keep extraction commits behaviour-preserving and separate from gameplay or
tooling changes.

## Extraction workflow

1. Define the boundary: one factory/state machine with a clear return value.
2. List free variables with ESLint scope or an AST walk.
3. Move to `src/engine/` or `src/game/saltline/`.
4. Make dependencies explicit:
   - engine modules should import only `src/engine/*` and browser APIs;
   - game modules receive legacy helpers through a `deps` object;
   - never import the minified game scope from an engine module.
5. Wire the original call site.
6. Run `npm run check`, `npm test`, `npm run build`, and relevant Playwright
   tests.
7. Compare title/gameplay/level screenshots where the scene is deterministic.
8. Update `docs/EXPANSION.md` and the architecture docs only after verification.

Do not reformat `src/game/main.js` while it still contains the minified core.

## Tests and parity

- Unit: `npm test` (Vitest).
- Browser: `npm run test:e2e`; needs a built `dist/`.
- Golden: source and legacy root are captured in the same browser and compared
  with pixelmatch; do not create OS-specific baselines.
- Smoke: `npm run smoke`; `SMOKE_NAME` and `SMOKE_QUERY` control artifacts.
- Perf: the Playwright perf test writes `artifacts/perf-baseline.json`.
- CI runs lint, unit, build, Playwright, smoke and uploads reports/artifacts.
- Headless animation timing is unreliable; test animation state at module level.

## Code style

- Handwritten JS is ESLint/Prettier checked. Minified extracted bodies are
  excluded in `eslint.config.js` and `.prettierignore`.
- Use JSDoc for public module factories.
- Prefer explicit factory functions and `deps` over hidden globals.
- Keep browser APIs behind the game context when they are not engine primitives.
- Do not add runtime dependencies for a single small helper without a clear need.

## Documentation

- Update `README.md` for user-facing setup or commands.
- Update `docs/ARCHITECTURE.md` and add/update an ADR when a boundary or contract
  changes.
- Update `docs/OVERVIEW.md` when the fingerprint, source layout or measured
  numbers change.
- Phase 2 planning lives in `PLAN.md` and `AGENT.md` on the project branch.

## Assets and references

- Use only original or properly licensed assets. Do not copy Mirror's Edge or
  other third-party files, textures, audio or level data.
- A reference video may be used for analysis of motion, camera and level flow;
  record observations in `docs/REFERENCE.md` and do not redistribute its frames.
- Preserve `NOTICE.md` and the original license scope.

## Pull requests / merge checklist

- [ ] branch is based on the requested base and named by type;
- [ ] `npm run check` passes;
- [ ] `npm test` passes;
- [ ] `npm run build` passes;
- [ ] relevant Playwright/smoke tests pass;
- [ ] no unrelated files or generated artifacts are committed;
- [ ] docs and checklist updated;
- [ ] merge only when the owner has explicitly allowed it.
