# GLASSLINE — Phase 2 plan

**Codename:** GLASSLINE  
**Branch:** `project/glassline` (long-lived, separate from Saltline)  
**Status:** decisions confirmed; **waiting for the owner's reference video**. No
implementation starts before the reference is analyzed.

GLASSLINE is a new first-person parkour project built on the Phase 1 engine. It
does not preserve Saltline gameplay and does not merge back into `dev`.

## 1. Goal

Build a 10–20 minute playable vertical slice: a first-person parkour tutorial in
the spirit of Mirror's Edge — readable movement, a clear route, checkpoints and a
strong sense of speed — with an original world, story, art and assets. Movement
timing and level language are calibrated against the owner's reference video.

## 2. Reference intake (blocking)

The owner will add a reference video from the target game.

- [ ] Owner provides the video path/link.
- [ ] Watch and analyze: movement set, input timing, camera, level language,
      visual/audio references, UI, failure/respawn loop.
- [ ] Write observations to `docs/REFERENCE.md` (text only; no copied frames).
- [ ] Translate observations into measurable targets: speed, jump height,
      vault height, wall-run duration, camera roll/FOV, checkpoint spacing.
- [ ] Only then start Step 0.

Rules: use the video for analysis, not for redistributing assets, textures,
audio, level data or frames. No Mirror's Edge files in the repository.

## 3. Decisions

Confirmed by the owner:

| Decision        | Choice                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| Theme / fiction | Parkour in the spirit of Mirror's Edge; **original IP/world/story/assets** |
| Platform        | **Desktop Chrome** first; gamepad optional                                 |
| Language        | **JS + JSDoc** (`// @ts-check` where useful); no TS migration of legacy    |
| Target FPS      | **60 FPS** desktop; graceful low mode                                      |
| Art/audio       | original/generated or licensed only; no copied IP                          |

Still open:

| Decision            | Default proposal                                           |
| ------------------- | ---------------------------------------------------------- |
| Template mode       | include a small empty `template` mode if cheap             |
| Reference timing    | wait for video before implementation                       |
| Gamepad/touch scope | gamepad after first playable; touch out of the first slice |

## 4. Non-negotiable constraints

- Engine modules must not import `src/game/`.
- Saltline stays in `dev`; GLASSLINE stays in `project/glassline`.
- Shared engine fixes go through `fix/engine-*` and reach `dev` only by owner command.
- Phase 2 feature branches merge into `project/glassline` only by owner command.
- Do not reformat the retained minified Saltline core.
- New GLASSLINE modules are JS + JSDoc; do not introduce a TS migration or a second toolchain.
- No third-party IP assets; preserve `NOTICE.md` and the license scope.
- Every step has tests, a smoke path and a rollback point.

## 5. Step-by-step plan

### Step 0 — Bootstrap and guardrails

Branch: `feat/glassline-skeleton`

- create `src/game/glassline/`, `src/levels/`, `src/assets/`, `src/prototypes/`;
- register a new mode in `src/modes/`;
- set up `jsconfig.json` / `checkJs` and a thin `types/engine.d.ts` for the game context;
- minimal scene: ground, camera, player capsule, exit to menu;
- project-specific README/commands;
- boot test with empty `__errors`/`__fatal`;
- a `project/glassline` CI path separate from Saltline.

Acceptance: `npm run dev` opens a clean scene; build and boot test pass.

### Step 1 — Engine contract and capsule physics

Branch: `feat/glassline-physics`

- capsule movement on slopes, steps, walls, ledges;
- ground/wall/ledge/coyote queries;
- moving platforms;
- camera collision and landing response;
- unit tests for queries and deterministic step behaviour.

Acceptance: movement sandbox playable; Saltline untouched; engine tests pass.

### Step 2 — Core parkour moves

One branch per mechanic:

1. `feat/glassline-slide` — slide, recovery, low ceilings.
2. `feat/glassline-vault` — vault over waist-height obstacles.
3. `feat/glassline-mantle` — climb a ledge and stand up.
4. `feat/glassline-wallrun` — wall-run, exit jump, camera roll.
5. `feat/glassline-wallclimb` — short wall climb with stamina/timing.
6. `feat/glassline-roll` — landing roll and speed retention.
7. `feat/glassline-balance` — beams and narrow surfaces.

For each: state machine, input buffer, animation/feedback, camera, audio, test map,
unit/Playwright coverage where useful.

Acceptance: moves chain without stuck states; no double-trigger; speed and height
match reference targets within tolerance.

### Step 3 — Tutorial level and content pipeline

Branch: `feat/glassline-tutorial`

- data-driven level layout;
- blockout that teaches one mechanic at a time;
- checkpoints, respawn, finish trigger;
- route readability: colour, lighting, silhouettes;
- optional simple editor/format validator;
- one complete 10–20 minute slice.

Acceptance: a new player can finish without developer guidance; checkpoint
recovery is reliable.

### Step 4 — Theme, art, audio and UI

Branches: `feat/glassline-art`, `feat/glassline-ui`, `feat/glassline-audio`

- original visual language and palette;
- original/generated textures and models;
- minimal HUD: objective, checkpoint, speed/flow feedback;
- menu, settings, controls, rebinding decision;
- original music/SFX;
- no copied IP.

Acceptance: coherent vertical slice; assets documented and licensed.

### Step 5 — Performance and reliability

Branch: `feat/glassline-polish`

- perf baseline: draw calls, tris, frame time;
- culling/LOD/quality profiles;
- save/load settings and checkpoints;
- crash/fatal and `__errors` checks;
- keyboard/gamepad/touch scope tested as chosen.

Acceptance: target FPS; no fatal on boot, restart or respawn.

### Step 6 — Playtest and release

Branch: `feat/glassline-release`

- playtest checklist and fixes;
- golden screenshots with fixed seed/camera/quality;
- final single-file build;
- tag and release notes for GLASSLINE;
- archive the reference observations.

Acceptance: vertical slice is playable start-to-finish, documented, tested and
packaged as one HTML file.

## 6. Branch workflow

```text
dev (Saltline, Phase 1 complete)
└── project/glassline (GLASSLINE, long-lived)
    ├── feat/glassline-skeleton
    ├── feat/glassline-physics
    ├── feat/glassline-slide
    ├── ...
    └── feat/glassline-release
```

- Feature branches start from `project/glassline`.
- Merge into `project/glassline` only with an explicit owner command.
- Never merge `project/glassline` into `dev`.
- Engine fixes: `fix/engine-*` from `dev`, merged by command; then rebase or
  cherry-pick into GLASSLINE.
- Delete merged feature branches after integration.

## 7. Definition of done

- [ ] reference video analyzed and `docs/REFERENCE.md` written;
- [ ] all chosen mechanics implemented and tunable;
- [ ] tutorial level start-to-finish;
- [ ] original assets and license/NOTICE intact;
- [ ] unit, Playwright, golden, physics and perf tests green;
- [ ] boot/respawn/restart have no `__errors`/`__fatal`;
- [ ] target FPS measured on the chosen platform;
- [ ] `dist/index.html` builds and is served over HTTP;
- [ ] `project/glassline` contains the plan, observations and release notes.

## 8. Timeline

| Step                 | Estimate      |
| -------------------- | ------------- |
| Skeleton             | 2–4 days      |
| Physics + core moves | 2–3 weeks     |
| Tutorial/content     | 1–2 weeks     |
| Art/audio/UI         | 1–2 weeks     |
| Polish/playtest      | 1 week        |
| **Total**            | **5–9 weeks** |

These are agent+human estimates and depend on the reference video and playtests.
