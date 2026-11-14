# GLASSLINE — Phase 2 plan

**Codename:** GLASSLINE  
**Branch:** `project/glassline` (long-lived, separate from Saltline)  
**Status:** decisions confirmed; **reference analyzed 2026-11-14**. Implementation
has not started; Step 0 begins on the owner's go.

GLASSLINE is a new first-person parkour project built on the Phase 1 engine. It
does not preserve Saltline gameplay and does not merge back into `dev`.

## 1. Goal

Build a 10–20 minute playable vertical slice: a first-person parkour tutorial in
the spirit of Mirror's Edge — readable movement, a clear route, checkpoints and a
strong sense of speed — with an original world, story, art and assets. Movement
timing and level language are calibrated against the owner's reference video.

## 2. Reference intake (blocking)

The owner will add a reference video from the target game.

- [x] Owner provides the video path/link.
- [x] Watch and analyze: movement set, input timing, camera, level language,
      visual/audio references, UI, failure/respawn loop.
- [x] Write observations to `docs/REFERENCE.md` (text only; no copied frames).
- [x] Translate observations into measurable targets: speed, jump height,
      vault height, wall-run duration, camera roll/FOV, checkpoint spacing.
- [ ] Start Step 0 after the owner's go.

Analysis lives in [`docs/REFERENCE.md`](docs/REFERENCE.md),
[`docs/MOVEMENT.md`](docs/MOVEMENT.md) and [`docs/CAMERA.md`](docs/CAMERA.md).
The video is a local, untracked reference and is not redistributed.

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
- The combat/disarm tutorial in the reference is **out of scope** for the first parkour slice; no weapons or copied combat.

## 5. Step-by-step plan

### Step 0 — Bootstrap and guardrails

Branch: `feat/glassline-skeleton` — **in progress, not merged**.

- [x] create `src/game/glassline/`, `src/levels/`, `src/assets/`, `src/prototypes/`;
- [x] register a new mode in `src/modes/` (`?show=glassline`);
- [x] set up `jsconfig.json` / `checkJs` and a thin `types/engine.d.ts` for the game context;
- [x] minimal scene: rooftop deck, skyline blocks, camera, player capsule, red route beam;
- [x] project-specific README/commands;
- [x] boot test with empty `__errors`/`__fatal`;
- [x] `.github/workflows/glassline.yml` exists but auto-runs are disabled during prototyping; manual dispatch/local tests until release;
- [x] merged into `project/glassline`; feature branch deleted.

Acceptance: `npm run dev` opens a clean scene; build and boot test pass.
Screenshot: `artifacts/glassline-step0.png` (ignored local/CI artifact).

### Step 1 — Engine contract and capsule physics

Branch: `feat/glassline-physics` — **implemented, not merged**.

- [x] engine `moveCapsule` contract against scene AABBs;
- [x] ground, deck step, block and wall colliders;
- [x] WASD movement, sprint, pointer lock/mouse look;
- [x] jump with gravity and landing camera dip;
- [x] slope/ramp sandbox via stepped AABB colliders under a visual ramp;
- [x] vertical moving platform with a live collider;
- [x] ledge/ground/coyote query helpers;
- [x] first-person camera stays inside the capsule; no separate camera clipping;
- [x] deterministic query tests (slope limit, ledge height, coyote window);
- [x] Playwright boot, movement and jump tests.

Acceptance: movement sandbox playable; Saltline untouched; tests pass.

Known Step 1b limits (defer to movement polish): the ramp is a stepped collider
under a smooth visual, the moving platform does not carry the player yet, and a
smooth slope solver is future work.

### Step 2 — Core parkour moves

One branch per mechanic. All Step 2 mechanics are implemented and merged.

1. `feat/glassline-slide` — **implemented and merged**: run-to-slide, friction,
   recovery, low-ceiling block, camera/FOV dip, unit + Playwright tests.
2. `feat/glassline-vault` — **implemented and merged**: Space auto-vault over a
   low ledge, short arc, speed retention, unit + Playwright tests.
3. `feat/glassline-mantle` — **implemented and merged**: Space auto-mantle onto a
   high ledge, pull-up arc, stand on top, unit + Playwright tests.
4. `feat/glassline-wallrun` — **implemented and merged**: airborne wall detection,
   wall stick, timed run, 20° camera roll, Space wall-jump, unit + Playwright tests.
5. `feat/glassline-wallclimb` — **implemented and merged**: wall probe, short
   stamina-limited vertical climb, Space wall-jump/drop, unit + Playwright tests.
6. `feat/glassline-roll` — **implemented and merged**: crouch on a fast landing,
   short roll, camera dip and momentum retention, unit + Playwright tests.
7. `feat/glassline-balance` — **implemented and merged**: tagged beam, forward
   balance speed, A/D lateral correction, camera lean and fall-out detection.

For each: state machine, input buffer, animation/feedback, camera, audio, test map,
unit/Playwright coverage where useful.

Acceptance: moves chain without stuck states; no double-trigger; speed and height
match reference targets within tolerance.

### Step 3 — Tutorial level and content pipeline

Branch: `feat/glassline-tutorial-complete` — **implemented, not merged**.

Delivered:

- [x] data-driven level data in `src/levels/tutorial.js`;
- [x] shared level builder in `src/levels/build.js`;
- [x] format validator, route-order and route-length unit tests;
- [x] separate playable mode: `?show=glassline-tutorial`;
- [x] checkpoints, fall respawn, finish trigger and stage HUD;
- [x] three-act, ~200 m multi-level route with 21 checkpoints:
      movement/jump, slide, vault, mantle, wallrun, wallclimb, balance, roll, repeated
      second-pass mechanics, final rooftop sprint;
- [x] route-order audit and browser tests for every checkpoint, respawn, reload
      persistence and finish;
- [x] art/readability pass: palette, route strips, city silhouettes, fog, act
      signage, floating next-checkpoint marker and finish gate;
- [x] HUD progress bar, run timer, R retry and Backspace restart;
- [x] localStorage checkpoint persistence across reloads (tested).

Acceptance: automated coverage confirms the full route order, every checkpoint,
respawn recovery, persistence and finish. Human 10–20 minute pacing should be
playtested during Step 4; optional editor/level-preview tooling is not required
for the vertical slice.

### Step 4 — Theme, art, audio and UI

Branches: `feat/glassline-art`, `feat/glassline-ui`, `feat/glassline-audio`

Status: UI shell and art merged. `feat/glassline-audio` implemented, not merged.

- [x] original GLASSLINE title, pause and completion overlay (merged);
- [x] start gates the timer/run and requests pointer lock;
- [x] pause on pointer-lock loss, resume/restart actions;
- [x] mouse sensitivity setting with localStorage persistence;
- [x] tutorial HUD already covers objective, checkpoint, timer/splits/best;
- [x] level inspector linked from the menu;
- [x] original art/theme pass on the tutorial blockout: textured concrete tops,
      dark platform sides, edge lines, lit skyline windows, rooftop AC/vent/antenna/rail
      props, act-sign underline, warm/cool three-light setup and exposure lift;
- [x] original procedural music/SFX: wind bed, three-note pad, footsteps, jump,
      land, slide, vault, mantle, wallrun, wallclimb, roll, checkpoint, finish,
      respawn and UI cues (audio branch, not merged);
- [x] menu mute/volume controls with localStorage persistence;
- [ ] full settings/controls/rebinding decision;
- [ ] no copied-IP audit and final audio QA.

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
- **Delete every merged feature branch immediately after integration — local and
  origin.** This is mandatory; do not leave merged branches behind.

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

## 8. Reference documents

- [`docs/REFERENCE.md`](docs/REFERENCE.md) — timestamped observations and starting targets;
- [`docs/MOVEMENT.md`](docs/MOVEMENT.md) — movement/capsule/state-machine spec;
- [`docs/CAMERA.md`](docs/CAMERA.md) — camera, FOV, roll, landing and accessibility spec;
- [`docs/REFERENCE.md`](docs/REFERENCE.md) notes the video is local and untracked.

## 9. Timeline

| Step                 | Estimate      |
| -------------------- | ------------- |
| Skeleton             | 2–4 days      |
| Physics + core moves | 2–3 weeks     |
| Tutorial/content     | 1–2 weeks     |
| Art/audio/UI         | 1–2 weeks     |
| Polish/playtest      | 1 week        |
| **Total**            | **5–9 weeks** |

These are agent+human estimates and depend on the reference video and playtests.
