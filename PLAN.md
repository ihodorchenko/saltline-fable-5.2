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

**Priority: P0.** Outranks every unfinished Step 4/5 item. **Tier 0 is merged
into `project/glassline` (2026-11-15, `dbd3a6f`; feature branch deleted). Tier 1
is merged into `project/glassline` (2026-11-15, `c8047db`; feature branch
deleted). Tier 2 is merged into `project/glassline` (2026-11-15, `f25bfd4`;
feature branch deleted). Tier 3 is merged into `project/glassline` (2026-11-15,
`d86f5f7`; feature branch deleted). Tier 4 is merged into `project/glassline`
(2026-11-15, `ae453b7`; feature branch deleted) — **the P0 visual block is
closed**. A follow-up content pass (Tier 5) is merged into `project/glassline`
(2026-11-15, `63a0c35`; feature branch deleted). The owner-driven materials + route
content pass is merged into `project/glassline` (2026-11-16, `1923c24`; feature
branch deleted); measured results in
[`docs/VISUAL_GAP.md §5.1–5.6` and §6](docs/VISUAL_GAP.md). The measured visual gap
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

### Tier 0 — "Stop bleaching the frame" (1 day, no new content) — merged 2026-11-15

Merged from `feat/glassline-visual-tier0` (branch deleted after integration).
Order matters: 0.1 → 0.2 first (everything else is measured through them).

- [x] 0.1 Fix exposure metering: adapt pass meters the unthresholded scene (or
      manual exposure), then retune `LIGHTING.exposure` — `src/engine/render/index.js`
      (post pass `tLum`), `src/levels/atmosphere.js`. `fix(engine):` commit,
      cherry-pickable to `dev`.
- [x] 0.2 One-key light rig — `src/levels/lighting.js`: sun **6.2** `#fff4e2`,
      hemisphere **0.5** (`#bcd9ff` / `#4e6274`), rim 0.35, warm 0.20, env 0.14
      (landed higher than the first proposal after the exposure fix: lit surfaces
      need the punch to reach near-white).
- [x] 0.3 Sun to 55–60° elevation, 40–60° off the route axis — `src/levels/sun.js`
      (`[-0.52, 0.93, -0.42]`); the sun-disc-in-sky assignment removed the billboard
      this item used to depend on.
- [x] 0.4 Sky palette: `uTop #0a3d8f`, `uHorizon #a8c9e2`, `uBottom #c2d6e6`,
      exponent 0.32, glare 0.24→0.08 / 0.9→0.5 — `src/levels/sky.js`.
- [x] 0.5 Remove the additive 110 m sun billboard — `src/levels/build.js`.
- [x] 0.6 Put contrast on the ACES side of the grade — `agxMix 0`, S-curve **0.27**
      (0.38 crushed the shadows past the reference), lift 0.002/0.003/0.004,
      `lookSat 1.3`, `vignette 0.22`, `grain 0.012`.
- [x] 0.7 Bloom 0.05 @ 2.6, streak 0.015 @ 2.0, dirt 0.02, flare 0.08.
- [x] 0.8 AO live again: fade `(1 − 0.5·lit)` at a fixed reference exposure;
      `aoRadius 1.2`, `aoIntensity 2.0`, `aoStrength 1.0` (defaults, not live).
- [x] 0.9 Tighten the shadow box to **±22 m plan / −2…26 m height** → measured
      **63.88 × 68.59 m, 3.12 × 3.35 cm texels** at 2048² (the ±28 m proposal
      measured 80.8 × 83.5 m).
- [x] 0.10 Raise the `high` render budget 2.3 → 3.0–3.4 Mpx, cap DPR — `src/game/main.js`.
- [x] 0.11 Unify the three fog/air palettes — fog `#cfe3ef`, `fogDensity 0.0006`,
      `volSigma 0.0012`, `volFarHaze 0.10`, `volAmbient 0.05`.

Acceptance for Tier 0: `npm run check`, `npm test`, `npx playwright test
tests/e2e/glassline.spec.js` green; before/after captures via
`tools/capture-visual.mjs`; `tools/image-metrics.py` re-run shows luma mean,
p25, saturation and near-white moving into the target bands; no `__errors`/`__fatal`.

Result (2026-11-15): **met.** 7 of 13 acceptance metrics in band — luma mean
0.736 → 0.579 (ref 0.589), p25 0.698 → 0.416 (0.370), near-white 6.0 % → 14.7 %
(27.3 %), saturation 0.102 → 0.311 (0.359), local contrast 0.0376 → 0.0560.
`npm run check`, 109 unit tests and 28 Playwright tests pass; build 889 kB. The
remaining failures are content metrics (p95/white area, edge energy, far-field
contrast, route paint, dark-pixel tint) owned by Tier 1–3. Engine commits are
`fix(engine):`-prefixed so they can be cherry-picked to a `fix/engine-*` branch
for `dev`.

### Tier 1 — "Sky and body" (2–3 days) — merged 2026-11-15

- [x] Day sky with cumulus: six-octave fbm deck (`src/levels/sky.js`) with sunlit
      tops, blue-grey bases, silver lining, sun disc and slow drift; PMREM
      environment re-captured from the same sky. Deterministic noise, no external
      assets.
- [x] First-person hands on the engine's **layer-1 view-model pass**:
      `src/game/glassline/viewmodel.js` (sleeves, forearms, cuffs, red wrist
      trackers, hands + thumbs) with run/sprint swing, slide lean-back, wallrun
      reach and airborne lift. The old world-space courier rig no longer draws.
- [x] Mentor out of the spawn camera: ~7 m ahead on the first gap roof, adult
      scale, jacket hem/neck/shoulder caps, hair cap instead of a ball, and it now
      casts a shadow.
- [x] Minimal in-run HUD: 6 px reticle + one contextual prompt = **0.62 % of a
      1080p frame** (was 4.93 %); TIME/BEST/CHECKPOINT moved to the pause menu.

Result: **9 of 13 acceptance metrics in band** (up from 7). Sky acceptance met:
`sky_blue_frac` 44 % (> 35 %), `sky_sat_mean` 0.297 (> 0.25), `sky_luma_std`
0.190 (> 0.15). `npm run check`, 118 unit tests, 29 Playwright tests green;
build 898 kB.

### Tier 2 — "Surfaces" (~1 week) — merged 2026-11-15

- [x] Normal + roughness maps generated from the same procedural canvases (Sobel
      normals, shared per material family), applied to platform tops/sides, curbs,
      coping, huts, legs, obstacles, service props, route paint and every city
      material (glass curtain walls get a roughness map too).
- [x] Bigger atlas: concrete/side/facade/glass 512 → **1024**; metal 256 → 512,
      route paint 128 → 256. Normals generated at 512 (roughness 256).
- [x] Surface-format geometry: a coping cap overhangs every roof curb (one
      instanced mesh), so the slab edge has a profile instead of one flat band.
- [x] Continuous red route: the strip spans the full roof depth; route paint
      19 % → ~85 % of the route length.
- [x] Sparse catenary cables across the gaps, outside the route corridor and above
      head height (one instanced mesh).
- [x] Shaded slab sides, fascia, service props and view-model sleeves lightened and
      cooled, so the deep-shadow share returns inside the reference band and dark
      pixels are bluer.

Result: **10 of 13 acceptance metrics in band** (up from 9); Tier 2 acceptance met
(`edge_energy` 0.0220 ≥ 0.022, `local_contrast` 0.0572, `contrast_top_third`
0.0421). Cost: 67 k → 77.5 k triangles, 390 → 413 draw calls, +9 kB build.
`npm run check`, 118 unit tests and 29 Playwright tests green.

### Tier 3 — "A city, not a test map" (1–2 weeks) — merged 2026-11-15

- [x] Canyon composition: route corridor 15 → **9 m**, a deterministic row of near
      facades (26–58 m tall) whose inner face sits just outside it, and taller
      inner blocks (16–50 m). The reference's close-vertical sightline is the
      default now instead of a distant box horizon.
- [x] Facade lattice: window bands every **2.8 m** (was 5 m) filling the visible
      facade, vertical mullions every ~1.55 m on near walls, and body textures
      tiling at building scale instead of stretching six windows over a tower.
- [x] Rooftop service kit v2: second condenser bank + vent stack on most roofs,
      dish antennas, duct runs, and billboards with an ivory panel and the red
      rule; instanced, high/ultra only.
- [x] Shade lift: sky fill raised (hemisphere 0.5 → 0.74) and cumulus tops
      brightened, because the canyon put far more shaded facade in frame.

Result: **11 of 13 acceptance metrics in band** (up from 10); Tier 3 acceptance
met (`edge_energy` **0.0280** ≥ 0.028, `contrast_top_third` **0.0554** ≥ 0.045,
within 5 % of the reference). The two remaining misses are p95 (amount of
near-white surface in frame) and dark split-tone (material palette). Tried and
reverted: raising the exposure ceiling moved p95 into band but pushed p25 and
sky-blue out — a net loss. Cost: 421 draw calls, 75.9 k triangles, 63 textures,
906 kB build; the new density is gated to high/ultra.

### Reference-driven content backlog (P1–P3) — from the prologue walkthrough (2026-11-16)

The second reference video (full prologue + training, see
[`docs/reference/PROLOGUE-ANALYSIS.md`](docs/reference/PROLOGUE-ANALYSIS.md)) yields a
concrete backlog with specs, files and acceptance checks in
[`docs/reference/PROLOGUE-BACKLOG.md`](docs/reference/PROLOGUE-BACKLOG.md):

- **P1 props** — solar PV arrays, AC units with circular fan grilles, glass
  skylights with scene reflections, red functional props (ladders, pipes, rails).
  Closes the two consistent reference gaps: near-white area (12.6 % vs 24–27 %) and
  red accent area (2.1 % vs 2.9–4.2 %).
- **P2 level structure** — covered service block with skylights/lockers/red stair in
  the act II courtyard, orange safety fencing, white plant-room volumes.
- **P3 life and finish** — distant helicopter, opening fly-in, audio "air" band
  (our ambience is 98.6 % below 500 Hz vs the reference's more open top end).

Status: **implemented** on `feat/reference-prologue-kit` (merge pending) — P1 props
(solar PV, AC fan grilles, glass skylights, red ladders/pipes/rails), P2 structure
(covered service block with skylights/lockers/red stair, orange fencing, white
plant rooms), P3 life (helicopter, opening fly-in, audio air band). Measured in
[`docs/VISUAL_GAP.md §7`](docs/VISUAL_GAP.md): 13/13 acceptance metrics still in
band, red accent 2.07 → 2.21 %, but near-white did not rise (12.6 → 12.4 %): the
new white volumes face the camera shaded, so closing that gap needs a
lighting/exposure or white-facade pass, not more props.

### Audio pass — mix, space, surfaces and score (2026-11-16) — merged 2026-11-16

Merged into `project/glassline` as `72f4c36` (2026-11-16) from
`feat/glassline-audio-pass`; the feature branch was deleted after integration.

Owner: "доводим звук до ума" (bring the procedural audio up to a good level),
in the reference's spirit (wind, distant city, cloth/gear, crisp footsteps, a
sparse ambient score, spacious rooftop reverb) — all original synthesis, no
samples.

- [x] Mix bus: layer buses → gentle compressor → limiter → master volume, a
      **procedurally synthesized stereo convolution reverb** on a send, and
      ducking of ambience + music under dispatch/checkpoint/finish/respawn
      stingers (the stinger itself is never ducked).
- [x] Ambience v2: two-band wind with slow gusts and speed response, city bed plus
      a distant-traffic chatter band, cloth/gear rustle tied to speed, and a real
      **score**: original Am9 → Fmaj7 → Cmaj7 → G6 loop (3.5 s/chord, four detuned
      pad voices, quiet sub and arpeggio) whose filter opens with speed and closes
      for the finale.
- [x] Continuous motion loops: slide friction and wall-run scuff driven by the
      controller state, instead of one-shots only.
- [x] Surfaces: `surfaceResponse()` + per-surface footsteps/landings keyed off the
      physics collider surface; the level now tags the red balance beams, the
      service shelf and the act III gangway as `metal` so those variants are heard
      in normal play. Heel/toe variation, alternating-foot pan and deterministic
      jitter.
- [x] Spatial cues: checkpoint/finish/respawn cues panned toward the target from
      the camera yaw, with distance attenuation.
- [x] Enclosure: `audioZones` on the level; inside the act II courtyard the wind
      and city drop, the city is low-passed and the reverb opens up.
- [x] Testability and evidence: 33 new pure-helper unit tests (mix math, surfaces,
      enclosure, pan, ducking, music, cadence); `tools/audio-render.mjs` renders
      the real graph through an `OfflineAudioContext` into
      `artifacts/audio/` (24-bit WAV + manifest: K-weighted LUFS, true peak, RMS,
      spectral centroid, band energies) and fails on clipping/silence. A
      `demo.wav` (36.8 s) is the listening artefact.

Measured: ambience idle −21.6 LUFS / sprint −19.0 / courtyard −23.4 (darker,
613 Hz centroid vs 1171 outside); SFX peaks −8.8 dBFS, no clipping; 98 % of the
ambience energy below 500 Hz; footsteps 74 % in 800–4000 Hz; dispatch duck
−8.4 dB; chord centroid moves 256 → 234 Hz across the progression; graph is
54 persistent nodes and `updateState` allocates none.

Open: the owner's ears decide musical taste, gust depth, wind-vs-music balance and
reverb density — these are the remaining knobs, with the measured renders as the
reference point. CPU cost of the audio graph in-game was not measured.

### Owner content pass — materials and route (2026-11-15) — merged 2026-11-16

Owner feedback after Tier 5: materials still read plastic and the glass did not
read as glass; the route was linear ("just a run") and should be multi-level and
non-linear like the reference. Two parallel passes, one branch:

- [x] **Materials.** Relief-first texture pipeline (one shared height canvas per
      family drives both normal and roughness maps), warm plaster albedo with
      stains/run-off, dark-tinted reflective curtain-wall glass with per-bay
      variation and per-instance tower tints, brushed metal, and **scene
      reflection probes**: `src/levels/reflections.js` captures two CubeCamera
      views of the actual city at route height and PMREMs them into the glass and
      metal env maps. Geometry/draw-call hygiene: 124 → 94 materials, 429 → 329
      draw calls at the start view, triangles +8 % (inside budget).
- [x] **Route.** Rebuilt as a vertically layered, non-linear course on the same 21
      checkpoint ids and 3 acts: vertical range 17.8 m (−5.9 … +11.9), 219 m long,
      with a mantle annex, wall-run gap, wall-climb parapet, a +11.9 m summit and a
      drop through lower roofs, a 3-tier walled courtyard open to the sky
      (+4.2 → −5.9 m), a loop around a free-standing core with a side corridor
      that rejoins, a low-duct slide, an outside mantle climb, and a high/low
      branch that rejoins at `final-b`. Lateral weave ±5 m (canyon-bound).
- [x] Rebalanced exposure for the darker mix (auto key 0.28 → 0.35, sky fill 0.74
      → 0.92, highlight lift 0.12 → 0.15) and recalibrated the golden bands as a
      regression guard.

Result: **13/13 acceptance metrics still in band** on the new content (near-white
12.6 %, p95 0.954, deep shadow 3.7 %, split-tone −45.0, top-third 0.0597),
`npm run check` / 135 unit tests / 30 Playwright tests green. Known builder-visual
compromises are listed in VISUAL_GAP §6.2 (route strips, roof kit on mantle
ledges, shaded courtyard floor).

### Tier 5 — content pass (follow-up) — merged 2026-11-15

- [x] White architecture in frame: white parapet caps on every near canyon facade,
      white setback terraces at two heights per facade, denser balcony bands and a
      higher white-facade share on the canyon walls; cloud cover up slightly.
- [x] Material consolidation: platform tops share one material per palette colour
      via world-space UVs (26 → 3 materials), obstacles/scenery/flat props pooled,
      city white geometry instanced. **155 → 123 materials.**
- [x] All 13 acceptance metrics hold; top-third contrast now within 1 % of the
      reference (0.0580 vs 0.0585) and local contrast within 5 %.

Open item carried forward: `near-white` 15.4 % vs 27.3 % is a **level-content**
property (the reference spends most of its time on open sunlit white roofs; our
route threads a canyon with shaded walls) — closing it means redesigning the
route toward open white roofs, not adding props. Material count below ~120 needs
texture-family atlasing rather than palette work.

### Tier 4 — motion and finish (2 weeks+) — merged 2026-11-15 (P0 closed)

- [x] Head bob: speed-scaled (~1.2 cm vertical, 0.7 cm lateral, 0.2° roll at
      sprint), damped in/out, grounded only, extracted as the pure `bobOffset()`
      helper with unit tests.
- [x] View-model legs: thigh/shin/shoe per leg on the layer-1 pass — standing they
      hang below the frame, a slide swings them forward, a roll tucks them, and
      they stride while running.
- [x] Final grade: stronger/cooler split tone, cooler highlights, bluer lifted
      blacks and a top-of-range highlight lift (clipped whites); live saturation
      moved from the inert `lookSat` (AgX branch) to `render.post.saturation`.
- [x] Golden harness: `npm run golden` writes ten route frames + a metrics
      manifest to `artifacts/golden/`; `glassline-golden.spec.js` asserts the look
      stays inside calibrated luma/p95/saturation bands.

Result: **13 of 13 acceptance metrics in band** — the measured visual gap that
opened the P0 analysis is closed on the metric set that defined it (from 0/13 at
the baseline). p95 0.953 and dark split-tone −40.2 both entered band this tier.
Cost: 427 draw calls, 76.9 k triangles, 63 textures, 907 kB build.
`npm run check`, 123 unit tests and 30 Playwright tests green.

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
