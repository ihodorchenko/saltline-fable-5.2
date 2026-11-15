# GLASSLINE — visual gap analysis vs the 2008 reference

Status: **analysis complete, 2026-11-15**. No `src/` change was made for this
document; everything below is either measured from the current build or read
from the code. The reference is the owner-provided local walkthrough of the
Mirror's Edge 2008 tutorial (`docs/reference/*.mp4`, untracked): it is used for
observation and measurement only, no frame, asset, texture, level data or UI is
copied into GLASSLINE.

Companion files (in `docs/visual-gap/`):

| File | What it is |
| --- | --- |
| [`docs/visual-gap/01-renderer-audit.md`](visual-gap/01-renderer-audit.md) | Render-pipeline inventory, shadow/material detail, per-lever table with values and cost |
| [`docs/visual-gap/02-metrics.md`](visual-gap/02-metrics.md) | Method and interpretation of the image metrics, caveats |
| [`docs/visual-gap/03-content-audit.md`](visual-gap/03-content-audit.md) | Level/prop/city/character/HUD inventory and missing content families |
| [`docs/visual-gap/metrics.json`](visual-gap/metrics.json) | Raw per-image numbers and set aggregates for the baseline (pre-Tier-0) build |
| [`docs/visual-gap/metrics-tier0.json`](visual-gap/metrics-tier0.json) | The same run against the Tier-0 build (`metrics.json` without `--out-json` overwrites the baseline; keep both) |
| [`docs/visual-gap/metrics-tier1.json`](visual-gap/metrics-tier1.json) | The same run against the Tier-1 build (cumulus sky, view model, minimal HUD) |
| [`docs/visual-gap/metrics-tier2.json`](visual-gap/metrics-tier2.json) | The same run against the Tier-2 build (normal/roughness maps, coping, continuous route, cables) |
| [`docs/visual-gap/metrics-tier3.json`](visual-gap/metrics-tier3.json) | The same run against the Tier-3 build (canyon composition, facade lattice, rooftop service kit) |
| [`docs/visual-gap/metrics-tier4.json`](visual-gap/metrics-tier4.json) | The same run against the Tier-4 build (motion finish, view-model legs, final grade) |
| `docs/visual-gap/shots/` | Reference frames, current captures, comparison and proof sheets — **local only, git-ignored**: several sheets embed frames of the owner-provided reference video and must not be committed or redistributed. Regenerate with the tools below. |

---

## 0. TL;DR

1. **The renderer is not the bottleneck.** The engine already ships HDR, AgX/ACES
   tonemapping, a fitted soft-shadow map, GTAO, shadowed volumetric haze, a
   6-level bloom chain, sun flare, motion blur and FXAA. Almost none of it is
   pointed at the reference's look.
2. **The frame is measurably wrong in a specific way.** We are ~25 % too bright,
   ~39 % too flat, ~72 % undersaturated; our darkest quarter of the image is
   **89 % brighter** than the reference's; near-white area is **78 % smaller**;
   deep shadow is **94 % rarer**; and the sky band contains essentially **no blue**
   (1 % of pixels vs 53 %). See §2.
3. **A real bug sits on top of the art direction.** On `q=high|medium|ultra` the
   auto-exposure meters luminance from the *thresholded* bloom chain, reads ~0.002,
   and pegs exposure at the 2× clamp. The same scene on `q=low` (bloom off) is
   visibly darker and twice as saturated. This is a one-line fix and the single
   highest-value change in the codebase. See §3.1.
4. **We also throw away resolution.** The `high` tier renders a 2.3 Mpx buffer
   and upscales ~1.9× to a Retina canvas; measured frame cost is 8.36 ms against
   a 16.7 ms budget, i.e. ~2× headroom while everything is soft. See §3.10.
5. **Half of the gap is tuning, not content.** A runtime look-dev probe (same
   geometry, same assets, values only) moves the primary metrics from
   `mean 0.71 / p25 0.66 / sat 0.10 / deep 0.1 %` to `0.39 / 0.24 / 0.25 / 7.5 %`
   against a reference of `0.59 / 0.37 / 0.36 / 3.0 %` — i.e. one day of tuning
   crosses most of the *tone* gap. It does **not** move detail metrics
   (edge energy 0.0098 → 0.0111 vs 0.0341 reference): that half is content.
   See §5.
6. **The content bill is explicit.** 26 box platforms, **12 authored props on 203 m
   of route** in 5 archetypes (plus 638 generated edge-anchored modules, leaving
   **91 % of the deck empty**), a city whose median near facade is **34.7 m away**
   with a roofline only 4.3 m above the eye — a flat horizon rather than a canyon —
   one 512² procedural texture atlas with no normal maps, **51 % of the level's
   triangles spent on 21 checkpoint rings** and 12 % on all architecture, a capsule
   mentor 3 m in front of the spawn camera and a HUD covering 4.9 % of the frame.
   The 2008 reference roof shows 30–60 identifiable objects per frame, a canyon of
   facades 3–10 m from the route, and white architecture that clips to near-white
   while its shadow side sits at 0.25–0.40 in strong blue. See §3.6–§3.8 and the
   content audit.
7. **Tiers 0–4 are implemented** (2026-11-15; Tier 4 pending merge) — same
   measurement harness, final before/after: luma mean 0.736 → **0.570**
   (reference 0.589), p25 0.698 → **0.395** (0.370), near-white 6.0 % → **15.3 %**
   (27.3 %), deep shadow 0.18 % → **5.7 %** (3.0 %), saturation 0.102 → **0.331**
   (0.359), sky blue 1.2 % → **51.1 %** (53.1 %), edge energy 0.0154 → **0.0283**
   (0.0341), top-third contrast 0.0188 → **0.0556** (0.0585), dark split-tone
   −17.1 → **−40.2** (−48.6), red route paint 1.05 % → **2.17 %** (4.2 %):
   **all 13 acceptance metrics in band** (§5.5). Tier 1: cloud deck, hands,
   mentor, minimal HUD. Tier 2: normal/roughness maps, 1024 atlas, coping,
   continuous route, cables. Tier 3: canyon, facade lattice, service kit. Tier 4:
   head bob, view-model legs, the final grade pass and the golden harness.
8. **Realistic goal.** A convincing "2008 AAA read" in WebGL is reachable for
   tone, value structure and composition (Tier 0–1, ~3–4 days) and for surface
   and prop density (Tier 2–3, ~2–3 weeks). Photogrammetric photorealism is not
   the goal and not needed — the reference itself is a stylised white/grey city
   with a very tight value range and one strong accent colour.

---

## 1. Method

- **Reference sample:** 24 frames extracted from the local 8:37 walkthrough
  (1920×810, 60 fps) at fixed timestamps, 13 of them classified as outdoor
  platforming gameplay (the rest are interior/combat/cinematic and excluded from
  the primary comparison).
- **Current sample:** 11 fresh 1920×1080 captures of the shipped build at
  `?show=glassline-tutorial&q=high` from 10 route checkpoints plus one sky view, HUD hidden, plus
  older `artifacts/*.png` for sensitivity checks. Captured with
  [`tools/capture-visual.mjs`](../tools/capture-visual.mjs).
- **Metrics:** [`tools/image-metrics.py`](../tools/image-metrics.py) — luminance
  distribution, local contrast, Sobel edge energy, HSV saturation, colourfulness,
  sky-band statistics, split toning, red-accent coverage. Definitions and caveats
  (YouTube compression, burned-in UI band, different content) are in
  [`02-metrics.md`](visual-gap/02-metrics.md).
- **Look-dev probe:** [`tools/lookdev-probe.mjs`](../tools/lookdev-probe.mjs) —
  boots the build, mutates only live values (`render.tune`, light intensities,
  fog, sky uniforms, `autoExposure`), captures the same three viewpoints per
  preset. It proves what is reachable without touching `src/`.

Reproduce:

```sh
npm run dev
node tools/capture-visual.mjs --out docs/visual-gap/shots --prefix current --quality high --channel msedge
python3 tools/image-metrics.py --skip-extract   # needs numpy + Pillow
node tools/lookdev-probe.mjs
```

(`--channel msedge` or `PLAYWRIGHT_CHANNEL` because no Playwright chromium is
installed on this machine.)

---

## 2. The measured gap

Primary comparison, `reference_primary` (13 outdoor gameplay frames) vs
`current_new` (11 fresh captures). Full table and per-image data in
[`metrics.json`](visual-gap/metrics.json).

| Metric | Reference | Current | Δ | Reads as |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.589 | 0.736 | **+25 %** | frame is too bright overall |
| luma std (global contrast) | 0.272 | 0.166 | **−39 %** | no value range |
| luma p1 | 0.112 | 0.205 | **+83 %** | blacks are lifted |
| luma p5 | 0.183 | 0.337 | **+84 %** | shadow information missing |
| luma **p25** | 0.370 | 0.698 | **+89 %** | *the* tell: the dark quarter is almost lit |
| luma p50 | 0.595 | 0.774 | +30 % | mids too high |
| luma p95 | 0.979 | 0.904 | −8 % | highlights are *dim* (no true whites) |
| luma p99 | 0.998 | 0.937 | −6 % | **never reaches white** (fully separated) |
| near-white (luma > 0.90) | 27.3 % | 6.0 % | **−78 %** | white architecture never reads white |
| deep shadow (luma < 0.12) | 3.0 % | 0.18 % | **−94 %** | almost no deep shadow anywhere |
| HSV saturation mean | 0.359 | 0.102 | **−72 %** | palette is bleached |
| saturation p90 | 0.745 | 0.279 | −63 % | accents do not accent |
| colourfulness (Hasler–S.) | 71.1 | 22.5 | **−68 %** | same |
| local contrast (16 px blocks) | 0.0713 | 0.0376 | **−47 %** | surfaces have nothing to look at |
| edge energy (Sobel) | 0.0341 | 0.0154 | **−55 %** | half the geometric detail |
| contrast, top third | 0.0585 | 0.0188 | −68 % | **distance is a white void** |
| sky blue coverage (top 40 %) | 53 % | **1.2 %** | **−98 %** | there is no sky, only glare |
| sky saturation | 0.398 | 0.075 | −81 % | same |
| split tone: dark R−B | −48.6 | −17.1 | +65 % | shadows are not blue enough |
| split tone: bright R−B | −4.6 | +13.3 | — | highlights are warm where the reference is neutral-cool |
| red accent coverage | 4.2 % | 1.05 % | **−75 %** | route language is too shy |
| scene mean R−B | −31.1 | −1.5 | — | the whole frame lacks the reference's cool cast |

Three of these gaps are **fully separated** — every reference frame and every
current capture sit on opposite sides of the gap, so no content difference or
compression artefact can explain them: `luma_p99` (reference min 0.987 > current
max 0.950), `sat_mean` (reference min 0.145 > current max 0.123) and
`sky_blue_frac` (reference min 0.117 > current max 0.048). 32 of 37 metrics
survive all five sampling variants; of the non-robust ones only
`contrast_top_over_bottom` matters for the argument here and is treated as a soft
composition check, not as evidence. See `02-metrics.md`.

What this says in plain terms:

- The reference is a **high-contrast, cool-balanced, saturated** image whose
  whites are genuinely white (27 % of the frame above 0.9) and whose shadows are
  genuinely dark and blue (p25 = 0.37, dark-pixel R−B = −49). We are a
  **low-contrast, neutral-warm, bleached** image where the darkest quarter sits
  at 0.70 and nothing is ever white or black.
- The largest single-cause gaps are `frac_deep_shadow` (0.94 relative gap),
  `sky_blue_frac` (0.98), `near_white` (0.78), `sat_mean` (0.72),
  `red_accent_frac` (0.75), `contrast_top_third` (0.68), `edge_energy` (0.55).
- The ranked gap list is in `metrics.json → comparisons.primary.rows`; the
  robustness pass (`robustness`) re-tests every metric across five sampling
  variants so content differences cannot fake a conclusion.

---

## 3. Root causes

Ordered by visual impact per hour, with code references. Numbers in brackets are
current values read from the running build.

### 3.1 Auto-exposure is metering the wrong image — the 2× overexposure bug

On every post-processed quality tier the adapt pass takes its luminance source
from the deepest bloom mip instead of the scene:

- `src/engine/render/index.js:616` — `be.tLum.value = ve.bloom ? y.down[b-1].texture : xe`
- the bloom chain thresholds on its **first** downsample only
  (`src/engine/render/index.js:393-411`, `uThreshold = g.bloomThreshold` = 1.8 in
  HDR) and every later mip is a plain downsample of that thresholded signal,
  so `down[5]` is near-black for a scene whose HDR values are ~0.5-3.
- the adapt pass then computes `pow(uKey / avg, 0.85)` with `uKey = 0.12`
  (`src/engine/render/index.js:434-459`, tune `minExposure: 0.6, maxExposure: 2`)
  and clamps to the ceiling.

Observed on the live build at `q=high`:
`adapt = { lum: 0.002, auto: 2.0 }` → the whole frame is multiplied by **2.0**.
At `q=low` (bloom disabled → `tLum` falls back to the HDR scene texture) the same
scene meters `lum = 0.232` → exposure **0.6**: a **3.3× exposure swing between
quality tiers for identical geometry**, and the low tier is the correctly exposed
one. Measured on the same viewpoint: mean luma **0.516 vs 0.753**, saturation
**0.205 vs 0.100**. The bug therefore also means *low quality looks better graded
than high quality*.

Fix (hours): build a proper luminance source — sample the HDR scene texture in
the adapt pass (what `q=low` already does), or add one extra unthresholded
downsample before the bloom threshold. Then retune `LIGHTING.exposure` and the
grade, because the current grade (lookPower 1.28) was tuned around 2×
overexposure.

Expected effect: mean luma 0.74 → 0.55-0.60, saturation +80 %, highlights stop
blowing into a milky wash. This is the cheapest, largest single change available.

### 3.2 The light rig has no key/fill ratio

`src/levels/lighting.js:8-20` and `:42-53`:

| Light | Value | Problem |
| --- | --- | --- |
| engine sun (`key`) | intensity 3.4, `#fff1d6` | the only shadow caster, but see 3.3 |
| hemisphere | 0.85, sky white | lifts every shadow to near-lit level |
| cool "rim" directional | 1.0, `#b9e4ff`, no shadow | second key light from the same half-space |
| warm fill directional | 0.5, `#ffd0a4`, no shadow | third key |
| environment (PMREM sky) | 0.34 × 1.35 view fill ≈ 0.46 | pale sky IBL adds to the wash |

Total non-shadowed ambient/fill is comparable to the sun, so **nothing is ever in
shadow**. Measured on the live build: zeroing `shadow.intensity` changes only
**3.9 % of pixels** by more than 3/255 (max 27/255) — the shadow map contributes
about **2 % of the frame**. In the reference the sun is the only key, the sky is
the fill, and the shadow side is 25–40 % of the lit side and clearly blue.

Target: sun 4.5–5.5 (warm white), one hemisphere at 0.2–0.3 with a **blue** sky
colour and a grey-blue ground colour, no rim/fill directional lights (or ≤0.15),
environment 0.10–0.15. Then the value structure in §2 collapses into range.

### 3.3 The sun is a sunset, aimed at the camera

`src/levels/sun.js:6` — `SUN_DIRECTION = [0.3, 0.45, -0.85]` → elevation
**26.5°**, azimuth straight down the route (−Z), i.e. the player runs *into* the
sun for the whole tutorial.

Consequences: horizontal surfaces receive `sin(26.5°) = 0.45` of the sun, so a
white roof can never read white (the reference's roofs are at 0.9–1.0); every
facade facing the camera is backlit, so the frame loses the raking side-light
that makes the reference's architecture legible; and the on-screen sun sits in
the middle of the frame, feeding the flare/bloom wash.

Target: elevation **55–60°**, azimuth ~40–60° off the route axis, e.g.
`[-0.55, 0.95, -0.45]`. Note the two consumers that must move with it: the
additive `glassline-sun` sprite has a hard-coded position
(`src/levels/build.js:576-591`, `sunSprite.position.set(34, 58, -190)`) and the
PMREM/reflection environment is generated from the sky at startup
(`src/levels/sky.js:64-78`, `src/engine/render/index.js` env capture).

The 110 m additive `glassline-sun` sprite is **not attached to the light**: it sits
at a fixed world position, so its angular offset from the true sun grows from
**14° at spawn to 60° at the finish** (29.4° across at spawn, 80.6° at the finish).
Hiding the sprite and zeroing the flare changes **12.7 % of the frame**.

Measured (temporary local experiment, reverted): raising the sun alone does not
help while §3.1-§3.2 are unfixed — exposure compensates. Order matters: fix
exposure and fill first, then the sun angle is what makes roofs white.

### 3.4 There is no sky

`src/levels/build.js:559-563` hides the engine's procedural cloud sky and
replaces it with a 5-uniform flat gradient dome
(`src/levels/sky.js:13-57`: top `#1454a6` at full strength but mixed with a
near-white horizon at `pow(h, 0.55)`, so the visible band is cream), plus an
additive 110 m × 110 m sun sprite at 190 m
(`src/levels/build.js:565-591`) that floods a third of the frame.

Measured: `sky_blue_frac` **1.2 % vs 53 %**, `sky_sat_mean` **0.075 vs 0.398**,
`sky_luma_mean` **0.78 vs 0.53**, `sky_luma_std` **0.10 vs 0.22** (the reference
sky has clouds → variance). The sky is 20–40 % of a first-person frame; with no
sky colour and no cloud structure the image can never reach the reference's
saturation or contrast.

Why the dome is cream even though its "top" colour is blue: the gradient uses
`pow(h, 0.55)`, which pushes the near-white horizon colour up to the elevations
that are actually on screen. Computed through the same tonemap/grade as the game,
the dome renders **(223, 222, 220) at 20° elevation and (214, 215, 218) at 30°**
at exposure 2 — neutral white — while the reference's screen rows at comparable
elevations are **(65, 99, 213) / (56, 106, 185) / (69, 120, 228)**. The blue only
appears above ~45°, which is off-screen in normal play. The audit's palette test
(`uTop #0a3d8f`, `uHorizon #a8c9e2`, exponent 0.32, exposure 1) computes to
**(82, 126, 184) at 20° / (53, 99, 176) at 37°** — a match within a few units.

Caveat: the sky is also the PMREM source for every reflective material, so the
palette and the environment must be re-captured together.

The engine already contains a working fbm cumulus sky with a cloud deck, sun
disk, aureole and cloud self-shadowing (`src/engine/render/index.js:78-166`), but
it is written for a different (storm/fire) art direction — it is *currently
hidden*. Re-colour it for a clear day (blue zenith, white cloud tops, no fire
tint, tighter deck) and use it; or write a small day-sky shader with 2–3 fbm
octaves. Remove the additive sprite; put the sun disk and glare in the sky.

Probe evidence: preset `D` re-showed that sky with blue zenith values and the
frame instantly gained cloud structure (`shots/lookdev-D-*.png`), but its cloud
lighting is still storm-toned — it needs the art pass, not just a re-enable.

### 3.5 Air is stacked three times, but it is a *minor* lever

- scene fog: `FogExp2(#e3f2f9, 0.0011)` — `src/levels/build.js:557` +
  `src/levels/atmosphere.js:22`
- volumetric scattering: `volSigma 0.002`, `volFarHaze 0.22`, `volAmbient 0.1`
  (`src/levels/atmosphere.js:20`)
- bloom 0.09 + streak + dirt + flare over an already pale sky
  (`src/levels/atmosphere.js:11-17`)
- and three different palettes feeding them (dome horizon, volume ambient, scene
  fog), which is why the far field drifts warm while the sky drifts cream.

The DESIGN doc treats the haze as the main cause of the washed-out look. That is
only partly true: measured on the live build, sweeping the atmosphere from the
engine defaults to the current thinner values moves **top-third contrast only
from 0.0212 to 0.0236 (+11 %)** and leaves luma and saturation essentially
unchanged (0.564 → 0.566, 0.100 → 0.096). The far field is flat mostly because it
contains **featureless boxes with no detail to show**, not because fog ate it.
Air still matters for colour consistency and for the *look* of depth — unify the
three palettes and use `fogDensity ≈ 0.0005–0.0007`, `volSigma ≈ 0.0012`,
`volFarHaze ≈ 0.10`, `volAmbient ≈ 0.05` — but do not expect this lever to close
the contrast gap on its own.

### 3.6 Surfaces have no micro-structure

- One procedural Canvas atlas, **512² per tile** (one 256², one 128²), anisotropy
  8, no mipmap tuning: `src/levels/textures.js:103-107, 112, 140, 165, 212, 252, 280, 301`
- **no normal maps, no roughness maps, no AO maps** anywhere; every material is
  `MeshStandardMaterial` with a constant `roughness` (0.84 roof, 0.72 walls,
  0.38 route paint) and `metalness 0.04`: `src/levels/build.js:32-35, 63-69, 111-114`
- geometry: large flat slabs with 0.1 m fascia and one safety stripe
  (`src/levels/floor.js`), no coping, no joints in geometry, no fixings, no
  weathering gradient at the base, no edge wear

At 2 m from a wall the player sees a 4 m × 2 m flat unlit-looking rectangle with a
faint grout line (see `shots/current-05-wallrun.png`). The reference at the same
distance shows concrete panels with joint shadows, tie holes, dirt runs, chips,
and a normal-mapped surface that catches the sun.

Cheapest high-impact fixes: 1024–2048 tiles; derive height/normal maps from the
same generators (Sobel the grain/panel height) and set `normalMap` +
`normalScale`; add roughness variation via a second canvas; raise anisotropy;
keep a fixed world-space texel density.

### 3.7 The world is a test map, not a city

Measured in [`03-content-audit.md`](visual-gap/03-content-audit.md):

- the whole playable surface is **26 white `BoxGeometry` slabs**, all 0.5 m thick,
  ~7.6 × 6.7 m average, **1 357 m² of deck for a 203 m route**, with only three
  deck levels (3.5 m of vertical range) and 21 of 25 gaps ≤ 3 m;
- **authored content is 12 props in 5 archetypes = 0.59 props per 10 m** (`ac` ×3,
  `antenna` ×2, `planter` ×4, `rail` ×1, `vent` ×2 — `src/levels/tutorial.js:19-106`);
  act III adds three props and no new type; props have **no colliders**;
- the generated rooftop detail families (AC/hut/vent/pipe/solar, 13 families,
  **638 modules, 24.5 per roof**) exist but are **edge-anchored by design**
  (`src/levels/build.js:193` "never on the route line"), so **91 % of the deck is
  structurally empty** and the ±2 m route corridor is 80.9 % empty;
- the red route is **0.51 % of the deck area** and only **26 dashes × 1.5 m = 19 %
  of the route length** is painted (`src/levels/build.js:140-146`) — the "read the
  line" pillar is carried by checkpoint rings more than by the line itself;
- the triangle budget is inverted: **51 % of the level's 63 102 triangles are the
  21 checkpoint rings**, all city geometry is 23.9 %, and every platform, prop and
  obstacle combined is **12.4 % (7 848 tris)**;
- the city is a **flat horizon, not a canyon**: 137 district buildings plus 348
  backdrop boxes at 181–330 m; of the 78 buildings within 60 m of the route the
  **median facade is 34.7 m away and the median roofline only 4.3 m above eye
  height**; no tower over 100 m. Average checkpoint view: 17.8 % sky, 28.1 % near,
  15.5 % midground, 38.6 % > 40 m;
- foreground readability is broken by construction: no normal/roughness/AO maps,
  every object an unbevelled box, the fascia a separate 0.1 m band floated outside
  the slab, side-texture seam scale stretched per face, **one human-scale object in
  the whole route** (a 1.05 m door plane on six huts);
- material budget goes the wrong way too: **147 distinct materials** for 26 roofs
  and a handful of props, because materials are created per object.

The reference's roofs are dense: 30–60 identifiable objects per frame at 3–50 m,
with silhouettes that break the horizon and scale cues (1.0 m rails, 2.1 m doors,
0.8 m AC units) that make the player feel 1.7 m tall. See
`shots/reference-vocabulary.png`.

### 3.8 Presentation: character, HUD, framing

- **Mentor character**: procedural capsules, sphere head, no cast/receive shadow
  (`src/game/glassline/characters.js:46, 54-57`), standing 3 m in front of the
  spawn camera — the first frame of the game is the most "programmer art" thing in
  it. The reference's mentor reads as a human silhouette at 5–15 m.
- **No first-person presence**: the courier arm rig exists
  (`characters.js:66-135`) but `root.visible = false` (`:69`) and is only posed in
  specific moves; the reference shows forearms/hands at the bottom of the screen
  in every frame — a continuous reminder that you are a body.
- **HUD**: two opaque ivory plates, brand block, act/stage, progress bar,
  checkpoints, timer/best/split, prompt, toast, dispatch caption, plus three 6 m
  in-world act-label sprites (HUD source `src/game/glassline/tutorial.js:29-53`,
  styles `src/ui/styles.css`) — **4.93 % of a 1080p frame, 220 characters, five
  keycaps**, all near-white in a scene that is already near-white, which is why
  the plates have to be opaque at all. The reference tutorial is near HUD-free: a
  2 px dot, one bottom prompt bar, a brief top-left card.
- **Framing**: the route is a chain of isolated "tables" floating over a bright
  void with a distant box skyline (`shots/current-01-start.png`). The reference is
  a canyon: vertical faces 3–10 m away on both sides, sky as a narrow band, a
  strong foreground object (parapet, fence, beam) within 0–3 m that parallaxes.
  Ours is the inverse of the reference's depth read: our far field is *brighter
  and flatter* than our near field while the reference
  is the opposite: absolute contrast in the top third of the frame is −68 %
  (0.0188 vs 0.0585, robust), versus −39 % in the bottom third; the
  `contrast_top_over_bottom` ratio points the same way (0.44 vs 0.84) but is the
  one composition metric that does not survive all sampling variants.

### 3.9 The grade controls are wired to the wrong stage

`src/engine/render/index.js:616` tune defaults + `src/levels/atmosphere.js:11-22`:
`bloom 0.09` with `threshold 1.8`, `flare 0.16`, `dirt 0.04`, `vignette 0.3`,
`grain 0.02`, `agxMix 0.12`, `lookPower 1.28`, `lookSat 1.22`.

- **`lookPower` does almost nothing.** DESIGN.md calls it "the main lever against
  the washed-out look", but it is a `#define` consumed only inside the AgX branch
  (`LOOK_POWER` in the grade shader) and the frame is 88 % ACES (`agxMix 0.12`).
  88 % of the image never sees the contrast curve. Contrast has to be applied on
  the ACES side (explicit S-curve weight 0.35–0.45, lift 0.002–0.004), or
  `agxMix` moved to 1.0 with the look applied to the whole mix.
- **AO is effectively disabled by its own fade.** The composite multiplies AO by
  `(1 − 0.8 × lit)` where `lit` is luma × exposure, so at exposure 2 everything
  counts as "lit"; effective strength ≈ **0.19**. Measured: turning AO off changes
  mean luma by **+0.011 (~2 %)**. Props therefore float: no contact darkening
  under AC units, curbs or the character.
- **Bloom is not idle, it is amplifying glare**: with exposure pinned it changes
  84 % of pixels by >2/255 and 46 % by >4/255, with a max delta of 119/255 around
  the sun — i.e. it is spreading the white billboard, not adding sun detail.
- `aoRadius`, `aoIntensity`, `aoStrength` and `bloomMix` are **construction-time
  only** despite the "tune is live" fix — changing them at runtime does nothing.

### 3.10 The image is rendered below the display resolution

`src/game/main.js:23` sets a `high` render budget of 2.3 Mpx, `ultra` 3.7 Mpx.
On a Retina display the canvas is 3840×2160 but the post buffer resolves at
~2022×1137, and the final pass upscales **1.9×** before FXAA. Everything — the
texture grain, the panel joints, the route paint — is smeared by that upscale.
Measured frame cost at that resolution is **8.36 ms on an M1 Pro** against a
16.7 ms budget: there is roughly **2× headroom**. Raising the `high` cap to
3.0–3.4 Mpx (and/or capping the device pixel ratio at 1.5) is a 30-minute change
that improves perceived sharpness before a single new asset is added.

On the same capture path this also means our 1920×1080 evaluation screenshots are
already ~5 % below native — the *real* game on a Retina screen looks softer than
these images.

---

## 4. What the reference actually does

`shots/reference-vocabulary.png` is an annotated frame sheet. The recipe, distilled:

| # | Element | In the reference | In GLASSLINE today |
| --- | --- | --- | --- |
| 1 | Saturated blue sky + white cumulus, 20–40 % of frame | ✓ | flat cream gradient, 0 clouds |
| 2 | Sun at 50–60° elevation, one key light, visible disk | ✓ | 26.5°, dead ahead, 4 lights |
| 3 | White architecture clipping to near-white, blue shadow side | ✓ | everything 0.65–0.85, neutral |
| 4 | Crisp shadows incl. thin line shadows (fence, cable, railing) | ✓ | washed out / absent |
| 5 | Facades: window grids, mullions, panel joints, ledges at 0.5–2 m scale | ✓ | 512² texture stripes, no depth |
| 6 | Roof kit: parapets + copings, stair huts, ducts, AC clusters, vents, dishes, antennas | ✓ | 5 archetypes / 12 authored props + 638 edge-anchored generated modules |
| 7 | Construction & service props: crane, scaffolding, tarps, barriers, pallets, grates | ✓ | none |
| 8 | Signage & billboards as colour accents (orange/blue/yellow) on white | ✓ | 3 small in-world signs |
| 9 | Saturated accent colours used as focal points against white/grey | ✓ | palette capped at sat 0.20 (DESIGN.md) |
| 10 | Runner vision: strong red saturates the traversable path/objects | ✓ | red strip, but 1 % of frame vs 4.2 % |
| 11 | Canyon composition: near verticals, foreground parallax, narrow sky | ✓ | wide horizon of distant boxes |
| 12 | First-person body presence: forearms/hands, camera roll, landing dip | ✓ | rig exists, hidden |
| 13 | Near-HUD-free tutorial presentation; small reticle + bottom prompt | ✓ | 4.9 % of the frame in opaque plates, no reticle |
| 14 | Human character silhouettes at 5–15 m | ✓ | capsule + sphere head at 3 m |

---

## 5. The look-dev experiment: how much is tuning?

`tools/lookdev-probe.mjs` boots the shipped build and changes **only live
values** — no source change — at three route viewpoints. Presets:

- **A** — shipped build (`q=high`).
- **B** — A + `autoExposure = false`, `exposure = 1.0` (fixes §3.1 only).
- **C** — B + single-key light rig (hemisphere 0.85 → 0.22, rim/warm × 0.25,
  env 0.34 → 0.12), thinner air (fog 0.00055, volSigma 0.0006, volFarHaze 0.08,
  volAmbient 0.04), harder grade (lookPower 1.42, lookSat 1.34, agxMix 0,
  bloom 0.05 @ threshold 2.4, vignette 0.42, grain 0.012, flare 0.10).
- **E** — C + the engine cumulus sky re-shown with a blue zenith.

Mean over the three viewpoints (quick probe metric; compare with the
`reference_primary` aggregates in §2, definitions are equivalent for these
particular rows):

| | mean | p5 | p25 | p50 | p95 | deep shadow | near-white | saturation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A shipped | 0.710 | 0.331 | 0.664 | 0.727 | 0.899 | 0.1 % | 4.8 % | 0.099 |
| B exposure fix | 0.546 | 0.203 | 0.474 | 0.542 | 0.787 | 0.9 % | 0.3 % | 0.188 |
| C rig + air + grade | 0.393 | 0.108 | 0.236 | 0.338 | 0.748 | 7.5 % | 0.3 % | 0.248 |
| E + cumulus sky | 0.382 | 0.108 | 0.235 | 0.330 | 0.775 | 7.5 % | 0.4 % | 0.258 |
| **reference** | **0.589** | **0.183** | **0.370** | **0.595** | **0.979** | **3.0 %** | **27.3 %** | **0.359** |

Reading it (note: C/E also thinned the air, but the audit measured air alone at
only +11 % top-third contrast — almost all of the movement here is exposure, the
light rig and the grade):

- **B is the honest ceiling of a one-line fix.** It already closes most of the
  brightness and lifts saturation 2×; it slightly overshoots downward because the
  grade was tuned for the bug.
- **C overshoots into darkness** because it cut the fill too hard for a 26.5° sun
  (roofs cannot reach white). The correct target is *between* B and C: keep the
  exposure fix, keep a blue sky ambient at ~0.25, raise the sun elevation, and
  the p25/near-white rows converge on the reference.
- **`near-white` never recovers in any preset** (4.8 % → 0.3 %) while the
  reference is 27.3 %. That is the one metric the probe proves cannot be tuned
  from the current material/lighting geometry: white architecture needs the
  higher sun (§3.3), a brighter albedo and the sky itself. It is the clearest
  argument for doing Tier 0.2/0.3 and Tier 1 together rather than grading alone.
- Note that preset C's contrast gains came from the rig, not the grade: its
  `lookPower 1.42` is mostly inert for the reason in §3.9 (AgX branch, 12 %
  weight). This is the single most
  useful conclusion of the probe: **tone is a tuning problem, detail is a content
  problem** — C/E barely move `edge_energy` (0.0098 → 0.0111 vs 0.0341 reference)
  or `local_contrast`.

Proof sheet: `shots/proof-lookdev.png`; reference-vs-current pairs:
`shots/proof-reference-vs-current.png`.

---

## 5.1 Tier 0 implemented — measured result (2026-11-15)

Merged into `project/glassline` as `dbd3a6f` (2026-11-15) from
`feat/glassline-visual-tier0`; the feature branch was deleted after integration.
Commits: `fix(engine):` + `feat(levels):` + `test(levels):` + `docs:`.

What landed (values measured in the running build):

| Item | Before | After |
| --- | --- | --- |
| Exposure metering | bloom-thresholded mip, `lum 0.002` → `auto 2.0` (clamped) | scene HDR, `lum 0.153` → `auto 1.676` (no clamp), `key 0.28`, window 0.6–2.0, `LIGHTING.exposure 1.05` |
| Light rig | sun 3.4, hemi 0.85 white, rim 1.0, fill 0.5, env 0.34 | sun **6.2** `#fff4e2`, hemi **0.5** `#bcd9ff`/`#4e6274`, rim **0.35**, fill **0.20**, env **0.14** |
| Sun | elevation 26.5°, azimuth down the route | **56°**, ~50° off the route axis (`[-0.52, 0.93, -0.42]`) |
| Sky | gradient `#1454a6 → #e9f5fb`, exponent 0.55, additive 110 m sun billboard | `#0a3d8f → #a8c9e2`, exponent **0.32**, sun disc in the shader, billboard deleted |
| Grade | `agxMix 0.12`, S-curve 0.22, lift 0.006–0.011, bloom 0.09 @ 1.8, flare 0.16 | `agxMix 0`, S-curve **0.27**, lift 0.002–0.004, bloom **0.05 @ 2.6**, flare **0.08**, vignette 0.22, grain 0.012 |
| AO | faded by `1 − 0.8·lit` at 2× exposure (≈0.19 effective) | `1 − 0.5·lit`, radius 1.2, intensity 2.0, strength 1.0 |
| Shadow box | 96.85 × 69.36 m, 4.73 × 3.39 cm texels | **63.88 × 68.59 m, 3.12 × 3.35 cm** |
| Render budget | high 2.3 Mpx | high **3.2 Mpx** (affects Retina only, not these 1× captures) |

Official before/after numbers (`tools/image-metrics.py`, identical methodology,
`metrics.json` vs `metrics-tier0.json`, 11 captures each):

| Metric | Before | Tier 0 | Reference | Status |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.736 | **0.579** | 0.589 | ✅ band 0.48–0.62 |
| luma std | 0.166 | **0.253** | 0.272 | ✅ band 0.23–0.31 |
| luma p25 | 0.698 | **0.416** | 0.370 | ✅ band 0.30–0.42 |
| luma p95 | 0.904 | 0.930 | 0.979 | ❌ still soft (content: white area) |
| near-white | 6.0 % | **14.7 %** | 27.3 % | ✅ band 12–30 % |
| deep shadow | 0.18 % | **5.5 %** | 3.0 % | ✅ band 1.5–6 % |
| saturation mean | 0.102 | **0.311** | 0.359 | ✅ band 0.22–0.34 |
| saturation p90 | 0.279 | 0.553 | 0.745 | ⚠️ content palette |
| colourfulness | 22.5 | 47.8 | 71.1 | ⚠️ content palette |
| local contrast | 0.0376 | **0.0560** | 0.0713 | ✅ band 0.055–0.075 |
| edge energy | 0.0154 | 0.0215 | 0.0341 | ❌ 2 % under band (content) |
| contrast, top third | 0.0188 | 0.0303 | 0.0585 | ❌ content |
| sky blue area | 1.2 % | 67.8 % | 53.1 % | ⚠️ composition (more sky in our frames) |
| sky saturation | 0.075 | 0.384 | 0.398 | ✅ |
| split-tone dark R−B | −17.1 | −26.6 | −48.6 | ❌ dark pixels are black metal, not blue shadow (content) |
| red accent coverage | 1.05 % | 1.32 % | 4.2 % | ❌ route paint area (content) |

Verdict: **7 of the 13 acceptance metrics are now in band**, and the ones that
are not are the same content items the analysis predicted cannot be fixed by
tuning (white surface area, near-field detail, route paint, composition). The
`q=low` vs `q=high` exposure inversion is gone; no `__errors`/`__fatal`;
`npm run check`, `npm test` (109) and the full Playwright suite (28) pass; build
is 889 kB.

Remaining Tier-0-era caveat: the high sun throws the sun disc off-screen most of
the time, so the frame has glare but rarely the sun itself — a Tier-1 sky/sun
composition item.

---

## 5.2 Tier 1 implemented — measured result (2026-11-15)

Merged into `project/glassline` as `c8047db` (2026-11-15) from
`feat/glassline-visual-tier1`; the feature branch was deleted after integration.
Four deliverables from the plan, all shipped:

| Item | What landed |
| --- | --- |
| Day sky with cumulus | `src/levels/sky.js` is now a real sky shader: blue gradient (`#0a3d8f` → `#a8c9e2`, exponent 0.32), six-octave fbm cumulus deck with sunlit tops, blue-grey bases, silver lining and a clear gap around the sun, a sun disc, and slow drift. Deterministic 256² noise texture, no external assets. The PMREM environment is re-captured from the same sky, so glass reflects the clouds. Clouds fade out above ~65° (planar projection singularity) and below ~7° (horizon compression). |
| First-person hands | `src/game/glassline/viewmodel.js`: two procedural arms (sleeve, forearm, cuff, red wrist tracker, hand + thumb) on the engine's **layer-1 view-model pass** (narrow-FOV camera, compressed depth range). Idle/run/sprint swing, slide lean-back, wallrun reach, airborne lift. The old world-space courier rig keeps animating but is no longer drawn, so there is only one pair of hands. |
| Mentor out of the spawn camera | Moved from 2.9 m to ~7 m ahead (first gap roof), adult scale, jacket hem/neck/shoulder caps and a hair cap instead of a ball, and it now **casts a shadow** (the only character that does). |
| Minimal HUD | In-run HUD is a 6 px dot reticle + one contextual prompt (0.62 % of a 1080p frame, measured with `tools/measure-hud-area.mjs`; was 4.93 %). Act/stage/timer/best/split/progress stay in the DOM but are hidden while running, and the pause menu now renders TIME / BEST / CHECKPOINT so nothing is lost. |

Official before/after numbers (`metrics-tier0.json` → `metrics-tier1.json`, same
11 captures, same harness):

| Metric | Tier 0 | Tier 1 | Reference | Status |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.579 | **0.574** | 0.589 | ✅ |
| luma std | 0.253 | **0.259** | 0.272 | ✅ |
| luma p25 | 0.416 | **0.372** | 0.370 | ✅ newly in band |
| luma p95 | 0.930 | 0.922 | 0.979 | ❌ (content: white area) |
| near-white | 14.7 % | **12.7 %** | 27.3 % | ✅ (just inside) |
| deep shadow | 5.5 % | **5.6 %** | 3.0 % | ✅ |
| saturation mean | 0.311 | **0.296** | 0.359 | ✅ |
| local contrast | 0.0560 | **0.0565** | 0.0713 | ✅ |
| edge energy | 0.0215 | 0.0213 | 0.0341 | ❌ (3 % under band; content) |
| contrast, top third | 0.0303 | **0.0409** | 0.0585 | ❌ improved 35 %, still short |
| sky blue area | 67.8 % | **44.1 %** | 53.1 % | ✅ newly in band |
| sky saturation | 0.384 | **0.297** | 0.398 | ✅ (target > 0.25) |
| sky luma std (clouds) | 0.148 | **0.190** | 0.217 | ✅ (target > 0.15) |
| split-tone dark R−B | −26.6 | −25.6 | −48.6 | ❌ dark metal, not blue shadow |
| red accent coverage | 1.32 % | **1.62 %** | 4.2 % | ✅ newly in band |

Verdict: **9 of 13 acceptance metrics in band** (up from 7). Tier 1's own
acceptance criteria are met with margin: `sky_blue_frac` 44 % (> 35 %),
`sky_sat_mean` 0.297 (> 0.25), `sky_luma_std` 0.190 (> 0.15), persistent HUD
0.62 % (< 2 %). Every remaining miss is a Tier 2–3 content item: white surface
area and near-field detail (p95, edge energy, top-third contrast), material
palette (dark split-tone), and route paint area (red coverage improved but the
reference has 2.6× more).

Gates: `npm run check`, `npm test` (118), `npx playwright test` (29, including a
new view-model layer test and minimal-HUD/pause-stats assertions), build 898 kB,
no `__errors`/`__fatal`.

---

## 5.3 Tier 2 implemented — measured result (2026-11-15)

Merged into `project/glassline` as `f25bfd4` (2026-11-15) from
`feat/glassline-visual-tier2`; the feature branch was deleted after integration.
The plan's Tier 2 is a surface pass; all of its deliverables shipped:

| Item | What landed |
| --- | --- |
| Normal + roughness maps | `src/levels/textures.js` derives tangent-space normal maps (Sobel over the albedo as height, tileable) and roughness maps for the material families, sharing one normal per family so memory stays bounded. Applied to platform tops, slab sides, curbs, coping, huts, legs, obstacles, AC/vents/pipes/rails/doors, the route paint, the city curtain walls (glass + roughness), backdrop facades, and the white/accent district bodies. |
| Bigger atlas | 512 → 1024 albedo for concrete, side, facade and glass; metal 256 → 512, route paint 128 → 256. Normals are generated at 512 (roughness 256) because they do not need albedo resolution. |
| Surface-format geometry | A coping cap (0.22 m overhang, 0.05 m deep) sits on every roof curb — the slab edge now has a profile instead of a single flat band. Platform-wide coping is one instanced mesh. |
| Continuous route | The red route strip spans the full roof depth instead of 26 short dashes: route paint went from 19 % of the route length to ~85 %, and the screen-space red coverage from 1.62 % to 2.09 %. |
| Catenary cables | Sparse cables span the gaps between roofs on the same level, outside the route corridor and above head height, as thin instanced segments (one draw call). |
| Palette | Shaded slab sides, fascia, service props and the view-model sleeves lightened and cooled: the deep-shadow share is back inside the reference band and dark pixels are bluer (split-tone −25.6 → −28.7 against −48.6 in the reference). |

Official before/after (`metrics-tier1.json` → `metrics-tier2.json`, same 11
captures, same harness):

| Metric | Tier 1 | Tier 2 | Reference | Status |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.574 | **0.576** | 0.589 | ✅ |
| luma std | 0.259 | **0.260** | 0.272 | ✅ |
| luma p25 | 0.372 | **0.372** | 0.370 | ✅ |
| luma p95 | 0.922 | 0.926 | 0.979 | ❌ (content: white area) |
| near-white | 12.7 % | **14.0 %** | 27.3 % | ✅ |
| deep shadow | 5.6 % | **6.0 %** | 3.0 % | ✅ (band edge) |
| saturation mean | 0.296 | **0.308** | 0.359 | ✅ |
| local contrast | 0.0565 | **0.0572** | 0.0713 | ✅ |
| edge energy | 0.0213 | **0.0220** | 0.0341 | ✅ newly in band |
| sky blue area | 44.1 % | **46.9 %** | 53.1 % | ✅ |
| contrast, top third | 0.0409 | 0.0421 | 0.0585 | ❌ (improved 3 %; far-field content) |
| split-tone dark R−B | −25.6 | **−28.7** | −48.6 | ❌ (improved 12 %) |
| red accent coverage | 1.62 % | **2.09 %** | 4.2 % | ✅ |

Verdict: **10 of 13 acceptance metrics in band** (up from 9). Tier 2's own
acceptance is met: `edge_energy` 0.0220 (≥ 0.022), `local_contrast` 0.0572
(≥ 0.050), `contrast_top_third` 0.0421 (≥ 0.035). The three remaining misses are
Tier 3 content: white surface area in frame (p95), far-field architectural detail
(top-third contrast), and a genuinely darker/bluer material palette (split-tone).

Cost: 67 k → 77.5 k triangles at the start viewpoint, 390 → 413 draw calls,
52 → 61 textures, +9 kB build (909 kB). All within the documented 60 fps budget.

Gates: `npm run check`, `npm test` (118), `npx playwright test` (29), build, no
`__errors`/`__fatal`.

---

## 5.4 Tier 3 implemented — measured result (2026-11-15)

Merged into `project/glassline` as `d86f5f7` (2026-11-15) from
`feat/glassline-visual-tier3`; the feature branch was deleted after integration.
Tier 3 is the composition and density pass; three deliverables shipped:

| Item | What landed |
| --- | --- |
| Canyon composition | Route corridor 15 → **9 m** and a deterministic row of near facades whose inner face sits just outside it (heights 26–58 m), plus taller inner blocks (16–50 m instead of 8–26 m). The reference's strongest compositional read — close verticals, narrow sky band, route as a slot — is now the default sightline. |
| Facade lattice | Window bands go from one every 5 m to one every **2.8 m** filling the visible facade, vertical mullions every ~1.55 m on the near walls, and the instanced body textures now tile at building scale (concrete ×2.6/4.2, glass ×2/3) instead of stretching six windows across a whole tower. |
| Rooftop service kit v2 | A second condenser bank and vent stack on most roofs, dish antennas, duct runs, and billboards on posts with an ivory panel and the red rule — all instanced, high/ultra only. |
| Shade lift | Sky fill raised again (hemisphere 0.5 → 0.74) and cumulus tops brightened, because the canyon put far more shaded facade in frame. |

Official before/after (`metrics-tier2.json` → `metrics-tier3.json`, same 11
captures, same harness):

| Metric | Tier 2 | Tier 3 | Reference | Status |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.576 | **0.567** | 0.589 | ✅ |
| luma std | 0.260 | **0.260** | 0.272 | ✅ |
| luma p25 | 0.372 | **0.396** | 0.370 | ✅ |
| luma p95 | 0.926 | 0.936 | 0.979 | ❌ (white area in frame) |
| near-white | 14.0 % | **14.6 %** | 27.3 % | ✅ |
| deep shadow | 6.0 % | **5.8 %** | 3.0 % | ✅ |
| saturation mean | 0.308 | **0.310** | 0.359 | ✅ |
| local contrast | 0.0572 | **0.0663** | 0.0713 | ✅ |
| edge energy | 0.0220 | **0.0280** | 0.0341 | ✅ (Tier 3 target met) |
| sky blue area | 46.9 % | 44.1 % | 53.1 % | ✅ |
| contrast, top third | 0.0421 | **0.0554** | 0.0585 | ✅ (Tier 3 target met) |
| split-tone dark R−B | −28.7 | −30.3 | −48.6 | ❌ (palette) |
| red accent coverage | 2.09 % | **2.23 %** | 4.2 % | ✅ |

Verdict: **11 of 13 acceptance metrics in band** (up from 10). Tier 3's own
acceptance is met: `edge_energy` **0.0280** (≥ 0.028) and `contrast_top_third`
**0.0554** (≥ 0.045, within 5 % of the reference). The two remaining misses are
the two the analysis always attributed to content that this pass could not
manufacture from the existing level: the *amount* of near-white surface in frame
(p95 0.936 vs 0.95 — the reference roofs and sky clip far more often) and a
genuinely darker, bluer material palette (split-tone −30.3 vs −35).

Tried and rejected: raising the exposure ceiling (`key 0.28 → 0.38`, max 2.0 →
2.4) moved p95 into band (0.953) and near-white to 20.8 %, but lifted p25 out
(0.463) and pushed sky-blue out (0.336) — a net loss of one metric for one, and a
visibly over-bright frame. Reverted.

Cost: 413 → 421 draw calls, 67 k → 75.9 k triangles, 61 → 63 textures, 903 →
906 kB build at high quality. The dense facade lattice and the service kit are
gated to high/ultra: the low-quality frame stays inside its triangle budget.

Gates: `npm run check`, `npm test` (118), `npx playwright test` (29), build, no
`__errors`/`__fatal`.

---

## 5.5 Tier 4 implemented — measured result (2026-11-15)

Merged into `project/glassline` as `ae453b7` (2026-11-15) from
`feat/glassline-visual-tier4`; the feature branch was deleted after integration.
Tier 4 is the motion and finish pass:

| Item | What landed |
| --- | --- |
| Head bob | Speed-scaled bob in `player.js`: ~1.2 cm vertical, ~0.7 cm lateral and 0.2° of roll at full sprint, damped in/out, grounded only, with a pure `bobOffset()` helper and unit tests. Deliberately tiny — a large bob makes first-person parkour unreadable. |
| View-model legs | Thigh/shin/shoe per leg on the layer-1 view-model pass (`viewmodel.js`). Standing they hang below the frame (looking down shows your feet), a slide swings them forward into view, a roll tucks them, and they stride while running. The body is present in every pose now, not just the arms. |
| Final grade | Cooler, stronger split tone (`sh` 0.80/1.01/1.13 → 0.74/1.00/1.20), slightly cooler highlights, bluer lifted blacks and a top-of-range highlight lift so sunlit whites and cumulus clip like the reference. Live saturation moved from the inert `lookSat` (AgX branch) to `render.post.saturation` = 0.96. |
| Golden harness | `npm run golden` captures the ten route viewpoints into `artifacts/golden/` with a metrics manifest (`pngjs`), and `tests/e2e/glassline-golden.spec.js` asserts the look stays inside calibrated bands (mean luma, p95 roll-off, saturation) instead of brittle pixel diffs — film grain and cloud drift are time-dependent by design. |

Official before/after (`metrics-tier3.json` → `metrics-tier4.json`, same 11
captures, same harness):

| Metric | Tier 3 | Tier 4 | Reference | Status |
| --- | ---: | ---: | ---: | --- |
| luma mean | 0.567 | **0.570** | 0.589 | ✅ |
| luma std | 0.260 | **0.263** | 0.272 | ✅ |
| luma p25 | 0.396 | **0.395** | 0.370 | ✅ |
| luma p95 | 0.936 | **0.953** | 0.979 | ✅ newly in band |
| near-white | 14.6 % | **15.3 %** | 27.3 % | ✅ |
| deep shadow | 5.8 % | **5.7 %** | 3.0 % | ✅ |
| saturation mean | 0.310 | **0.331** | 0.359 | ✅ |
| local contrast | 0.0663 | **0.0668** | 0.0713 | ✅ |
| edge energy | 0.0280 | **0.0283** | 0.0341 | ✅ |
| sky blue area | 44.1 % | **51.1 %** | 53.1 % | ✅ |
| contrast, top third | 0.0554 | **0.0556** | 0.0585 | ✅ |
| split-tone dark R−B | −30.3 | **−40.2** | −48.6 | ✅ newly in band |
| red accent coverage | 2.23 % | **2.17 %** | 4.2 % | ✅ |

Verdict: **13 of 13 acceptance metrics in band** — the measured visual gap that
opened this analysis is closed on the metric set that defined it (from 0/13 at the
baseline). Two notes on what that does and does not mean:

- the saturation lift from the bluer shadows briefly pushed `sat_mean` over the
  band (0.342); the live grade saturation is now 0.96 instead of the inert
  `lookSat`, which is where that value has to live while `agxMix` is 0.
- `near-white` (15.3 % vs 27.3 %) and `p95` are now inside the bands but still on
  the low side: the reference has more white architecture in frame, which is a
  level-content property (Tier 5 territory), not a grade one.

Cost: 427 draw calls, 76.9 k triangles, 63 textures at high quality; build 907 kB.
Gates: `npm run check`, `npm test` (123, including head-bob and view-model-leg
tests), `npx playwright test` (30, including the golden band test), build, no
`__errors`/`__fatal`.

---

## 6. Roadmap

Effort is for one experienced developer; "acceptance" is a metric from §7 that the
tier should move. Do the tiers in order — later tiers are wasted on a broken tone.

### Tier 0 — "Stop bleaching the frame" (1 day, no new content)

Order matters: 0.1 → 0.2 first (everything else is measured through them), then
0.3, then the rest. Values are the render audit's measured proposals
([`01-renderer-audit.md`](visual-gap/01-renderer-audit.md) §8a).

| # | Change | Where | Proposed value | Expected |
| --- | --- | --- | --- | --- |
| 0.1 | **Fix exposure metering** — meter the unthresholded scene (or manual exposure) | `src/engine/render/index.js:616` (post pass `P()`), `:434-459`; retune in `src/levels/atmosphere.js` | `autoExposure=false, exposure 0.95-1.05`, or fix source + `key 0.25/min 0.5/max 1.3` | measured 2→1: mean linear 0.564→0.362, sat 0.100→0.163, blue-sky ×2.7; kills the 3.3× tier swing |
| 0.2 | **One-key light rig** | `src/levels/lighting.js:8-20` | sun **5.0**; hemisphere **0.25** (`#cfe4ff` / `#4a5a66`); rim **0.35**; warm **0.20**; env **0.12** | measured: contrast 0.720→0.793, std 0.213→0.253, mean L 0.564→0.501 — largest isolated gain |
| 0.3 | **Sun to 55–60°** elevation, 40–60° off route axis; move sprite/flare with it | `src/levels/sun.js:6`, `src/levels/build.js:576-591` | e.g. `[-0.52, 0.93, -0.42]` | roofs get `sin 55° = 0.82` instead of `0.45` of the sun → white roofs can clip; raking side-light |
| 0.4 | **Sky palette** (flat dome, before the cumulus work) | `src/levels/sky.js:21-23, 45-47, 51-53` | `uTop #0a3d8f`, `uHorizon #a8c9e2`, `uBottom #c2d6e6`, exponent **0.32**, glare terms 0.24→0.08 / 0.9→0.5 | computed: 20° (82,126,184), 37° (53,99,176) vs reference (99–120 R/G, 185–229 B) |
| 0.5 | **Kill the billboard sun** | `src/levels/build.js:578-591` | delete; sun disk + glare in the sky shader at the true direction | sprite+flare cover **12.7 %** of frame at up to 81° off-sun today |
| 0.6 | **Grade on the ACES side** | `src/levels/atmosphere.js:11-17` | `agxMix 0` (or 1.0 + whole-mix look); S-curve 0.35–0.45; lift 0.002/0.003/0.004; `lookSat 1.35`; `vignette 0.20–0.25`; `grain 0.012` | recovers the white end (p95/p1 target 0.979/0.112) |
| 0.7 | **Bloom/streak thresholds** | `src/levels/atmosphere.js:11-12` | bloom **0.05 @ 2.6**, streak **0.015 @ 2.0**, dirt **0.02**, flare **0.08** | keeps glare on the sun/speculars only |
| 0.8 | **AO live again** | `src/engine/render/index.js:341-371` (fade), defaults at `:616` (not live) | fade `(1 − 0.5 · lit)` at a fixed reference exposure; `aoRadius 1.2`, `aoIntensity 2.0`, `aoStrength 1.0` | AO currently changes mean luma ~2 %; target: visible contact under props |
| 0.9 | **Shadow box tightening** | fit corners in `src/engine/render/index.js:616` (`Gy(...)` call) | ±28 m plan / −2…28 m height → **73.45 × 60.75 m** (3.59 cm texels) or 3072² (2.39 cm) | shadows carry 2 % of the frame today; crisp contact needed for 0.2 to read |
| 0.10 | **Resolution cap** | `src/game/main.js:23` | `high` 2.3 → **3.0–3.4 Mpx**; cap DPR at 1.5 | removes the 1.9× Retina upscale (measured 8.36 ms vs 16.7 ms budget) |
| 0.11 | **Unify the three fog/air palettes** | `src/levels/build.js:557`, `src/levels/atmosphere.js:20-22` | fog `#cfe3ef`, `fogDensity 0.0005–0.0007`, `volSigma 0.0012`, `volFarHaze 0.10`, `volAmbient 0.05` | air is a *minor* lever (+11 % top-third contrast measured) — this is about colour consistency |

### Tier 1 — "Sky and body" (2–3 days)

- **Day sky v2**: saturated blue zenith → pale horizon with 2–3 fbm cumulus layers
  (flat-based, silver-rimmed), sun disk + aureole feeding the existing flare, no
  separate additive sprite. Generate the PMREM/reflection environment from the new
  sky. Acceptance: `sky_blue_frac` > 35 %, `sky_sat_mean` > 0.25,
  `sky_luma_std` > 0.15.
- **First-person arms**: the engine already has an empty view-model pass — a
  layer-1 camera at `viewFov 60` with the `depthRange(0, 0.05)` trick
  (`src/engine/render/index.js:616`, `renderWorld`). Put the existing courier
  forearm/hand poses on that layer (world-space rig is
  `characters.js:66-135`), with a small sway and per-move poses; ~2 draw calls.
  This is the single strongest "you are a body" read after the sky.
- **Move the mentor out of the spawn camera** (or give it a body silhouette:
  shoulders, jacket, head shape, hair, backpack). Never show a capsule+sphere at
  3 m.
- **HUD to near-nothing during play**: dot reticle + contextual prompt; timer/best
  and the act labels move to pause/complete. Acceptance: persistent HUD covers
  < 2 % of the frame (measure the DOM boxes, as the content audit did at 4.93 %).

### Tier 2 — "Surfaces" (~1 week)

- 1024–2048 atlas tiles; height→normal maps generated from the same canvases
  (`normalMap`, `normalScale ≈ 0.6-1.0`); roughness maps; anisotropy 16; fixed
  world-space texel density (64–128 px/m on route surfaces; the render audit
  proposes 128–256 px/m on hero surfaces within 3 m of the camera).
- Geometry-level surface design: parapet + coping profile on every platform,
  fascia thickness, expansion joints, drains, membrane patches, roof hatches,
  curb caps, base dirt gradient, edge chipping.
- Facade module v2: window insets/bays or normal-mapped mullions with a real
  reflectivity ramp (the PMREM env is already there), balconies, vertical fins.
- Acceptance: `edge_energy` ≥ 0.022, `local_contrast` ≥ 0.050,
  `contrast_top_third` ≥ 0.035.

### Tier 3 — "A city, not a test map" (1–2 weeks)

The content audit prices the highest-impact subset at **≈82 hours**:
continuous route ribbon + edge paint (4 h), parapet/coping/slab-edge profile on
the ~744 m of perimeter (10 h), cables/wires/spans (6 h), a service-cluster
generator (fan/condenser banks, ducts, ~230 modules, 14 h), signage and
billboards (10 h), a 0–5 m readability kit (fixings, joints, chamfers, contact
and grime decals, 12 h), stair hut/access tower ×10–12 (10 h), and near-facade
detail plus raising 12–16 near buildings to 40–90 m (18 h) — ≈ +35–45 k triangles
and ≈ +12 draw calls.

- Prop kit v2: 15–20 archetypes and density **×6–10** (12 → 80–120 authored
  props on 203 m), with colliders and contact shadows.
- Canyon composition: route corridor 15 → 6–9 m, near facades with window grids
  and ledges on both sides, adjacent roofs at ±3–8 m, overhead skybridges/signs/
  cables, a visible street 20–40 m below the parapet.
- Material consolidation (147 → ≤40) and per-roof merge/instancing, so the new
  content does not multiply draw calls.
- Acceptance: `contrast_top_third` ≥ 0.045, `edge_energy` ≥ 0.028.

### Tier 4 — "Motion and finish" (2 weeks+)

- Camera: head bob curve, landing dip (exists), wallrun roll (exists), sprint FOV
  (exists), landing shake; motion-blur strength per speed tier.
- Character: mentor humanoid + run cycle; slide/roll visible legs/shoes.
- Final grade pass against the reference frame set, golden screenshots in CI
  (`artifacts/` + `tools/capture-visual.mjs`), optional time-of-day variants.

---

## 7. Acceptance targets ("close enough" definition)

Re-run `tools/image-metrics.py` against a fresh capture pass after each tier. The
build is "visually in the reference's family" when the primary set lands in:

| Metric | Target band | Baseline | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| luma mean | 0.48 – 0.62 | 0.736 | **0.579 ✅** | **0.574 ✅** | **0.576 ✅** | **0.567 ✅** | **0.570 ✅** |
| luma std | 0.23 – 0.31 | 0.166 | **0.253 ✅** | **0.259 ✅** | **0.260 ✅** | **0.260 ✅** | **0.263 ✅** |
| luma p25 | 0.30 – 0.42 | 0.698 | **0.416 ✅** | **0.372 ✅** | **0.372 ✅** | **0.396 ✅** | **0.395 ✅** |
| luma p95 | 0.95 – 1.00 | 0.904 | 0.930 ❌ | 0.922 ❌ | 0.926 ❌ | 0.936 ❌ | **0.953 ✅** |
| near-white | 12 % – 30 % | 6.0 % | **14.7 % ✅** | **12.7 % ✅** | **14.0 % ✅** | **14.6 % ✅** | **15.3 % ✅** |
| deep shadow | 1.5 % – 6 % | 0.18 % | **5.5 % ✅** | **5.6 % ✅** | **6.0 % ✅** | **5.8 % ✅** | **5.7 % ✅** |
| saturation mean | 0.22 – 0.34 | 0.102 | **0.311 ✅** | **0.296 ✅** | **0.308 ✅** | **0.310 ✅** | **0.331 ✅** |
| local contrast | 0.055 – 0.075 | 0.0376 | **0.0560 ✅** | **0.0565 ✅** | **0.0572 ✅** | **0.0663 ✅** | **0.0668 ✅** |
| edge energy | 0.022 – 0.035 | 0.0154 | 0.0215 ❌ | 0.0213 ❌ | **0.0220 ✅** | **0.0280 ✅** | **0.0283 ✅** |
| sky blue fraction | 35 % – 60 % | 1.2 % | 67.8 % ⚠️ | **44.1 % ✅** | **46.9 % ✅** | **44.1 % ✅** | **51.1 % ✅** |
| contrast, top third (far field) | 0.045 – 0.065 | 0.0188 | 0.0303 ❌ | 0.0409 ❌ | 0.0421 ❌ | **0.0554 ✅** | **0.0556 ✅** |
| split-tone dark R−B | −60 – −35 | −17.1 | −26.6 ❌ | −25.6 ❌ | −28.7 ❌ | −30.3 ❌ | **−40.2 ✅** |
| red accent coverage | 1.5 % – 4 % | 1.05 % | 1.32 % ❌ | **1.62 % ✅** | **2.09 % ✅** | **2.23 % ✅** | **2.17 % ✅** |

These are bands around the reference aggregate, not pixel-matching; they are
deliberately defined on the same metric set so a regression cannot hide behind
"it looks better to me".

---

## 8. Guardrails

- **Do not** chase the look with more post FX: bloom, dirt, flare and grain are
  already the reason for the milky frame. Every Tier-0 item is a *subtractive*
  change.
- **Do not** raise global saturation to fix the palette. The palette is muted at
  the source (`DESIGN.md`: accents capped at sat 0.20). Fix the source (sky,
  accents, materials), not the grade.
- **Perf budget** at `q=high` today: 437 draw calls / 67 k triangles / 52 textures
  / 36 programs (measured at the start viewpoint), **8.36 ms per frame on an
  M1 Pro** (~2× headroom versus 16.7 ms). That headroom is the budget for Tier
  0.10 (resolution) and Tier 2–3 (content): plan instancing, merging and shared
  materials together with the art — today 147 materials are created per object and
  51 % of the triangles are checkpoint rings, so the expensive thing to add is
  draw calls, not polygons.
- **IP**: original geometry, procedural textures, original signage and fiction.
  The reference is used for observation and measurement only (see
  `docs/GLASSLINE_AUDIT.md` / `NOTICE.md`).
- **Design pillars stay**: "the runner is the only red element", "read the line",
  "flow before decoration". Dense props must sit off the sprint line.

---

## 9. Where the detail lives

- **Render audit** — [`docs/visual-gap/01-renderer-audit.md`](visual-gap/01-renderer-audit.md):
  the 16-stage pass inventory with resolutions, all 27 `render.tune` keys and
  whether they are live, the shadow setup (96.85 × 69.36 m, 4.7 cm texels, 52
  casters, city unshadowed), the 41 canvas textures, and a costed lever table
  (§8a same-day, §8b 1–3 days, §8c structural) with proposed values.
- **Metrics** — [`docs/visual-gap/02-metrics.md`](visual-gap/02-metrics.md):
  method, YouTube/H.264 and burned-in-UI caveats, per-metric interpretation,
  ranked gaps, and the 5-variant robustness pass.
- **Content audit** — [`docs/visual-gap/03-content-audit.md`](visual-gap/03-content-audit.md):
  every platform, prop, city block and HUD element counted; deck emptiness,
  composition raycasts at all 21 checkpoints, the inverted triangle budget,
  material/instancing findings, and a costed addition list (≈82 h for the top 8).
- Tooling: `tools/capture-visual.mjs` (deterministic viewpoint captures),
  `tools/lookdev-probe.mjs` (live tuning presets), `tools/image-metrics.py`
  (metrics + comparison sheets), `tools/measure-hud-area.mjs` (persistent HUD
  screen share), `tools/golden.mjs` (`npm run golden`: golden frames + metrics
  manifest in `artifacts/golden/`).

## Appendix — shot index (`docs/visual-gap/shots/`)

| File | Shows |
| --- | --- |
| `reference-vocabulary.png` | Six annotated reference frames: the visual vocabulary to match |
| `proof-reference-vs-current.png` | Reference \| current pairs at three beats |
| `proof-lookdev.png` | The tuning ladder A → B → C → E on one viewpoint |
| `current-01..11-*.png` | Fresh 1920×1080 captures at ten route checkpoints (HUD hidden) |
| `hud-01-start.png` | Same viewpoint with the shipped HUD |
| `lookdev-{A,B,C,D,E}-{start,wallrun,act2}.png` | The probe presets |
| `tier0-01..11-*.png` | The same 11 viewpoints after Tier 0 (compare with `current-*.png`) |
| `tier1-01..11-*.png` | The same 11 viewpoints after Tier 1 |
| `tier2-01..11-*.png` | The same 11 viewpoints after Tier 2 |
| `tier3-01..11-*.png` | The same 11 viewpoints after Tier 3 |
| `proof-tier1.png` | Tier 0 vs Tier 1 on three beats |
| `proof-tier2.png` | Tier 1 vs Tier 2 on three beats |
| `proof-tier3.png` | Tier 2 vs Tier 3 on three beats |
| `tier4-01..11-*.png` | The same 11 viewpoints after Tier 4 |
| `proof-tier4.png` | Tier 3 vs Tier 4 on three beats |
| `lowq-*.png` | `q=low` (bloom off → correct metering) evidence for §3.1 |
| `compare-01..03.png` | Metrics-generated reference-vs-current sheets |
