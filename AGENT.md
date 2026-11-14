# Agent guide — GLASSLINE

Read this file and [`PLAN.md`](PLAN.md) before changing anything.

## Mission

Build **GLASSLINE**, a new first-person parkour vertical slice on the Phase 1
engine, in the long-lived branch `project/glassline`. It is not Saltline gameplay
and must not be merged back into `dev`.

## Current gate

Phase 1 is complete and stabilized on `dev`. Step 0, Step 1 and all Step 2 parkour
mechanics are merged into `project/glassline`; their feature branches are deleted.
Step 3 implementation is complete on `feat/glassline-tutorial-final`: a three-act
~200 m route with 21 checkpoints, respawn/finish, HUD/timer, route readability,
act signage and saved checkpoint progress. It is **not merged**; merge only on
command. Human 10–20 minute pacing is a Step 4 playtest item.

The theme, language and platform are confirmed: **parkour in the spirit of
Mirror's Edge with original IP**, **JS + JSDoc**, **desktop Chrome**, **60 FPS**.
Use `// @ts-check` and a thin engine type declaration where useful; do not start a
TypeScript migration.

Reference analysis is complete:

- [`docs/REFERENCE.md`](docs/REFERENCE.md) — timestamps, movement/camera observations;
- [`docs/MOVEMENT.md`](docs/MOVEMENT.md) — movement spec and starting targets;
- [`docs/CAMERA.md`](docs/CAMERA.md) — camera/FOV/roll/landing spec.

Step 2 status: slide, vault, mantle, wallrun, wallclimb, roll and balance are all
implemented and merged. The Step 3 blockout is still short of the 10–20 minute
acceptance target. The reference video is local/untracked and must not be committed.

## Hard rules

- `project/glassline` never merges into `dev` or `main`.
- Feature branches start from `project/glassline`: `feat/glassline-*`.
- Merge into `project/glassline` only after an explicit owner command.
- **After every merge, delete the merged feature branch immediately — locally and
  on origin.** Do not leave merged branches around.
- Engine fixes are separate `fix/engine-*` branches from `dev`; merge them into
  `dev` only by owner command, then rebase/cherry-pick into GLASSLINE.
- Do not import `src/game/saltline/` into engine modules.
- Do not reformat the retained minified Saltline core.
- Do not copy reference-video frames, assets, audio, level data or other
  third-party IP. Observations are text only.
- Preserve `NOTICE.md`; original Saltline rights remain with its author.
- Every step must include tests and a smoke path.
- GLASSLINE CI auto-runs are **disabled during prototyping**. Run
  `npm run check`, `npm test` and
  `npx playwright test tests/e2e/glassline.spec.js` locally. Re-enable CI at the
  final release steps; the workflow remains available via manual dispatch.
- Language: JS + JSDoc; target: desktop Chrome at 60 FPS; no TS migration of the legacy engine.
- The reference combat/disarm segment is out of scope for the first parkour slice.

## Plan mirrored from PLAN.md

### Step 0 — Bootstrap

Branch `feat/glassline-skeleton`.

- `src/game/glassline/`, `src/levels/`, `src/assets/`, `src/prototypes/`;
- register a GLASSLINE mode;
- `jsconfig.json`/`checkJs` + thin engine type declarations;
- minimal ground/camera/player scene;
- boot test with empty `__errors`/`__fatal`;
- project CI path, separate from Saltline.

### Step 1 — Physics contract

Branch `feat/glassline-physics` (in progress).

- [x] capsule movement on ground/steps/walls via engine `moveCapsule`;
- [x] WASD, sprint, pointer lock/mouse look, jump, landing camera dip;
- [x] stepped ramp, moving platform collider, ledge/coyote queries;
- [x] Playwright boot/movement/jump tests;
- [x] deterministic query unit tests;
- [ ] smooth slope solver and platform carry (future polish).

### Step 2 — Parkour moves

One branch per move, in this order:

1. `feat/glassline-slide` — merged
2. `feat/glassline-vault` — merged
3. `feat/glassline-mantle` — merged
4. `feat/glassline-wallrun` — merged
5. `feat/glassline-wallclimb` — merged
6. `feat/glassline-roll` — merged
7. `feat/glassline-balance` — merged

Each move needs a state machine, input buffering, camera/audio feedback, a test
map and regression tests for stuck/duplicate states.

### Step 3 — Tutorial level

Branch `feat/glassline-tutorial-final` (implemented, not merged).

- [x] data-driven layout and validator;
- [x] three-act ~200 m route with 21 checkpoints;
- [x] checkpoints, respawn, finish and stage HUD/timer;
- [x] separate `?show=glassline-tutorial` mode;
- [x] route-order/length audit and browser coverage;
- [x] route strips, palette, silhouettes, fog, act signage and finish gate;
- [x] R retry, Backspace restart and localStorage checkpoint persistence;
- [ ] human 10–20 minute pacing playtest (Step 4);
- [ ] optional level editor/preview.

### Step 4 — Theme, art, audio, UI

Branches `feat/glassline-art`, `feat/glassline-ui`, `feat/glassline-audio`.

- original visual language;
- original/generated/licensed assets;
- minimal HUD and menu;
- settings and controls;
- original music/SFX.

### Step 5 — Performance and reliability

Branch `feat/glassline-polish`.

- draw calls/tris/frame-time baseline;
- culling/LOD/quality;
- settings and checkpoint persistence;
- no fatal on boot/restart/respawn;
- chosen input platforms tested.

### Step 6 — Playtest and release

Branch `feat/glassline-release`.

- playtest checklist and fixes;
- golden screenshots with fixed seed/camera/quality;
- single-file build;
- GLASSLINE tag/release notes.

## Workflow for every step

1. Sync `project/glassline`, create `feat/glassline-<step>`.
2. Read the relevant reference notes and the current engine contract.
3. Implement a small, reversible slice.
4. Add tests: unit + browser/smoke; compare parity/golden when a reference exists.
5. Run:
   ```sh
   npm run check
   npm test
   npm run build
   npm run test:e2e
   ```
6. Update `PLAN.md` progress and `docs/REFERENCE.md` observations.
7. Commit and push the feature branch.
8. Stop and ask for the owner's merge command. Do not merge on your own.

## Key files

```text
PLAN.md                         Phase 2 plan and status
AGENT.md                        this operational contract
docs/REFERENCE.md               video observations and starting targets
docs/MOVEMENT.md                movement spec
docs/CAMERA.md                  camera spec
docs/ARCHITECTURE.md            engine/game boundaries
docs/ENGINE_REUSE.md            engine portability checklist
src/engine/                     shared engine
src/modes/                      mode registry
src/game/glassline/             new game (to be created)
src/levels/                     new level content (to be created)
src/assets/                     original/licensed assets only
```

## Definition of done

- [ ] reference analyzed and documented;
- [ ] chosen mechanics implemented and tuned;
- [ ] tutorial level playable start-to-finish;
- [ ] original assets/license verified;
- [ ] unit, Playwright, golden, physics and perf tests green;
- [ ] no `__errors`/`__fatal` on boot, restart or respawn;
- [ ] target FPS measured;
- [ ] `dist/index.html` builds and serves over HTTP;
- [ ] feature branches integrated only by owner command;
- [ ] `project/glassline` contains plan, observations and release notes.
