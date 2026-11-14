# Agent guide — GLASSLINE

Read this file and [`PLAN.md`](PLAN.md) before changing anything.

## Mission

Build **GLASSLINE**, a new first-person parkour vertical slice on the Phase 1
engine, in the long-lived branch `project/glassline`. It is not Saltline gameplay
and must not be merged back into `dev`.

## Current gate

Phase 1 is complete and stabilized on `dev`. This branch currently contains only
planning. The owner will add a reference video from the target game.

**Do not start gameplay/physics implementation until:**

1. the reference video is available;
2. it has been analyzed for movement, camera, level language and UI;
3. `docs/REFERENCE.md` contains the observations and measurable targets;
4. the owner has confirmed the theme/platform decisions in `PLAN.md`.

## Hard rules

- `project/glassline` never merges into `dev` or `main`.
- Feature branches start from `project/glassline`: `feat/glassline-*`.
- Merge into `project/glassline` only after an explicit owner command.
- Engine fixes are separate `fix/engine-*` branches from `dev`; merge them into
  `dev` only by owner command, then rebase/cherry-pick into GLASSLINE.
- Do not import `src/game/saltline/` into engine modules.
- Do not reformat the retained minified Saltline core.
- Do not copy reference-video frames, assets, audio, level data or other
  third-party IP. Observations are text only.
- Preserve `NOTICE.md`; original Saltline rights remain with its author.
- Every step must include tests and a smoke path.

## Plan mirrored from PLAN.md

### Step 0 — Bootstrap

Branch `feat/glassline-skeleton`.

- `src/game/glassline/`, `src/levels/`, `src/assets/`, `src/prototypes/`;
- register a GLASSLINE mode;
- minimal ground/camera/player scene;
- boot test with empty `__errors`/`__fatal`;
- project CI path, separate from Saltline.

### Step 1 — Physics contract

Branch `feat/glassline-physics`.

- capsule on slopes, steps, walls, ledges, moving platforms;
- ground/wall/ledge/coyote queries;
- camera collision and landing response;
- unit tests for deterministic queries.

### Step 2 — Parkour moves

One branch per move, in this order:

1. `feat/glassline-slide`
2. `feat/glassline-vault`
3. `feat/glassline-mantle`
4. `feat/glassline-wallrun`
5. `feat/glassline-wallclimb`
6. `feat/glassline-roll`
7. `feat/glassline-balance`

Each move needs a state machine, input buffering, camera/audio feedback, a test
map and regression tests for stuck/duplicate states.

### Step 3 — Tutorial level

Branch `feat/glassline-tutorial`.

- data-driven layout;
- one mechanic taught at a time;
- checkpoints, respawn, finish;
- readable route;
- 10–20 minute slice;
- optional level format validator/editor.

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
docs/REFERENCE.md               video observations (to be created)
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
