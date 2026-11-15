# GLASSLINE — Phase 2 plan

**Codename:** GLASSLINE  
**Branch:** `project/glassline` (long-lived, separate from Saltline)  
**Status:** decisions confirmed; **reference analyzed 2026-11-14**. Steps 0–5 are
implemented on `project/glassline`. **P0 visual recovery opened 2026-11-15** after
the measured visual-gap analysis ([`docs/VISUAL_GAP.md`](docs/VISUAL_GAP.md));
it now outranks the remaining Step 4/5 acceptance work.

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
- New GLASSLINE modules are JS + JSDoc; do not introduce a TS migration or a second toolchain.
- No third-party IP assets; preserve `NOTICE.md` and the license scope.
- Every step has tests, a smoke path and a rollback point.
- The combat/disarm tutorial in the reference is **out of scope** for the first parkour slice; no weapons or copied combat.

## 5. P0 — Visual recovery (high priority, added 2026-11-15)

**Priority: P0.** Outranks every unfinished Step 4/5 item. The measured visual gap
to the 2008 reference is the project's biggest quality risk: the renderer is
capable, but the frame is overexposed, flat, desaturated, sky-less and content-poor.
Full analysis, evidence and numbers: [`docs/VISUAL_GAP.md`](docs/VISUAL_GAP.md)
(companions: `docs/visual-gap/01-renderer-audit.md`, `02-metrics.md`,
`03-content-audit.md`).

Why P0 (measured reference vs build, 37 metrics, full separation on three):

| Metric                       |       Reference |     Build today |                Target |
| ---------------------------- | --------------: | --------------: | --------------------: |
| luma mean / p25              |   0.589 / 0.370 |   0.736 / 0.698 | 0.48–0.62 / 0.30–0.42 |
| near-white / deep shadow     |  27.3 % / 3.0 % |  6.0 % / 0.18 % |     12–30 % / 1.5–6 % |
| saturation mean              |           0.359 |           0.102 |             0.22–0.34 |
| sky blue area (top 40 %)     |            53 % |           1.2 % |               35–60 % |
| edge energy / local contrast | 0.0341 / 0.0713 | 0.0154 / 0.0376 |       0.022+ / 0.055+ |

Root causes (ordered by impact per hour): (1) auto-exposure meters the
_thresholded_ bloom mip and pins exposure at 2× on medium/high/ultra; (2) four
lights, no key/fill ratio, so shadows never read; (3) sun at 26.5° straight down
the route — white roofs cannot be white; (4) flat cream sky + a 110 m additive sun
billboard; (5) content: 12 props per 203 m, 91 % empty deck, no near facades, no
normal/roughness maps.

### Tier 0 — "Stop bleaching the frame" (1 day, no new content)

Branch: `feat/glassline-visual-tier0` from `project/glassline`.
Order matters: 0.1 → 0.2 first (everything else is measured through them).

- [ ] 0.1 Fix exposure metering: adapt pass meters the unthresholded scene (or
      manual exposure), then retune `LIGHTING.exposure` — `src/engine/render/index.js`
      (post pass `tLum`), `src/levels/atmosphere.js`. `fix(engine):` commit,
      cherry-pickable to `dev`.
- [ ] 0.2 One-key light rig — `src/levels/lighting.js`: sun 5.0, hemisphere 0.25
      (`#cfe4ff` / `#4a5a66`), rim 0.35, warm 0.20, env 0.12.
- [ ] 0.3 Sun to 55–60° elevation, 40–60° off the route axis — `src/levels/sun.js`;
      move the sun sprite/flare consumers with it.
- [ ] 0.4 Sky palette: `uTop #0a3d8f`, `uHorizon #a8c9e2`, `uBottom #c2d6e6`,
      exponent 0.32, glare 0.24→0.08 / 0.9→0.5 — `src/levels/sky.js`.
- [ ] 0.5 Remove the additive 110 m sun billboard — `src/levels/build.js`.
- [ ] 0.6 Put contrast on the ACES side of the grade (`agxMix 0` / whole-mix look,
      S-curve 0.35–0.45, lift 0.002–0.004, `lookSat 1.35`, `vignette 0.20–0.25`).
- [ ] 0.7 Bloom 0.05 @ 2.6, streak 0.015 @ 2.0, dirt 0.02, flare 0.08.
- [ ] 0.8 AO live again: fade `(1 − 0.5·lit)` at a fixed reference exposure;
      `aoRadius 1.2`, `aoIntensity 2.0`, `aoStrength 1.0` (defaults, not live).
- [ ] 0.9 Tighten the shadow box to ±28 m plan / −2…28 m height (73.45 × 60.75 m,
      3.59 cm texels at 2048²).
- [ ] 0.10 Raise the `high` render budget 2.3 → 3.0–3.4 Mpx, cap DPR — `src/game/main.js`.
- [ ] 0.11 Unify the three fog/air palettes; `fogDensity 0.0005–0.0007`,
      `volSigma 0.0012`, `volFarHaze 0.10`, `volAmbient 0.05`.

Acceptance for Tier 0: `npm run check`, `npm test`, `npx playwright test
tests/e2e/glassline.spec.js` green; before/after captures via
`tools/capture-visual.mjs`; `tools/image-metrics.py` re-run shows luma mean,
p25, saturation and near-white moving into the target bands; no `__errors`/`__fatal`.

### Tier 1–4 — the content and finish work (next, high priority)

- **Tier 1 (2–3 days):** day sky with cumulus + PMREM, first-person forearms via
  the empty view-model pass, mentor out of the spawn camera, HUD → reticle +
  prompt.
- **Tier 2 (~1 week):** normal/roughness maps, 1024–2048 atlas, parapets/copings/
  joints/drains, facade window depth.
- **Tier 3 (1–2 weeks):** prop density ×6–10, city canyon (corridor 6–9 m, near
  facades, street below), material consolidation.
- **Tier 4 (2 weeks+):** motion/character finish, final grade, golden screenshots.

Evidence rule: every tier re-runs the capture + metrics harness and records the
before/after table in `docs/VISUAL_GAP.md`. Comparison sheets that embed reference
frames stay local (`docs/visual-gap/shots/` is git-ignored) — no copied IP.

## 6. Step-by-step plan

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

Status: UI shell, art, audio and city-shell are merged. Saltline source has been
removed from `src/`; the original artifact remains at the repository root.

- [x] original GLASSLINE boot/loading screen replaces Saltline branding;
- [x] original GLASSLINE title, pause and completion overlay (merged);
- [x] start gates the timer/run and requests pointer lock;
- [x] in-progress start screen offers **Continue** or **Start over**;
- [x] Settings, Controls and Level Inspector are separate menu destinations;
- [x] pause on pointer-lock loss, resume/restart actions;
- [x] mouse sensitivity setting with localStorage persistence;
- [x] tutorial HUD already covers objective, checkpoint, timer/splits/best;
- [x] level inspector linked from the menu;
- [x] original art/theme pass on the tutorial blockout: textured concrete tops,
      platform edge lines, lit skyline windows, rooftop AC/vent/antenna/rail props,
      act-sign underline and three-light setup;
- [x] future-city/utopian palette pass: ivory and pale glass towers, cyan windows,
      brighter sky/fog, warm sun with cool rim light and exposure lift;
- [x] high-key sky/lighting, PMREM environment reflections, three contrasting
      facade material families and a luminous deep abyss instead of a dark street grid;
- [x] selective HDR bloom threshold in the existing post chain and emissive route
      accents, without a duplicate EffectComposer;
- [x] polish pass: side-mounted bent-arm idle/run pose, FrontSide wayfinding
      signs, high-quality 1.1 supersampling with final FXAA;
- [x] camera polish: sprint/slide FOV, procedural strafe/vault/wallrun roll,
      damped landing spring and head nod;
- [x] landing audio: speed-scaled double heel/toe hit, low concrete boom and
      cloth rustle layered over the existing footstep/SFX system;
- [x] generated city district around the route: terraced blocks, windows,
      skybridges, transit, roof gardens and signage; instanced draw calls;
- [x] procedural first-person courier rig and mentor character using capsule
      joints, with run/slide/vault animation and no external models;
- [x] explicit start/finish city clusters and a central spire landmark;
- [x] full surface/texture pass: procedural concrete, facade, roof, metal and
      asphalt maps, plus rooftop fascia, curbs, legs, AC/vents, huts and pipes;
- [x] design system document and redesigned instrument-style HUD with checkpoint
      toast (see [`docs/DESIGN.md`](docs/DESIGN.md));
- [x] original procedural music/SFX: wind bed, three-note pad, footsteps, jump,
      land, slide, vault, mantle, wallrun, wallclimb, roll, checkpoint, finish,
      respawn and UI cues (audio branch, not merged);
- [x] menu mute/volume controls with localStorage persistence;
- [x] settings view with dynamic controls, rebinding and reset (settings branch);
- [x] keyboard bindings model with conflict rejection and localStorage persistence;
- [x] speed-reactive wind/synth layers, city hum, grounded footstep/jump
      transients and a readable radio dispatch caption;
- [x] final QA and no-copied-IP audit — see [`docs/GLASSLINE_AUDIT.md`](docs/GLASSLINE_AUDIT.md)
      and [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md); no copied assets found.
- [ ] human audio QA and 10–20 minute pacing playtest.

Acceptance: coherent vertical slice; assets documented and licensed.

### Step 5 — Performance and reliability

Branch: `feat/glassline-polish` — **implemented, not merged**.

- [x] perf baseline: draw calls, triangles, geometries, frame time;
- [x] culling/LOD/quality: instanced windows/strips, merged edges and `?q=` profiles;
- [x] `?stats=1` / F3 diagnostics overlay;
- [x] automated low-quality draw-call/triangle/geometry budget;
- [x] save/load settings and checkpoints already covered;
- [x] fatal/`__errors` and repeated-reload reliability tests;
- [x] keyboard/rebinding scope tested; gamepad/touch intentionally out of scope;
- [x] hardware 60 FPS peak-load profile (Apple M1 Pro / Edge, 8.36 ms avg,
      p95 9.3 ms); script and result in [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md);
- [ ] human pacing/audio acceptance.

Evidence: [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).

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

## 7. Branch workflow

```text
dev (Phase 1 history)
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

## 8. Definition of done

- [ ] reference video analyzed and `docs/REFERENCE.md` written;
- [ ] all chosen mechanics implemented and tunable;
- [ ] tutorial level start-to-finish;
- [ ] original assets and license/NOTICE intact;
- [ ] unit, Playwright, golden, physics and perf tests green;
- [ ] boot/respawn/restart have no `__errors`/`__fatal`;
- [ ] target FPS measured on the chosen platform;
- [ ] `dist/index.html` builds and is served over HTTP;
- [ ] visual gap to the reference measured and Tier 0–2 acceptance metrics met
      (`docs/VISUAL_GAP.md` targets, `tools/image-metrics.py` evidence);
- [ ] `project/glassline` contains the plan, observations and release notes.

## 9. Reference documents

- [`docs/REFERENCE.md`](docs/REFERENCE.md) — timestamped observations and starting targets;
- [`docs/MOVEMENT.md`](docs/MOVEMENT.md) — movement/capsule/state-machine spec;
- [`docs/CAMERA.md`](docs/CAMERA.md) — camera, FOV, roll, landing and accessibility spec;
- [`docs/REFERENCE.md`](docs/REFERENCE.md) notes the video is local and untracked.

## 10. Timeline

| Step                 | Estimate      |
| -------------------- | ------------- |
| Skeleton             | 2–4 days      |
| Physics + core moves | 2–3 weeks     |
| Tutorial/content     | 1–2 weeks     |
| Art/audio/UI         | 1–2 weeks     |
| Polish/playtest      | 1 week        |
| **Total**            | **5–9 weeks** |

These are agent+human estimates and depend on the reference video and playtests.
