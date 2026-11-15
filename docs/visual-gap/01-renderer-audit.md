# 01 — Renderer audit: GLASSLINE vs the Mirror's Edge 2008 tutorial reference

Status: **render/light/material audit complete, 2026-11-15**.
Scope: everything between the level data and the pixels — `src/engine/render/index.js`,
the GLASSLINE sky/air/light/texture modules, the quality tiers and the camera.
No `src/` change was made for this document.

Companion files: [`docs/VISUAL_GAP.md`](../VISUAL_GAP.md) (owner-facing summary and
roadmap), `docs/visual-gap/02-metrics.md`, `docs/visual-gap/03-content-audit.md`,
`docs/visual-gap/metrics.json`, `docs/visual-gap/shots/`.

**A note on citations:** `src/engine/render/index.js` is shipped minified — the
shader sources live on lines 63–614 but the whole post/render runtime (tune
object, pass construction, `run()`, `resize()`) is one very long line **616**.
Citations such as `render/index.js:616 (P())` therefore point at that block and
name the symbol/function inside it.

**Confidence tags used below**

- **[M]** measured from the running build or from screenshots/JSON in this repo;
- **[A]** analysed from source code / arithmetic (the model is stated);
- **[E]** estimate from reasoning or from the 2008 footage (state the caveat).

Image-space numbers are quoted from `docs/visual-gap/metrics.json` where noted
(luma = Rec.709 luma of **sRGB-encoded** values, per that file's definitions), or
from this audit's own A/B harness (§10) which is only used for **deltas**, never
for absolute comparison.

---

## 0. TL;DR — the renderer-side answer to "why doesn't it look 2008?"

1. **The engine is not starved; it is mis-pointed.** HDR half-float pipeline,
   4×MSAA, fitted custom soft shadows, half-res GTAO, shadowed volumetrics,
   6-mip bloom + streak, motion blur, ACES/AgX + grade, FXAA. Frame cost measured
   in `docs/PERFORMANCE.md`: **8.36 ms avg on an M1 Pro at 2.3 Mpx** (~119 fps
   when the 60 fps budget is 16.7 ms) — i.e. roughly **2× headroom** to spend on
   look. `[M]`
2. **One pipeline bug dominates the wash.** On `q=medium|high|ultra` the
   auto-exposure pass meters luminance from the **thresholded bloom chain**,
   reads `lum = 0.002` (the clamp floor) and pegs `auto = 2.0`
   (`render/index.js:616`, adapt pass). Live probe: `adapt = {lum:0.002, auto:2}`.
   With bloom off (`q=low`) the same scene meters `0.232` → `auto = 0.6`
   (measured). So the frame is multiplied by **2.0** where it was graded for
   ~1.0, and low quality renders 3.3× darker than high quality. `[M]`
3. **The visible sky is a cream gradient, not a blue sky.** The active dome is
   `uTop #1454a6` mixed toward `uHorizon #e9f5fb` (95 % white) with
   `pow(h, 0.55)` (`src/levels/sky.js:21-47`). Computed display values at current
   exposure 2: **20° elevation ≈ sRGB (223,222,220), 30° ≈ (214,215,218)** —
   i.e. neutral white where the reference sky is a saturated blue
   (measured reference top rows (65,99,213)/(56,106,185)/(69,120,228)). `[M/A]`
4. **A 110 m additive billboard sits where the sun should be.**
   `build.js:578-591` places a 110 m sun sprite at world (34, 58, −190). From the
   spawn camera it is **209.6 m away → 29.4° angular diameter, 14.2° away from the
   true sun direction**; at the act-2 checkpoint **43.4°**; at the finish
   checkpoint **65 m → 80.6° diameter and 60.3° off the sun direction** — a white
   veil that grows as you progress. Hiding sprite+flare changes **12.7 % of the
   frame** (mean +6.8/+4.8/+3.0 RGB). `[M]`
5. **Shadows exist but carry 2 % of the frame.** Disabling the shadow map
   (`shadow.intensity = 0`) changes only **3.9 % of pixels by >3/255**, **max
   27/255**, at the start view. The reason is the fill rig: sun 3.4 +
   hemisphere 0.85 (white) + two unshadowed directionals 1.0/0.5 + env 0.34 ≈
   **≈1.4–1.8:1 sun:ambient** for a roof `[A]`; and the single 96.85 × 69.36 m
   cascade gives 4.7 cm texels. `[M/A]`
6. **AO is effectively off** (the composite fades it by `1 − 0.8·lit`, and with
   exposure 2.0 almost everything is "lit"): disabling AO changes mean frame
   luminance by only **+0.011 linear (~2 % relative)**. `[M]`
7. **Everything is diffuse and matte.** 103 of 141 unique materials are
   `MeshStandardMaterial`, **0 normal maps, 0 roughness maps, 0 bump maps**,
   67 have only a colour map; roughness is a constant 0.72–0.95 on almost all
   architecture; 36 `MeshBasicMaterial` objects (window bands, abyss, distant
   skyline, signs) ignore light entirely. Measured edge energy is **0.0154 vs
   0.0341** in the reference (−55 %) — that half of the gap is content, not tone. `[M]`
8. **Retina softness.** The HDR buffer is capped at 2.3 Mpx at `q=high`; at
   DPR 2 the post target is **2022×1137 while the canvas is 3840×2160** — the
   final FXAA pass upscales ~1.9×. `[M]`
9. **Two suns, two skylines, three fog colours.** The engine's cloud sky (with
   fbm cumulus, sun disk and aureole) is hidden (`build.js:559-561`) but still
   feeds the volumetric shader's horizon colours; the active dome is a different
   palette; scene fog is a third colour. Volumetric haze is also applied to sky
   pixels. `[A]`
10. **Realistic ceiling.** Tone + value structure (items 1–5) is a ~1–3 day
    tuning job and moves `mean` from 0.736→~0.55-0.60, saturation ×1.8, deep
    shadow 0.2 %→~1 % `[M, look-dev probe in VISUAL_GAP §5]`. The remaining
    half — detail, normal maps, prop density, sky clouds, a city canyon — is
    2–3 weeks of content authoring. Photorealism is not needed and is not the
    reference's own bar.

---

## 1. Frame structure — what one rendered frame actually is

Per frame, `render.frame()` (`src/engine/render/index.js:616`, function `frame`)
does:

1. `shadowMap.needsUpdate` is set on **even frames only** (or every frame on
   `ultra`/`shot`); the shadow pass itself runs inside step 2.
2. **World pass** — camera A (fov 75, near 0.08, far 900) renders layer 0 into
   the HDR target `m` (RGBA half-float + depth, MSAA 4 at high/ultra).
3. **View-model pass** — camera B (fov 60, near 0.01, far 10, `depthRange 0..0.05`)
   renders layer 1 into the same HDR target. **There is currently no layer-1
   object** (no `layers.set(1)` anywhere outside the renderer), so the pass is
   empty; the first-person arms infrastructure exists but is unused (`[M/A]`).
4. `A.run()` — the post chain (§2), then the final pass blits to the canvas.

The level, lights and sky are all on layer 0. `renderer.toneMapping` is
`NoToneMapping` while the HDR chain runs; tone mapping happens only in the grade
pass (`render/index.js:560`). Renderer is created with `antialias:false`
(`render/index.js:616`, create) — AA is 4×MSAA on the post target plus FXAA at
the end, plus the 1.1 quality render scale.

---

## 2. Pipeline inventory

Targets are created in `render/index.js:616` (`y = {...}`, `m = ...`); each
pass is a full-screen triangle with `GLASSLINE_POST <name>` shaders defined at
lines 221–614. Resolutions below are at **1920×1080, q=high**, where the
measured HDR/post buffer is **2022×1137 (2.30 Mpx)** `[M]`:

| # | Pass | Shader (line) | Resolution | Dynamic cost (q=high) | Notes |
|---|---|---|---:|---|---|
| 1 | Shadow map | three.js depth | 2048×2048, **1 cascade** | 52 casters, every 2nd frame | custom soft-shadow `getShadow` injection (lines 168–220) |
| 2 | World HDR | materials | 2022×1137, 4×MSAA | **≈415–437 calls / 64–67 k tris** `[M]` | the only geometry-heavy pass; the count depends on whether the alternating shadow pass is in the sampled frame |
| 3 | View-model HDR | materials | same | 0 draws today | empty layer, cheap CPU traversal |
| 4 | depthHalf | `depthhalf` 232 | 1011×569 | 1 texture fetch | converts depth to view-space metres, R format |
| 5 | AO | `ao` 239 | 1011×569 | **12 taps** (16 ultra, 8 low) | radius 0.9 m, skips z>140, fades 70–140 m |
| 6 | AO blur H+V | `blur` 327 | 1011×569 ×2 | 7 taps each | depth-tolerant bilateral |
| 7 | Volumetric | `vol` 271 | 1011×569 | **16 steps** (20/10/6), **1 shadow fetch per step** | two-lobe HG phase, near-field ×2.3 boost, analytic far continuation |
| 8 | Vol blur H+V | `blur` 327 | 1011×569 ×2 | 7 taps each | `BLUR_TOL 0.30` (tolerates edges, unlike AO's 0.04) |
| 9 | Composite | `composite` 340 | 2022×1137 | 4-tap bilateral upsample | AO multiply + volumetric `col·T + S`, applies to **sky too** |
| 10 | Motion blur | `motion` 372 | 2022×1137 | 9 taps + depth | shutter `min(0.5, 1/190/dt)`; off at medium/low |
| 11 | Bloom down ×6 | `down` 393 | 1011×569 → 31×17 | 13-tap first (partial Karis), 13-tap rest | threshold applied **only on the first** downsample |
| 12 | Bloom up ×5 | `up` 412 | 505×284 → 1011×569 | 13 taps each | `uMix` fixed at 0.62 (see §3) |
| 13 | Streak ×2 | `streak` 421 | 252×142 | 15 taps each | anamorphic horizontal streak from `down[2]` |
| 14 | Adaptation | `adapt` 434 | **1×1** (ping-pong) | 35 log-luma samples + 12 depth taps | temporal: `1−exp(−dt/1.5 s)` |
| 15 | Grade | `grade` 479 | 2022×1137 | ~8 texture reads | CA, bloom mix, dirt, streak, flare, exposure, ACES/AgX mix, split tone, S-curve, lift, sat, vignette, damage/fade, sRGB encode |
| 16 | Final | `final` 585 | canvas 1920×1080 (DPR2: 3840×2160) | 5 taps + up to 6 more in the FXAA branch | FXAA, sharpen 0.3, grain 0.02, dither ±1/255 |

**Fill estimate** `[A]`: passes 4–8 are 5 × half-res + 4 × half-res (blurs) ≈
4.5 full-res equivalents; bloom + streak ≈ 1.4; passes 9, 10, 15 = 3 full-res;
final at canvas size (1.0 full-res at DPR1, 4.0 at DPR2). Total ≈ **9–10
full-res equivalents at DPR1, ~13 at DPR2**, on top of one full world render —
consistent with 8.36 ms measured, and the DPR2 upscale is why the same scene
looks softer on a Retina Mac than in the 1920×1080 captures.

**Quality tiers** (`src/game/main.js:20-37`):

| tier | `scale` | `shadow` map | `msaa` | `volSteps` | AO taps | `ao` | `bloom` | motion blur |
|---|---:|---:|---:|---:|---:|---|---|---|
| low | 0.78 | 1024 | 0 | 6 | 8 | off | off | off |
| medium | 1.00 | 1536 | 2 | 10 | 12 | on | on | off |
| high | 1.10 | 2048 | 4 | 16 | 12 | on | on | on |
| ultra | 1.10 | 2048 | 4 | 20 | 16 | on | on | on |

Dynamic resolution: active unless `?shot`/`?show`/`?dynres=0`
(`render/index.js:616`, `S={scale:1, enabled:...}`). Scale steps 1.0→0.6 in
0.1 steps when avg frame time > 21.5 ms; steps back up under 17.4 ms; if still
> 26 ms at 0.6 for two hits it drops one quality tier (`quality:auto` event).
Pixel budget per tier: **low 1.0, medium 1.5, high 2.3, ultra 3.7 Mpx**
(`render/index.js:616`, `resize()`), DPR capped at 2 before the budget.

**Measured resolution `[M]`**: 1280×720 → 1408×792 (x1.10); 1920×1080 DPR1 →
2022×1137; 1920×1080 **DPR2 → same 2022×1137 while the canvas is 3840×2160**
(so the final pass upscales 1.90×; `docs/PERFORMANCE.md` confirms "Buffer
2022×1137 (high-quality pixel cap)").

---

## 3. `render.tune` — every key, current value, consumer, and whether it is live

Defaults are the object `g` at `render/index.js:616`; current values are after
`applyAtmosphere()` (`src/levels/atmosphere.js:44-59`) and were confirmed live
via the probe (`docs/visual-gap/shots/current-capture.json → info.tune`) `[M]`.
"Live" = reading `render.tune.*` from a console changes the next frame without a
reload. Only the **volumetric** uniforms and the **grade defines** are
contract-tested live (`src/engine/render/tune-live.test.js`); the rest was
verified by reading the per-frame `P()` block at `render/index.js:616`.

| Key | Engine default | **Current** | Consumed at | What it does | Live? |
|---|---:|---:|---|---|---|
| `volSunScale` | 0.85 | **0.75** | `P()`: `uSunRad = sun.intensity × volSunScale` | sun in-scatter brightness | yes |
| `volAmbient` | 0.20 | **0.10** | `P()`: `uAmb = skyColors.fog × volAmbient` | ambient in-scatter colour/brightness | yes |
| `volSigma` | 0.0034 | **0.0020** | `P()`: `uSigma` | haze extinction per metre (shape(y) = 0.30+0.70e^(−h/5.5)) | yes |
| `volMaxDist` | 170 | **170** | `P()`: `uMaxDist` | max ray-march distance (m); sky uses 0.55× | yes |
| `volFarHaze` | 0.42 | **0.22** | `P()`: `uFarHaze` | analytic haze beyond `volMaxDist` | yes |
| `volInteriorDust` | 6 | **6** | `P()`: `uBoxDust` only if `level.interiorBoxes[0]` exists | interior dust multiplier | **dead** (tutorial has no interior boxes) |
| `aoRadius` | 0.9 | **0.9** | AO material **construction only** (`uRadius`) | AO world radius | **no** |
| `aoIntensity` | 1.6 | **1.6** | AO material **construction only** (`uIntensity`) | AO strength | **no** |
| `aoStrength` | 0.95 | **0.95** | composite material **construction only** (`uAoStrength`) | composite mix | **no** |
| `bloom` | 0.065 | **0.09** | grade `uBloom` | `mix(col, bloomTex, bloom)` | yes |
| `bloomThreshold` | 0.9 | **1.8** | first bloom downsample `uThreshold` | HDR threshold before bloom | yes |
| `bloomMix` | 0.62 | **0.62** | up-pass material **construction only** (`uMix`) | up-chain blend weight | **no** |
| `dirt` | 0.10 | **0.04** | grade `uDirt` | lens-dirt additive | yes |
| `streak` | 0.03 | **0.03** | grade `uStreak` | anamorphic streak add | yes |
| `streakThreshold` | 2.2 | **1.15** | first streak pass `uThreshold` | streak threshold | yes |
| `flare` | 0.16 | **0.16** | grade `uFlare` | procedural sun flare | yes |
| `key` | 0.12 | **0.12** | adapt/grade `slExposure()` | auto-exposure target luminance | yes |
| `minExposure` | 0.6 | **0.6** | same | exposure clamp low | yes |
| `maxExposure` | 2.0 | **2.0** | same | exposure clamp high (currently pegged here) | yes |
| `adaptTau` | 1.5 | **1.5** | adapt `uRate` | eye-adaptation time constant (s) | yes |
| `agxMix` | 0.25 | **0.12** | grade `uAgxMix` | `mix(ACES, AgX, agxMix)` | yes |
| `ca` | 0.0013 | **0.0013** | grade `uCA` | radial chromatic aberration | yes |
| `vignette` | 0.3 | **0.3** | grade `uVignette` | corner darkening | yes |
| `grain` | 0.02 | **0.02** | final `uGrain` | film grain | yes |
| `sharpen` | 0.3 | **0.3** | final `uSharpen` | unsharp mask | yes |
| `lookPower` | 1.18 | **1.28** | **GLSL define** `LOOK_POWER` inside AgX only | AgX contrast curve | yes, **recompiles** the grade shader |
| `lookSat` | 1.22 | **1.22** | GLSL define `LOOK_SAT` inside AgX only | AgX chroma | yes, **recompiles** |

Non-tune but look-critical values:

| Lever | Current | Where |
|---|---:|---|
| manual exposure (`game.render.exposure`) | **1.0** | `lighting.js:19,78`; also `glassline/index.js:307` |
| `scene.environmentIntensity` | **0.34** | `sky.js:73` |
| PMREM env capture | sky-only, `fromScene(envScene, 0, 0.1, 1000)` | `sky.js:64-78` |
| scene fog | `FogExp2(#e3f2f9, 0.0011)` | `build.js:555` + `atmosphere.js:22,58` |
| volumetric haze palette | engine sky colours `#2b608c/#f5dfc4/#9bb9c7`, fog `#cfe0e7` | `main.js:110-115` → `render/index.js:616` |
| sun | `#fff1d6`, intensity 3.4, direction (0.298, 0.447, −0.844) | `main.js:106-108` → `lighting.js:50-51`; `levels/sun.js:7` |
| fill lights | hemi 0.85, rim 1.0, warm 0.5 | `lighting.js:9-14,42-44` |
| `viewFill` (view-model env multiplier) | 1.35 (undefined → default), applied only to the empty view-model pass | `render/index.js:616` |

**Live-tuning gotcha:** `aoRadius`, `aoIntensity`, `aoStrength` and `bloomMix`
cannot be changed without an engine edit + reload (they are baked into material
uniform objects at construction). `?atmo=off` (the documented "previous look")
still applies `ATMOSPHERE.base` (bloom 0.09/threshold 1.8/streak 1.15) and only
skips the `look`/`haze` groups (`atmosphere.js:44-55`).

---

## 4. Shadow setup

**Cascade count: 1.** One `DirectionalLight` named `sun` with `castShadow`
(`render/index.js:616`, create; `lighting.js:48-52`). There is no CSM, no
cached static shadow, no contact/AO shadow map beyond the decals in
`src/levels/contact.js` (1 instanced draw, 128² alpha texture, no light response).

**Map size per tier** (`main.js:22-35`, clamped by `capabilities.maxTextureSize`
at `render/index.js:616`): low **1024²**, medium **1536²**, high **2048²**,
ultra **2048²** — measured live `mapSize [2048, 2048]`, `type 1` (`PCFShadowMap`),
`autoUpdate: false` `[M]`.

**Frustum extent.** Fitted once at startup by `Gy()` (`render/index.js:616`,
`Gy(h, (-41,-0.2,-33), (37,32,31), (-41,-3,-64), (72,36,34))`) which projects
those level corners into light space and writes `shadow.camera` bounds; the
soft-shadow chunk bakes the same width/height/depth as `SL_FRUSTUM`/`SL_DEPTH`
shader constants (`render/index.js:170-171`). Computed from those inputs `[A/M]`:

| property | value |
|---|---|
| light-space footprint | **96.85 m wide × 69.36 m tall** |
| depth range | near **111.83 m** … far **249.80 m** (137.97 m) |
| shadow texel, 2048² | **4.73 cm × 3.39 cm** |
| shadow texel, 1536² | 6.31 × 4.52 cm |
| shadow texel, 1024² | 9.46 × 6.77 cm |

Live probe confirms exactly these numbers `[M]`.

The box **does follow the player**: `lighting.update(game.camera.position)` runs
every frame (`tutorial.js:699-702`) and re-positions the light target on the
camera in light space, with per-texel snapping to stop shimmer
(`lighting.js:29-32,85-109`); the light distance from target is preserved at
200 m. The *size* is fixed by the startup fit (comment `lighting.js:16-17,57-59`)
so following is a translation only. Because the fit was authored for the whole
level, it is much larger than a character-scale shadow box — a **±28 m plan,
−2…28 m height** fit would give 73.45 × 60.75 m → **3.59 cm texels at 2048²**
and 2.39 cm at 3072², i.e. ~30 %/50 % sharper shadows for one line of changed
numbers. `[A]`

**Bias / penumbra / taps** (custom replaces three's `getShadow`,
`render/index.js:168-220`):

- `shadow.bias = −0.00012`, `shadow.normalBias = 0.03` (engine sets 0.02, the
  level overrides to 0.03 at `lighting.js:72-73`; measured 0.03), `radius = 1`.
- Renderer: **8 blocker-search taps + 16 PCF taps** (low: 8 + 10) = **24 texture
  fetches per shadowed fragment**; Vogel-disk sampling with per-pixel IGN
  rotation, receiver-plane depth-derivative bias (clamped to ≈0.6 m per kernel),
  penumbra grows `0.022 m per metre` of blocker distance, clamped to
  **1.2–60 cm**; outer 2 % of the map fades to lit to hide the border.
- Map refresh: `renderer.shadowMap.autoUpdate = false`
  (`render/index.js:616`, create) and `needsUpdate` is only set when
  `quality==='ultra' || shot || (frame & 1) === 0` — i.e. **every second frame**
  at 60 fps; player-follow light motion is therefore one frame stale between
  refreshes (static level geometry, so no visible swimming).

**What casts / receives** `[M]`: 52 casters and 46 receivers out of 185 meshes.
Cast: level platforms (`build.js:126-127`), obstacles (`:375-376`), some props
(`:430,444,455,482,546,552`), the finish gate. **Do not cast:** the entire city
(`city.js:341-342` sets `castShadow=false; receiveShadow=false` for building
bodies; every other city instanced mesh leaves the default `false`), all
instanced roof detail — fascia, curbs, legs, AC, vents, huts, pipes, rails,
solar, doors (`build.js:287-362` never sets the flags), route strips
(`:278-285`), the floor safety stripes intentionally (`floor.js:64`), contact
decals (`contact.js:80-81`), both characters (`characters.js:46,55-56`), all
windows/signs/rings (Basic materials). **Do not receive:** everything listed
above as non-receivers — notably the city and the character rigs.

**Measured shadow contribution** `[M]`: at the start checkpoint, toggling
`sun.shadow.intensity = 0` changes 8.4 % of pixels by >2/255, **3.9 % by >3/255,
2.2 % by >4/255, 0.6 % by >8/255**, maximum darkening **27/255 (10.6 %)** — thin, low-contrast
shadows consistent with the fill rig (§7.2). The delta stays in the same order
of magnitude when exposure is pinned at 2.0 instead of auto (§10 harness):
the shadow is present, it is simply buried under fill.

---

## 5. Materials and textures

**Material families** `[M]` (live traversal of the built tutorial scene):
103 `MeshStandardMaterial`, 36 `MeshBasicMaterial`, 2 `ShaderMaterial`
(engine dome — hidden — and the active high-key dome), plus 1 `LineBasicMaterial`
(platform edges, 324 line segments at capture), 4 `SpriteMaterial` (3 in-world act
labels + the sun billboard) and the guide/beacon line material
(`guides.js:54-57`). 141 unique material instances total.

| Property | Finding |
|---|---|
| Colour maps | 67 materials have `map`; all are procedural `CanvasTexture` |
| **Normal maps** | **0** |
| **Roughness maps** | **0** |
| **Bump / displacement / AO maps** | **0** |
| Emissive | 5 materials (red route paint `build.js:63-70`, finish gate `:536-541`, courier accent `characters.js:20-24`, spire crown `city.js:674-681`, beacon gem `guides.js:44-52`) |
| Explicit envMap | **1** material: city glass bodies (`city.js:313-321`), `envMapIntensity 1.2` |
| Scene env intensity | 0.34 (`sky.js:73`) — applies to all standard materials *without* an explicit envMap (three.js overrides `envMapIntensity` from `scene.environmentIntensity` in that case — verified in `three.module.js` r180) → city glass is **3.5× more env-lit** than everything else |
| Roughness values | 27 distinct, **0.10 → 1.00**; almost all architecture 0.72–0.95; only glass 0.10, solar 0.32, twist 0.28–0.38 |
| Metalness | **0.04** on the shared `standard()` helper (`build.js:31-37`); 0.84 only on city glass; 0.02–0.05 elsewhere |

**Texture atlas** (`src/levels/textures.js`): there is **no single atlas** — a
factory produces 8 generators → **41 unique `CanvasTexture`s** live `[M]`:

| generator | size | count live | content |
|---|---:|---:|---|
| `concrete` (per platform colour; each platform clones it for its own `repeat`) | 512² | ~26 clones of ~5 source images | base colour, grain ±3.5/255, 3 radial stains, 4×4 panel tones ±4 %, seams every 128 px, 3 px tile-edge joint, light seam edge |
| `side` | 512² | 1 source (+ clones) | dark board-formed side texture, vertical seams every 128 px |
| `facade` / `glassFacade` | 512² | 2 | curtain-wall stripes, painted windows (used on far city) |
| `roof` | 512² | 1 | roof membrane with drains |
| `metal` | **256²** | 1 | brushed metal, repeat [2,2] |
| `asphalt` | 512² | 1 | street grid (only used if a street deck exists — the abyss replaced it) |
| `red` | **128²** | 1 | worn red route paint, repeat [2,8] |
| sign plates | 512×144 | 3 | act / wayfinding text |
| contact shadow alpha | 128² | 1 | soft rectangle falloff |

Totals measured live `[M]`: **41 unique texture objects — 35 at 512², 3 at
512×144, 2 at 128², 1 at 256²** (many of the 512² are clones sharing the same
canvas image, e.g. one concrete canvas per colour used by all platforms).
All are set `colorSpace = SRGBColorSpace`, `wrapS/T = RepeatWrapping`,
`anisotropy = min(8, maxAniso)` (`textures.js:85-107`), default mipmap filtering.
Platform tops clone the concrete texture and set `repeat = size/4` (`build.js:103-110`)
→ a 4 m texture tile with 1 m panels; small slabs therefore show a *lot* of
repeating 512² detail (a 2 m ledge sees half a tile).
The textures are deliberately low-contrast: `GRAIN.concrete = 7`, `side = 6`,
`TONE.panel = 0.04` (`textures.js:17-19`) — the highest-frequency luminance
variation in a surface is ±1.4 %, and there is no baked AO, no joint shadow, no
height field. That is why measured `edge_energy` is 0.0154 against the
reference's 0.0341 even before tone-mapping.

**Unlit surfaces** (36 Basic materials): city window bands (`city.js:413-437`,
white/teal instance colours, `MeshBasicMaterial`), the abyss plane
(`city.js:298-305`, `#eaf7ff` = sRGB (0.92, 0.97, 1.00) — a luminous floor
under everything, brighter than the reference's *sky* mean luma 0.53), the distant skyline (`city.js:736-752`, flat `#8fa9b2` boxes with
fog), signs (`build.js:50-57`, `city.js:578-590`), checkpoint rings/finish
(`build.js:513-527`), the landmark spire rings (`city.js:686-693`), contact
decals (`contact.js:56-65`). `MeshBasicMaterial` ignores sun, shadow and
fill (constant albedo × colour, no light response); the abyss and the window strips are constant
full brightness, which is a second reason the mid-ground reads flat.

**Environment/PMREM.** The active reflection environment is captured from the
*gradient* dome only (`sky.js:64-78`), no sun disk, no clouds, sigma 0; the
engine's own PMREM built from the hidden cloud dome (`render/index.js:168`
`Vy()`, `fromScene(s, 0, .1, 100)`) is overwritten by `sky.js` and is dead code.
Implication: city glass (roughness 0.10, metalness 0.84, env 1.2) reflects an
almost featureless cream-to-blue gradient — bright milky glass, no cloud/sun
structure — while the reference's glass reflects a sky with clouds and a sun.

**UV/texel density** `[A]`: platform tops are `size/4` repeats of 512²
(≈128 px/m at 4 m tile). At 2 m from a wall at 1080p a texel covers ~6 screen
pixels — the texture is visibly soft and the low contrast makes it read as a
flat colour.

---

## 6. Camera and view

- Main camera: `PerspectiveCamera(fov=74 passed in main.js:116, then the player
  controller forces 75/84/88; near 0.08, far 900)`. Actual base FOV comes from
  `player.js:27-30` (`BASE_FOV 75`, `SPRINT_FOV 84`, `SLIDE_FOV 88`), so the
  `74` in `main.js:116` and `docs/CAMERA.md` is dead. Inside a first-person
  parkour game, facing slightly down, the visible vertical band above the
  horizon at 1080p is roughly 5–35° elevation — exactly the band where the
  gradient sky (§0.3) is white.
- Eye height 1.65 m (`player.js:15`), landing spring ±0.32 m
  (`player.js:700-760`), camera roll on wallrun/vault/slide (existing).
- View-model camera (fov 60, near 0.01, far 10) renders layer 1 — **no
  first-person arms exist in the scene graph**: the courier rig is a world-space
  capsule figure, hidden while not in HUD.
- Motion: sprint FOV +9°, slide +13°, landing dip, motion blur shutter
  `min(0.5, 1/190/dt)` with velocity capped at 1.8 % of screen height.

---

## 7. Diagnosis — concrete parameter-level causes of "washed out, flat, toy-like"

The owner-facing ranking lives in `docs/VISUAL_GAP.md §2-3`; this section is the
pipeline-level causal chain with the numbers that support or reject each
candidate. Measured image deltas are from this audit's A/B harness (§10).

### 7.1 Auto-exposure is pinned at 2.0 by metering the bloom buffer — primary cause

Chain: `render/index.js:616` `P()` sets `be.tLum.value = ve.bloom ? y.down[b-1].texture : xe`;
the bloom chain's **first** downsample subtracts `uThreshold = bloomThreshold`
(1.8 HDR) and every later mip is a blur of that thresholded signal
(`render/index.js:393-411`). For a scene whose HDR values are mostly 0.2–3, the
deepest mip is essentially empty, so the adapt pass reads the 0.002 clamp floor
and computes `pow(0.12/0.002, 0.85) ≈ 32` → clamped to `maxExposure = 2.0`.
Measured `[M]`: `adapt = {lum: 0.002, auto: 2}` on high/medium/ultra; with
`?bloom=0` the same view meters `{lum: 0.232, auto: 0.6}` — a **3.33×
tier-dependent exposure swing**, and the low tier is accidentally the better
exposed one.

Effect of the 2.0 multiplier on its own (measured, A/B start view, `maxExposure`
pinned 2.0 vs 1.0) `[M]`: mean linear luminance **0.564 → 0.362**, saturation
**0.100 → 0.163**, fraction of "blue sky" pixels **0.07 → 0.19**, top sky row
sRGB **(130,151,182) → (76,105,153)**. Mechanism, computed with the real
ACES/AgX + grade math `[A]`: a 20° sky of linear (0.49, 0.58, 0.75) becomes
(0.98, 1.15, 1.50) after the 2× multiplier — all three channels are inside the
ACES shoulder, which compresses them toward a neutral (displayed
(223,222,220, blue−red separation 3/255); at exposure 1 the same sky displays
(183,188,195, separation 12/255). The multiplier is what removes the sky's
colour, not the dome shader alone.

### 7.2 No key/fill ratio — shadows carry 2 % of the frame

Light budget (all live values `[M]`, scene graph): sun 3.4 `#fff1d6`, hemisphere
0.85 with **white** sky colour `#ffffff` (`lighting.js:9`), cool directional
1.0 `#b9e4ff`, warm directional 0.5 `#ffd0a4`, scene env 0.34. For a white
(a=0.82) horizontal roof the analytic diffuse terms are `[A]`: sun **0.396**,
total ambient/fill **0.217–0.285** → **sun:ambient ≈ 1.4–1.8 : 1**. In the
tone-mapped image at exposure 2 that is sRGB **(215,199,170) lit vs (173,180,180)
shadow — a 1.17× luma ratio** for what should be the strongest contrast in the
frame. Measured consequence: `shadow.intensity = 0` changes **3.9 %** of pixels
>3/255 (2.2 % >4/255, max 27/255) — the shadows are there, they just cannot read.
Changing the rig (sun 5.2, hemi 0.25, rim 0.35, warm 0.2, env 0.12) raises the
A/B contrast metric **0.720 → 0.793** and std **0.213 → 0.253**, the biggest
isolated lighting gain measured. `[M]`

### 7.3 The visible sky is cream by construction — second cause, and it cannot be tone-mapped away

`sky.js:45-47` computes
`mix(uHorizon #e9f5fb, uTop #1454a6, pow(clamp(dir.y), 0.55))`. In linear:
`uHorizon = (0.815, 0.913, 0.965)`, `uTop = (0.007, 0.089, 0.381)`.
Display values computed with the same ACES/AgX + grade math `[A]`:

| elevation | current code, exposure 2 (sRGB) | same, exposure 1 |
|---:|---|---|
| 5° | (234, 230, 222) | (203, 203, 199) |
| 20° | (223, 222, 220) | (183, 188, 195) |
| 30° | (214, 215, 218) | (165, 177, 194) |
| 37° (top of a level frame) | (203, 208, 216) | — |
| 73° (camera pitched up) | (1, 120, 228) | (0, 75, 182) |

The blue exists only above ~45° elevation, which is off-screen in normal play;
at the elevations that are actually visible the dome is a near-neutral 205–235.
Measured screen top rows in the shipped captures are **(199, 205, 205)**, versus
the reference's **(65,99,213) / (56,106,185) / (69,120,228)** at comparable rows.
Additionally the dome has **no clouds** (the engine's fbm cumulus deck at
`render/index.js:79-165` is hidden by `build.js:559-561`), and its only sun is
`pow(sun,12)*0.24 + pow(sun,360)*0.9` additive glow (`sky.js:51-53`) with no
sun disk.
A palette-only test (computed `[A]`): `uTop #0a3d8f`, `uHorizon #a8c9e2`,
exponent `0.32`, exposure 1 gives 5° ≈ (116,155,190), 20° ≈ (82,126,184),
37° ≈ (53,99,176) — within a few units of the measured reference rows at 30–40°
elevation for R and G. That is the concrete target for the re-colour.

### 7.4 Four additive glare layers in the same direction

In the sun direction the frame stacks: (a) the **110 m sun sprite** at a fixed
world position (`build.js:578-591`; angular diameter and offset measured:
29.4°/14.2° at spawn → 43.4°/4.9° at act 2 → **80.6°/60.3° at the finish**),
`AdditiveBlending`, `depthTest:false`, renderOrder −1, alpha up to 0.95;
(b) the dome's additive aureole (`sky.js:52-53`); (c) the volumetric in-scatter
(phase peak ×1.15, near-field weight 2.3, `uSunRad = 3.4 × 0.75 `) applied to
both geometry **and sky pixels** (`uVolOn` branch in the composite); (d) screen
flare `uFlare 0.16` + bloom (`0.09` at threshold 1.8) + streak (`0.03` at
threshold 1.15) + lens dirt.
Measured `[M]`: hiding the sprite and zeroing flare changes **12.7 % of the
frame**, mean **+6.8/+4.8/+3.0 RGB**; the top-centre patch of the shipped frame
is (216,215,215) — a neutral white blob. Bloom alone (exposure pinned) changes
84 % of pixels by >2/255, 46 % by >4/255, max 119/255 (around the glare) —
so bloom is not idle, but it is amplifying the already-white glare rather than
adding sun detail. The sprite veil and the dome palette are **two separate
problems**: on a straight-up view the sprite is out of frame (hiding it changes
the centre pixel by 0/255, measured), yet the dome still renders neutral white at
the elevations visible in play (§7.3) — both must be fixed.

### 7.5 Grade: contrast controls sit downstream of the tonemap's flattening

- `col = mix(ACES, AgX, 0.12)` (`render/index.js:560`, `agxMix 0.12`) — despite
  `agxMix` having been *lowered* from 0.25, **88 % of the image is ACES**, and
  **`lookPower`/`lookSat` live only inside the AgX branch** (`:500-501`). So the
  comment in `atmosphere.js:15-16` that `lookPower` is "the main lever against
  the washed-out look" is wrong at today's values: its effective weight is 12 %.
  Measured: switching to engine defaults (`lookPower 1.18`, `agxMix 0.25`,
  heavier haze — `?atmo=off`) changes mean linear luminance 0.564→0.566,
  saturation 0.100→0.096, contrast 0.720→0.720 — **no measurable effect** `[M]`.
- After the tonemap the grade adds a 22 % S-curve mix (`:568`), lifts blacks by
  +0.006..+0.011 (`:570`), then multiplies by up to 0.988. The result is the
  measured value ladder: p1 0.205 vs reference 0.112, p95 0.904 vs 0.979,
  near-white 6.0 % vs 27.3 %, deep shadow 0.18 % vs 3.0 % (from
  `metrics.json`, sRGB-luma space). **The frame has neither a black nor a white
  end** — that is the definition of the washed look.
- `vignette 0.3` darkens corners, which on an already-flat frame trades
  contrast for a fake filmic look; grain 0.02 ±5/255 and the ±1/255 dither add
  texture but no structure.

### 7.6 AO is effectively disabled by its own lit-pixel fade

Composite `:363-368`:
`lit = smoothstep(0.16, 0.85, luma(col) * slExposure())` and
`a = mix(1.0, ao, uAoStrength * (1 - 0.8 * lit))`. With `slExposure() = 2.0`
almost every lit surface has `luma·2 > 0.85` → `lit = 1` → effective strength
`0.95 × 0.2 = 0.19`. Measured `[M]`: `?ao=0` changes mean linear luminance by
**+0.011 (0.564→0.575, ~2 % relative)** and the dark-pixel fraction by 3 points
(0.103→0.073). The AO
exists (radius 0.9 m, 12 taps, half-res) but contributes nothing visible — props
do not sit in contact shadows; the hand-made contact decals (`contact.js`) are
doing all the grounding work.

### 7.7 No micro-shading anywhere (materials, not tone)

0 normal maps, 0 roughness maps, no baked AO in the texture, roughness constant
per material, grain amplitude 7/255 in the albedo only. The sun cannot produce
specular shape on any surface except the painted city glass, because roughness
0.72–0.95 + metalness 0.04 = pure Lambert. This is why at 2 m a wall is a flat
rectangle even when exposure and grade are fixed. Measured: **edge energy 0.0154
vs 0.0341 (−55 %)**, **local contrast 0.0376 vs 0.0713 (−47 %)**; the look-dev
presets (VISUAL_GAP §5) move edge energy only 0.0098→0.0111 while they move tone
a lot — the detail gap is content, not tuning.

### 7.8 Fill from unlit/ambient geometry

36 Basic materials are at constant full brightness: the **abyss plane**
`#eaf7ff` under the whole level (`city.js:298-305`, sRGB
(0.92, 0.97, 1.00) → brighter than the reference's sky) and the unlit cyan window strips. Combined with
`environmentIntensity 0.34` (scene) and the explicit `1.2` on city glass, every
surface gets sky light with no occlusion: the mid-ground has no dark side. The
reference's city is dark blue glass with bright window bands and deep recesses;
the current city is pale boxes with pale bands.

### 7.9 Two palettes, three fog colours, two suns (pipeline inconsistency)

- Dome palette: `#1454a6 / #e9f5fb / #ddecf8` (`sky.js:21-23`).
- Volumetric shader horizon + ambient: engine `uZen/uHor/uHorAway = #2b608c /
  #f5dfc4 / #9bb9c7` and fog `#cfe0e7` (`main.js:110-115` → `render/index.js:616`).
- Scene fog: `#e3f2f9` (`build.js:555`).
Consequence `[A]`: distant geometry fades toward a warm/steel horizon that does
not match the cream dome behind it, and the haze glow over the sky uses a
different palette from the sky — a depth cue that reads as a flat veil. The
volumetric pass also in-scatters in front of the **sky** (sky pixels are marched
up to 0.55 × 170 = 93.5 m), which is physically wrong and adds white exactly
where the sky should be.
Second sun: the flare is placed from the *engine* sun direction
(`render/index.js:616`, `project(dir*500+camPos)`), the billboard is at a fixed
world point — the two disagree by 14° at spawn, 60° at the finish. The sun
"sprite" is also the only sun disc the player ever sees.

### 7.10 Resolution / temporal softness on Retina

At DPR 2 the post buffer stays 2022×1137 while the canvas is 3840×2160 (2.3 Mpx
cap); final pass upscales 1.9×, and 4×MSAA at 1.0 CSS-px/px cannot recover the
detail. Add `motionBlur` on high/ultra with a 9-tap blur and the net read is
soft on exactly the display a Mac owner is likely using. The 2008 reference is a
sharp 720p/60 capture of native 1280×720 rendering with 2–4×MSAA.

---

## 8. Levers

Costs are for one experienced developer with this repo; "expected effect" is the
measured delta where it exists, otherwise a computed target with the reasoning.
Suggest doing them in order: later rows are only measurable after 1–2.

### (a) Same-day tuning — hours, values only (plus tiny engine fixes)

| # | Lever | Current | Proposed | Expected effect | Cost | Risk |
|---|---|---|---:|---|---:|---|
| 1.1 | **Exposure metering** — make the adapt pass meter the **unthresholded** scene (or `render.autoExposure=false` + manual) | meters bloom mip → `auto 2.0`; manual 1.0 | meter `xe` (scene) always; then `key 0.25, min 0.5, max 1.3` (scene luma measured 0.232 → auto ≈ 1.07). Or manual `exposure 0.95–1.05`, `autoExposure=false` | measured exposure 2→1 alone: mean linear 0.564→0.362, sat 0.100→0.163, blue-sky pixels ×2.7, sky top row (130,151,182)→(76,105,153). Removes the q=low vs q=high 3.3× swing | 1–2 h | medium: changes every tier; retune grade and bloom threshold after; low tier already ~correct |
| 1.2 | **Fill rig** — one key, sky fill, no second/third key | sun 3.4; hemi 0.85 white; rim 1.0; warm 0.5; env 0.34 | sun **5.0**; hemi **0.25** with sky `#cfe4ff`/ground `#4a5a66`; rim **0.35**; warm **0.20**; `env 0.12` | measured (sun 5.2/hemi 0.25/rim 0.35/warm 0.2/env 0.12): contrast 0.720→0.793, std 0.213→0.253, mean L 0.564→0.501 — the largest isolated modelling gain | 1 h | low |
| 1.3 | **Sky palette + gradient** — deepen horizon, move transition into visible band | `#1454a6` / `#e9f5fb`, `pow 0.55` | `uTop #0a3d8f`, `uHorizon #a8c9e2`, `uBottom #c2d6e6`, exponent **0.32**, reduce sun-glare terms 0.24→0.08 and 0.9→0.5 (`sky.js:21-23,45-47,51-53`) | computed display at exposure 1: 5° (116,155,190), 20° (82,126,184), 37° (53,99,176) vs reference rows (56–69, 99–120, 185–229) — matches R/G, B ~5–20 short | 2–4 h + look-dev sign-off | low; art-direction sign-off needed |
| 1.4 | **Kill the billboard sun** — the biggest single white source | sprite 110 m, opacity 0.95, `depthTest:false`, fixed world pos | delete sprite; put sun disk + glare in the sky shader at the true direction; or at minimum `scale 45`, `opacity 0.4`, `depthTest:true` | measured: sprite+flare cover **12.7 %** of the frame at +6.8/+4.8/+3.0 RGB; removing it stops the 29°→81° white veil that grows down the route | 1–2 h (delete) / 4 h (proper sun disk) | low |
| 1.5 | **Grade** — put contrast where it acts: ACES branch, not the 12 % AgX branch | agxMix 0.12; lookPower 1.28 (12 % weight); S-curve 0.22; lift +0.006..+0.011 | `agxMix 0` (or 1.0 **and** apply look to the whole mix); explicit ACES-side contrast: S-curve weight **0.35–0.45**, lift **0.002/0.003/0.004**, `lookSat 1.35`, `vignette 0.20–0.25`, `grain 0.012` | displayed p95/p1 move from 0.904/0.205 toward ref 0.979/0.112 (metrics.json); recovers the white end the exposure fix removes from the mids | 2–3 h | low |
| 1.6 | **Bloom/streak thresholds** — targets the glare only, not the whole sky | bloom 0.09 @ thr 1.8; streak 0.03 @ 1.15; dirt 0.04 | bloom **0.05 @ thr 2.6**; streak **0.015 @ 2.0**; dirt **0.02**; flare **0.08** | bloom measured: 46 % of pixels >4/255, max 119 at the glare; after exposure 1 the HDR max drops, so raise threshold to keep only the sun/speculars | 1 h | low |
| 1.7 | **AO live again** — remove exposure from the lit fade, raise strength | `uAoStrength 0.95 × (1−0.8·lit(exposure 2))` ≈ 0.19 effective; radius 0.9 | fade on a **fixed** reference (e.g. luma at exposure 1) or `(1−0.5·lit)`; `aoRadius 1.2`, `aoIntensity 2.0`, `aoStrength 1.0`; note these three are **not live** — change defaults at `render/index.js:616` | AO currently changes mean L by +0.011 (≈2 %) and dark pixels by +3 pp; target: visible contact darkening under props and at parapets (props stop floating) | 1–2 h | low; half-res AO noise may need radius tuning |
| 1.8 | **Shadow tightening** — smaller following box, same map | 96.85×69.36 m @2048 (4.7 cm) | fit the hardcoded corners in `render/index.js:616` to ±28 m plan/−2…28 m height → **73.45×60.75 m (3.59 cm)**; with 3072² → **2.39 cm** | crisper contact shadows; needed to make 1.2's contrast read at prop scale | 30 min + reload | low; update `SL_FRUSTUM` automatically (baked from the fit) |
| 1.9 | **Render resolution on Retina** | 2.3 Mpx cap; DPR2 upscales 1.9× | high budget **3.0–3.4 Mpx** and/or cap `pixelRatio` at 1.5; keep dynamic scale | 3.0 Mpx at 1920 CSS ≈ 1.2× CSS-px supersample instead of 1.05; less soft, FXAA has more to work with | 30 min | low-medium: fill cost, but 8.36 ms measured vs 16.7 ms budget |
| 1.10 | **Fog/haze palette unification** | 3 palettes (dome / vol / scene fog) | one palette: scene fog `#cfe3ef`, vol `uAmb` from same, `fogDensity 0.0005–0.0007`, `volSigma 0.0012`, `volFarHaze 0.10`, `volAmbient 0.05` | measured: thinning from engine defaults to current only moved top-third contrast 0.0212→0.0236 (+11 %) — air is a **minor** lever; expect ~10–20 % top-third contrast, mainly removes the warm/cream mismatch | 1–2 h | low |

### (b) 1–3 days — small structural work

| # | Lever | Current | Proposed | Expected effect | Cost | Risk |
|---|---|---|---:|---|---:|---|
| 2.1 | **Day-sky v2 with cumulus** (the reference's single strongest read) | flat gradient, 0 clouds, hidden cloud shader | re-colour the engine fbm cumulus deck (`render/index.js:79-165`) to a clear day: blue zenith `#1a5bb8`, white cloud tops, grey-blue bases, tighter deck; keep sun disk + aureole; rebuild the PMREM from it; delete the 110 m sprite | sky is 20–40 % of a first-person frame; measured sky_blue_frac **1.2 % vs 53 %**, sky_sat **0.075 vs 0.398**, sky luma std 0.10 vs 0.22 (clouds). Preset D (re-show existing storm sky) already adds cloud structure (VISUAL_GAP §3.4) | 2–3 d | medium: shader compile fallback exists; PMREM must re-capture; the cloud shader was written for a storm palette and needs full art pass |
| 2.2 | **Sun angle + shadow direction** | 26.5° elevation, azimuth down the route (−Z) | **50–60° elevation**, 40–60° off axis, e.g. `[-0.52, 0.93, -0.42]`; move the sprite/flare direction; keep the 200 m light distance and shadow box fit | roofs receive `sin 55° = 0.82` instead of `sin 26.5° = 0.45` of the sun → white roofs can clip to near-white; raking side-light on facades replaces the all-backlit frame. Requires 1.2 first (probe measured that sun alone is compensated by auto exposure) | 1 d + look-dev | medium: invalidates existing captures; shadow penumbra constants stay valid because they are baked from the same fit |
| 2.3 | **Material micro-detail kit** | 0 normal maps, constant roughness | generate **normal maps** from the existing canvas height (Sobel the grain/panel seams, `normalScale 0.6–1.0`), **roughness maps** (±0.15 variation), 1024² concrete tiles, anisotropy 16, world-space texel density 128–256 px/m; add `envMapIntensity` ramps | measured edge_energy 0.0154 vs ref 0.0341, local contrast 0.0376 vs 0.0713; target edge_energy ≥0.022, local_contrast ≥0.050 (VISUAL_GAP Tier 2). This is the "not a toy" half | 1–2 d | low-medium: memory + generation time; no new assets needed |
| 2.4 | **Full-res / higher-quality AO** | half-res 12 taps, radius 0.9 m | full-res or quarter-res with 24 taps and a 1.2 m radius; brighter-luma reference for the fade; optional 2-frame temporal jitter | contact AO at props, parapets, window recesses; half-res AO misses 10–20 cm detail at 1011×569 | 1 d | medium: fill cost (1 full-res pass ≈ +0.5 ms measured headroom) |
| 2.5 | **Cascaded shadows / shadow coverage** | 1 cascade 97 m, 52 casters, city unshadowed | 2 cascades (30 m / 90 m) or tightened 1 + a second "distant" map; enable city-shadow proxy for near towers; characters cast | visible cast shadows at 10–60 m with 2–3 cm texels; reference has crisp thin shadows (fences, cables) — currently only 3.9 % of pixels change when shadows are removed | 2–3 d | medium: draw-call/fill budget; the soft-shadow chunk is patched for one map and must be extended carefully |
| 2.6 | **First-person presence via the existing view-model pass** | layer-1 pass empty; courier rig world-space and hidden | put forearms/hands (+ a small `viewFov 60` camera pass) on layer 1; depthRange trick is already implemented at `render/index.js:616` | the reference shows hands in every frame; strongest "you are a body" read for ~2 draw calls | 1–2 d | low-medium: rig exists in `characters.js`; needs a hand/arm pose set, not new tech |

### (c) Structural — weeks, new content or new tech

| # | Lever | Why | Scale | Risk |
|---|---|---|---|---|
| 3.1 | **City canyon instead of a roof highway** | The reference's strongest compositional read is near verticals 3–10 m away, sky as a narrow band, foreground parallax. Current: 15 m corridor of box facades, floating slabs over a luminous abyss (`docs/VISUAL_GAP §3.7`, `contrast_top_over_bottom` 0.44 vs 0.84). | 1–2 weeks of level/city authoring + budget (today ≈415–437 calls / 64–67 k tris; target ≤1 200 calls / ≤1.2 M tris at 60 fps) | high: gameplay/level layout |
| 3.2 | **Prop/content density ×6–10** | 12 props / 203 m vs 30–60 identifiable objects per reference frame; surface vocabulary (coping, ducts, dishes, fences, cranes) is what reads as "AAA 2008" at screenshot scale. | 1–2 weeks | medium |
| 3.3 | **Physical shading upgrade** | Real specular response: roughness maps, Fresnel-correct glass, reflection probes or a second PMREM per zone, `MeshPhysicalMaterial` for glass with low roughness + envMap, sun glints. | 1–2 weeks | medium-high (perf, art) |
| 3.4 | **Temporal AA + better upscaling** | A 1×-CSS-px render (no 1.1× supersample) with TAA would remove the Retina upscale and the aliasing trade-off; requires velocity buffer + history. WebGL2 can do it (no compute); costs ~1 week + memory. | 1–2 weeks | high complexity |
| 3.5 | **Day-time lighting pipeline** | Baked/lightmapped AO or irradiance volumes for the city; stronger sun with shadow cascades; a proper sky model (Preetham/Hosek) with sun disk; sun-glint post pass. | 2–3 weeks | high |

---

## 9. What a WebGL/three.js renderer can realistically reach

**What the 2008 reference is** `[E]`: a 720p/30 fps 2008 console title (Xbox 360 /
PS3 class, ~100–200 k tris per frame), deferred-ish forward shading, one or two
shadow cascades at 1024–2048, baked AO/lighting in the art, normal-mapped
surfaces, bloom + DOF + motion blur + grade, strong hand-authored art direction
(a white/grey city, saturated blue sky with cumulus, warm sun, cool shadows,
red as the only loud hue).

**What this renderer already has** `[M]`: ≈415–437 draw calls / 64–67 k triangles /
36 programs / 52 textures; HDR half-float + 4×MSAA; single fitted soft shadow
cascade with 24 taps; half-res GTAO and shadowed volumetrics; 6-mip bloom +
streak + flare; ACES/AgX + grade; motion blur; FXAA; dynamic resolution; an
**8.36 ms** measured frame on an M1 Pro at 2.3 Mpx. The post chain is bigger than
a 2008 title's and geometry/call counts are an order of magnitude under a 2008
budget. **The renderer is not the ceiling.**

**Realistic ceiling in this repo** `[E]`, given the no-external-asset constraint
(everything procedural):

- **Reachable in ~1 week:** a clean, saturated, contrasty 2008-adjacent look —
  blue sky with cumulus, visible sun, white architecture clipping to white with
  blue shadow sides, 2–3× the current saturation, minimum 3 cm shadows,
  normal-mapped concrete/metal, a near canyon. The metrics in `VISUAL_GAP.md` §2
  are the acceptance tests (`mean ~0.55–0.62`, `sat_mean > 0.30`,
  `deep_shadow > 2 %`, `sky_blue_frac > 35 %`, `edge_energy > 0.028`).
- **Not reachable without content or a different renderer:** DICE's per-building
  hand-authored detail, baked global illumination and unique props; a
  temporally-stable AAA post stack (TAA/SSR/DOF) at 60 fps in WebGL2; bespoke
  animation/character rig. Chasing those is a trap — the reference's "AAA" read
  is dominated by art direction and value structure, not polygon counts.
- **WebGL2 limits that matter:** no compute shaders (rules out GPU-driven
  culling/light lists and cheap full-res AO/SSR), no conservative depth or
  alpha-to-coverage, no shader storage buffers or bindless textures, GPU timer
  queries are extension-gated and often unavailable in browsers, and draw
  submission is single-threaded JS (~437 calls is fine; ~1 200 is a practical
  ceiling before CPU cost shows).

**The 3–5 changes with the best "2008 AAA read" per hour** (all measured or
computed above):

1. **Fix exposure metering** (1.1, ~1–2 h) — single biggest tone change, removes
   the q-tier inconsistency.
2. **Re-colour + de-glare the sky** (1.3 + 1.4, ~4–6 h) — sky is 20–40 % of the
   frame; the measured gap is 1.2 % vs 53 % blue coverage. The 110 m sprite is
   the single largest white object in the scene (12.7 % of frame).
3. **One-key light rig + tighter shadows** (1.2 + 1.8, ~2 h) — measured contrast
   0.720→0.793 and std +19 %; shadows become readable.
4. **Normal/roughness maps from the existing canvas generators** (2.3, ~1–2 d) —
   the measured detail gap (edge energy −55 %) is content, and this is the
   cheapest content that reads as "not programmer art".
5. **Cumulus sky + first-person arms** (2.1 + 2.6, ~3–4 d) — the two strongest
   *reference-specific* silhouette cues after light and colour.

Ordering note from the live probe (`VISUAL_GAP §5`): tone fixes must land before
sun-angle/lighting changes are measurable — auto-exposure currently compensates
for them. After the tone stack, the remaining gap is content, exactly as the
metrics say (tuning moves mean/p25/sat; it does not move edge energy).

---

## 10. Measurement appendix (how the numbers above were produced)

- **Live probe** (headless Microsoft Edge via Playwright, `npx vite --config
  vite.config.js --port 5173`, `q=high&autostart=1&shot=1`): `window.__G` was
  queried for renderer stats, `render.stats()` (incl. `readAdapt()` = the 1×1
  adaptation buffer), shadow camera/map/bias, fog, environment intensity, lights,
  material/texture inventory, resolution at DPR 1 and 2.
- **A/B harness** (same page, camera frozen by replacing `game.showcaseInfo.update`,
  one viewpoint at the start checkpoint): variants `base`, `?vol=0`, `?bloom=0`,
  `?ao=0`, `?atmo=off`, exposure pinned 1 vs 2, fill-cut rig, and a combined
  "look-dev" variant. Metrics computed on the PNGs: linear Rec.709 luminance
  percentiles, saturation (HSV S), "blue sky" fraction (B>R+30, B>120), Sobel
  gradient energy, 16 px block local contrast. These deltas are **relative**
  (the harness is not the repo's metrics pipeline). `[M]`
- **Reference** `[M]`: frames extracted from
  `docs/reference/Прохождение Mirrors Edge …mp4` (1920×810, pillarboxed; crop
  243…1684 used) at fixed timestamps; absolute comparisons use the repo
  pipeline `tools/image-metrics.py` / `docs/visual-gap/metrics.json`
  (`reference_primary` 13 outdoor gameplay frames vs `current_new` 11 fresh
  1920×1080 captures — 10 route checkpoints + 1 sky shot). Caveats: the reference is a YouTube re-encode (H.264
  yuv420p, ~3.6 Mbit/s → some chroma loss; the game's own bloom/DOF are baked
  in), the content is different, and the primary set excludes the interior,
  combat-tutorial, cutscene and loading frames (24 extracted → 13 outdoor
  gameplay, classification in `metrics.json`).
- **Analytic** `[A]`: shadow-frustum fit (replicated the light-space AABB math
  from `Gy()`), the sky shader + exposure + ACES/AgX + grade display values
  (replicated `render/index.js:479-584` in Python; the model reproduces the
  measured sky rows to ~±20/255 on R and G, so treat B-channel predictions as
  ±0.1), the ambient/sun ratio, and angular sizes (sprite 110 m quad at measured
  camera distances).
- **Uncertainty**: measured screenshot metrics are scene/pose dependent — the
  A/B numbers are from one start view, so treat them as lower bounds on what a
  look-dev pass will find across the route. The reference sky targets are from
  3 frames; the two views with the clearest sky are used for the sky rows.

---

## 11. File:line index (where to change things)

| Concern | File:line |
|---|---|
| Tune defaults / construction-time uniforms | `src/engine/render/index.js:616` (`g = {...}`, `E`, `z`, `U`, `C`, `Q`, `K`) |
| Per-frame tune consumption + passes | `src/engine/render/index.js:616` (`P()` / `run()`) |
| Adapt pass | `src/engine/render/index.js:434-459` (GLSL), `:616` (`P()` adapt block, `tLum`) |
| Grade / tonemap / lookPower | `src/engine/render/index.js:479-584`; look defines `:616` |
| Bloom chain | `src/engine/render/index.js:393-420`; thresholds `:616` |
| Volumetrics | `src/engine/render/index.js:271-326`; uniforms `:616` |
| AO + composite | `src/engine/render/index.js:239-270`, `340-371` |
| Soft-shadow injection / frustum fit | `src/engine/render/index.js:168-220`, fit call `:616` |
| Sky dome (active) / PMREM env | `src/levels/sky.js:13-78` |
| Engine cloud sky (hidden) | `src/engine/render/index.js:78-166`; hidden at `src/levels/build.js:559-561` |
| Sun sprite | `src/levels/build.js:564-591` |
| Scene fog | `src/levels/build.js:555`; `src/levels/atmosphere.js:22,58` |
| Air / grade tuning | `src/levels/atmosphere.js:9-23` |
| Light rig | `src/levels/lighting.js:8-20,42-52,72-73,85-109` |
| Sun direction | `src/levels/sun.js:7` → `src/levels/build.js:556`, `src/game/main.js:106` |
| Quality tiers | `src/game/main.js:20-37` |
| Shadow map size / bias | `src/game/main.js` + `src/levels/lighting.js:18,72-73` |
| Material factory / roughness | `src/levels/build.js:31-37,63-70,103-127`; `src/game/glassline/index.js:22-29` (legacy prototype) |
| Canvas textures | `src/levels/textures.js:17-19,85-107,109-354` |
| City materials / unlit facades | `src/levels/city.js:7-15,298-321,341-342,413-437,736-752` |
| Camera | `src/game/glassline/player.js:15,27-30,700-760`; `src/game/main.js:116` |
| Resolution / pixel budget / DPR | `src/engine/render/index.js:616` (`resize()`) |
| Dynamic resolution | `src/engine/render/index.js:616` (`S`, `z()` in `frame()`) |
| HUD (opaque plates over a pale frame) | `src/game/glassline/tutorial.js:29-53`; `src/ui/styles.css:64-160` |
| Measurements / capture tooling | `tools/capture-visual.mjs`, `tools/image-metrics.py`, `tools/lookdev-probe.mjs`, `docs/visual-gap/metrics.json` |
