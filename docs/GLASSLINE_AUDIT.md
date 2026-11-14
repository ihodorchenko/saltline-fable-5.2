# GLASSLINE — final QA and no-copied-IP audit

- Date: 2026-11-14
- Audited commit: `ce28415` (`project/glassline`)
- Scope: GLASSLINE tutorial, UI, audio, settings, level inspector and bundled build
- Verdict: **PASS for code/asset originality. PASS with follow-ups for release QA.**
  No copied assets, characters, logos, music or level layouts were found. No
  critical or high-severity QA defect was found.

## Automated QA

| Check | Result |
|---|---|
| `npm run check` (ESLint + Prettier) | PASS |
| `npm test` | PASS — 19 files, 60 tests |
| `npx playwright test glassline*.spec.js` | PASS — 19 tests, 1.2 min |
| `npm run build` | PASS — single-file `dist/index.html`, ~1,501.78 kB |
| Boot fatal/error capture | PASS — Playwright boot helper asserts `__fatal === null` and empty `__errors` |
| Tutorial/editor/UI smoke | PASS — tutorial, inspector, start/pause/complete and rebinding covered |
| Checkpoint/respawn/persistence/fail-safe | PASS — browser coverage |
| Settings persistence/rebinding | PASS — browser coverage |

Environment: local macOS, Microsoft Edge channel, headless Playwright. CI
automatic runs remain intentionally disabled during prototyping.

## No-copied-IP audit

| Area | Finding |
|---|---|
| Source terms | `Mirror's Edge`, `Faith`, `DICE`, `Electronic Arts` and `runner vision` do not occur in GLASSLINE source. They occur only in planning/reference docs as inspiration and explicit prohibitions. |
| Names/world | `GLASSLINE`, `ROOFTOP INDUCTION`, acts, checkpoints and level layout are authored for this project. No Mirror's Edge character, faction, logo or level name is used. |
| Level layout | Data-authored blockout in `src/levels/tutorial.js`; no imported or reconstructed Mirror's Edge layout. |
| Textures/models | No tracked image/model files. Surface textures are runtime Canvas noise/panel patterns. |
| Audio/music | Fully procedural Web Audio; no samples, recordings or third-party tracks. |
| Fonts | Big Shoulders Display, IBM Plex Mono and Barlow Condensed are loaded from Google Fonts under SIL OFL 1.1; no font binaries are bundled. System fallbacks are used offline. |
| External assets | GLASSLINE game source has no remote image/audio/model imports. `src/index.html` requests Google Fonts (OFL, not game art) for the shell typography. |
| Reference video | Local/untracked/ignored (`docs/reference/*.mp4`); absent from git and from the build. |
| Saltline imports | GLASSLINE does not import `src/game/saltline`; the app bundle still contains the Phase 1 Saltline mode because both modes ship in the same build. |

## Dependencies and licenses

- Project license: MIT (`LICENSE`).
- Runtime embedded library: three.js r180, MIT. Notice added in
  [`THIRD_PARTY.md`](THIRD_PARTY.md).
- Installed package tree: 86 MIT, 15 Apache-2.0, 6 BSD-2-Clause, 6 ISC,
  2 BSD-3-Clause, 1 BlueOak-1.0.0; no GPL/AGPL or unknown licenses.
- Tooling dependencies are build/test only; three.js is the embedded runtime
  dependency.

## Findings and follow-ups

### P1 — none

No copied asset, license blocker, boot failure or data-loss issue found.

### P2 — release follow-ups

1. **Human pacing playtest:** automated tests teleport through checkpoints; no
   human 10–20 minute run has been recorded. Timer/splits/best are instrumented
   and ready for that test.
2. **Performance baseline:** draw calls, triangle count, frame time and quality
   profiles belong to Step 5; this audit verifies correctness, not 60 FPS on all
   hardware.
3. **Reference media packaging:** keep `docs/reference/` out of distribution
   artifacts; the repository ignores the video but it still exists locally.

### P3 — polish/notes

1. The single-file bundle still includes the Phase 1 Saltline mode; this is
   project-original code/assets, not copied IP, but release packaging should
   decide whether to tree-shake it.
2. `package.json` still describes the Phase 1 Saltline shell; rename/description
   cleanup can happen at release packaging.
3. The mirrored/inspiration terminology in docs is intentional and clearly
   marked as reference-only; do not ship those docs as game content.

## Evidence

- Asset scan: no tracked `.mp4/.png/.jpg/.wav/.mp3/.glb/.gltf/.ttf` files.
- IP scan: matches only in `docs/EXPANSION.md`, `docs/REFERENCE.md`,
  `docs/CONTRIBUTING.md`, `docs/MOVEMENT.md`, all as warnings/reference.
- Ignore rules: `docs/reference/*.mp4`, `dist/`, `artifacts/` are ignored.
- Tests: `src/game/glassline/*.test.js`, `src/levels/validate.test.js`,
  `tests/e2e/glassline*.spec.js`.
