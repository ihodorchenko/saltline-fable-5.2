# 02 — Image metrics: reference walkthrough vs GLASSLINE

Quantitative comparison of the local Mirror's Edge (2008) tutorial walkthrough
against the current GLASSLINE browser build. It is the measurement companion to
[`01-renderer-audit.md`](01-renderer-audit.md) (render/atmosphere levers) and
[`03-content-audit.md`](03-content-audit.md) (geometry/prop inventory): this file
only says *what the two image sets measure*, not why the code produces it.

* Raw numbers: [`metrics.json`](metrics.json) — every figure below is read from it.
* Script: [`../../tools/image-metrics.py`](../../tools/image-metrics.py) — deterministic, rerunnable.
* Side-by-side evidence: [`shots/compare-01.png`](shots/compare-01.png),
  [`shots/compare-02.png`](shots/compare-02.png), [`shots/compare-03.png`](shots/compare-03.png).

> The comparison sheets embed frames from a third-party reference video for
> internal QA only. Do not commit, publish or redistribute them.

**Primary comparison.** 13 clean outdoor gameplay reference frames (1441×810
after de-pillarboxing, natively unresampled) vs 11 fresh 1920×1080 GLASSLINE
captures (`docs/visual-gap/shots/current-*.png`), both normalised to a 810 px
canonical height. 37 metrics, mean ± sd across images. "Δ" is current −
reference, "d" is Cohen's d on the pooled sd, "separation" means the two
per-image distributions do not overlap at all.

## TL;DR — the measured gap in five lines

1. **The build is brighter but flatter, not darker.** Mean luma 0.589 → 0.736
   (+0.147) while luma sd drops 0.272 → 0.166 (−39 %). The frame gains light
   and loses tonal range: high-key, low-contrast.
2. **Tone curve is lifted at the bottom and rolled off at the top.** p5
   0.183 → 0.337, p25 0.370 → 0.698, p1 0.112 → 0.205; at the other end p95
   0.979 → 0.904 and p99 0.998 → 0.937, which is a **full distribution
   separation** (every reference frame ≥ 0.987, every current shot ≤ 0.950).
   Near-white area 27.3 % → 6.0 %, deep-shadow area 3.0 % → 0.18 %.
3. **Desaturation is the biggest colour gap.** Mean HSV saturation 0.359 →
   0.102 (−72 %), p90 saturation 0.745 → 0.279 (−63 %), Hasler-Süsstrunk
   colorfulness 71.1 → 22.5 (−68 %). All 13 reference frames are more saturated
   than all 11 current shots (full separation).
4. **The sky is white haze, not blue.** Reference sky band is blue-dominant
   (mean R/G/B 0.478/0.532/0.672, saturation 0.398, mean blue-sky fraction 0.531); the build's is near-neutral and bright (0.770/0.783/0.775,
   saturation 0.075, mean blue-sky fraction 0.012). Blue-sky fraction 0.531 → 0.012 (−98 %),
   full separation (reference min 0.117 > current max 0.048).
5. **Detail and far-field contrast collapse.** 16×16 mean local contrast 0.0713
   → 0.0376 (−47 %), Sobel edge energy 0.0341 → 0.0154 (−55 %), top-third
   (far-field) local contrast 0.0585 → 0.0188 (−68 %) against −39 % in the
   bottom third: the distant city flattens into the haze faster than the near
   field loses detail.

Robustness: 32 of 37 metrics keep sign and magnitude across
five sampling variants (previous capture pass, ref extended with interiors +
combat tutorial, pooled sets); 7 metrics are fully separated
(`luma_std`, `luma_p99`, `sat_mean`, `sat_p90`, `edge_energy`, `sky_sat_mean`, `sky_blue_frac`). The non-robust and content-driven ones are listed
in §7.

## 1. Method

### 1.1 Reference input

| Property | Value |
|---|---|
| File | `Прохождение Mirrors Edge - Часть 1 - Обучение (изучить основные навыки) [XxzhPEjGHw0].mp4` |
| Container / codec / pixel format | `mov` / `h264` / `yuv420p` |
| Stored resolution | 1920×810 container; the actual 16:9 picture is pillarboxed inside it (see crop row) |
| Frame rate / duration / frames | 60 fps / 516.95 s / 31017 frames |
| File size / video bit rate | 245157288 bytes / 3655.3 kbit/s |
| Detected picture crop (l, t, r, b) | (243, 0, 1684, 810) → 1441×810 (aspect 1.779) |
| Extraction | `ffmpeg -ss <t> -i <video> -frames:v 1`, first frame with PTS ≥ t, one fixed crop box for all frames |

The 1920×810 canvas is not a real aspect ratio; column-mean analysis found a
uniform black pillar from x=0–242 and x=1684–1919 and a 16:9 picture between
them. Cropping to the shared box makes the reference and the 16:9 current
captures directly comparable in framing fractions.

24 timestamps were extracted and each frame was visually classified before any
statistic was computed:

| t (s) | class | note |
|---|---|---|
| 85 | `gameplay_outdoor` | Rooftop vista over the city; first jump prompt. |
| 100 | `gameplay_outdoor` | Rooftop vista; tutorial subtitle bar visible. |
| 115 | `gameplay_outdoor` | Rooftop walkway / blue buildings; subtitle bar. |
| 130 | `gameplay_outdoor` | Rooftop with red+blue props; subtitle bar. |
| 145 | `cutscene` | Dialogue close-up (Celeste) - excluded from gameplay sets. |
| 160 | `gameplay_interior` | Interior engine room, blue/dark, subtitle bar. |
| 175 | `cutscene` | First-person hand vignette - excluded from gameplay sets. |
| 190 | `gameplay_interior` | Interior stair hall, yellow railing. |
| 205 | `gameplay_interior` | Interior blue hall with orange platform. |
| 220 | `gameplay_outdoor` | Fence and sky, high exposure. |
| 235 | `gameplay_outdoor` | Building facade with red awning; blue sky. |
| 250 | `gameplay_outdoor` | Rooftop machinery, hard cast shadows. |
| 265 | `gameplay_outdoor` | Rooftop looking down at the city. |
| 280 | `gameplay_outdoor` | Rooftop red panels, first-person. |
| 300 | `gameplay_outdoor` | Rooftop planks, wide sky; subtitle bar. |
| 320 | `gameplay_outdoor` | Orange structural frame, close-up. |
| 340 | `combat_tutorial` | Combat tutorial: NPC punch demo - flagged. |
| 360 | `combat_tutorial` | Combat tutorial: NPC standing on stage - flagged. |
| 380 | `cutscene` | Dialogue close-up with subtitle bar - excluded. |
| 400 | `combat_tutorial` | Combat tutorial: first-person punch - flagged. |
| 420 | `cutscene` | Dialogue close-up - excluded. |
| 440 | `loading` | Loading screen ('ЗАГРУЗКА') - excluded. |
| 460 | `gameplay_outdoor` | City vista from height, blue sky. |
| 480 | `gameplay_outdoor` | Rooftop / building edge, glass panel, sky. |

Classes: `gameplay_outdoor` (13) → **primary reference set**,
`gameplay_interior` (3) → reference has interiors, the current capture pass has
no interior shot, so interiors are only in the "ref extended" sensitivity set,
`combat_tutorial` (3) → flagged, in the extended set only, `cutscene` (4) and
`loading` (1) → excluded from every gameplay aggregate (`reference_all` contains
all 24 and is used only as a stress test).

### 1.2 Current input

| Set | n | Source resolutions | Role |
|---|---|---|---|
| `current_new` | 11 | 1920×1080 → 1440×810 | **primary current set** — fresh capture pass, no persistent HUD (act title cards visible in two shots) |
| `current_old_per_image` | 42 | 1280×720, 1600×900 → 1440×810 | previous capture pass, per-image weighting (one scene is repeated many times) |
| `current_old_scene` | 13 scene clusters (42 images) | same | previous pass, one equal-weight sample per near-duplicate cluster |
| `current_all` | 53 | mixed | pooled sensitivity set |

3 discovered current images were excluded as non-gameplay: the title
menu, the level editor/inspector overlay, and one 800×600 perf-HUD capture (the
only image that would have needed upscaling to the canonical height). The old
pass's 42 gameplay images collapse into 13 scene
clusters at a thumbnail mean-absolute-error threshold of
0.02 (cluster sizes:
19, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1); the 19-image cluster is one city
bird's-eye scene rendered with different tone-map experiments, which is why the
old pass is not used per-image in any headline number.

### 1.3 Normalisation and exact metric definitions

* **Geometry.** Bars removed (see crop table); every image resampled with
  Lanczos to a canonical **height of 810 px**, aspect preserved. The reference is
  native 810 px and is *not* resampled; fresh 1080p shots become 1440×810; the
  old pass is 1440×810 (900p) or upscaled from 720p (old/sensitivity only).
* **Colour space.** All metrics are computed on **sRGB-encoded channel values in
  [0,1] as loaded — no linearisation and no gamut transform**. Luma is Rec.709
  (`Y = 0.2126 R + 0.7152 G + 0.0722 B` on those encoded values). HSV is
  computed from the encoded RGB (H in degrees, S/V in [0,1]); percentiles use
  numpy linear interpolation; block/Sobel statistics use float64.
* **16×16 blocks** are non-overlapping, aligned to the top-left, remainder
  cropped; block value is the population sd inside the block.

| Metric | Definition |
|---|---|
| `luma_mean`, `luma_std` | mean / population sd of Rec.709 luma |
| `luma_p1` … `luma_p99` | luma percentiles |
| `frac_near_white` | fraction of pixels with luma > 0.90 |
| `frac_deep_shadow` | fraction of pixels with luma < 0.12 |
| `frac_near_white_upper75` / `frac_deep_shadow_upper75` | same two metrics on rows 0–75 % only — the burned-in tutorial subtitles sit below row 80 %, so these values cannot contain subtitle pixels (UI-exclusion check) |
| `sat_mean`, `sat_p90` | mean / 90th percentile of HSV saturation |
| `colorfulness` | Hasler–Süsstrunk: `sqrt(σ_rg² + σ_yb²) + 0.3·sqrt(μ_rg² + μ_yb²)`, rg=R−G, yb=0.5(R+G)−B, on 8-bit sRGB |
| `local_contrast_mean` | mean population sd of luma over 16×16 blocks |
| `edge_energy` | mean Sobel gradient magnitude of luma, normalised by 4√2 (max Sobel response on [0,1] luma) and clipped to [0,1] |
| `contrast_top_third`, `contrast_bottom_third` | `local_contrast_mean` on the top / bottom third of rows |
| `contrast_top_over_bottom` | ratio of the two |
| `sky_*` | top 40 % of rows: mean R/G/B, mean luma, luma sd, mean saturation, and `sky_blue_frac` = fraction with hue 190–250° and saturation > 0.35 |
| `splittone_bright_rb`, `splittone_dark_rb` | mean (R−B) in 8-bit levels over pixels with luma ≥ per-image p80 / ≤ per-image p20 |
| `splittone_delta` | bright minus dark R−B (warm-highlight / cool-shadow split) |
| `red_accent_frac` | fraction with hue 335–360° ∪ 0–25°, saturation > 0.45, value > 0.15 |
| `rgb_mean_r/g/b`, `rb_mean`, `gb_mean` | global channel means and mean channel differences in 8-bit levels |

### 1.4 Statistics and robustness rule

* Per-set aggregate = mean and sample sd (ddof=1) of the per-image metrics
  across the images of that set; n is the number of independent images
  (13 reference vs 11 current).
* `d = (mean_cur − mean_ref) / sqrt((sd_ref² + sd_cur²)/2)` (Cohen's d, pooled sd).
* **Separation** is computed from the per-image min/max: "full (R > C)" means the
  lowest reference value is above the highest current value, i.e. every
  reference frame exceeds every current shot.
* **Robustness** is not a p-value. A metric is flagged robust when its Δ keeps
  the same sign *and* min|Δ| ≥ 0.4 · max|Δ| across five game-only sampling
  variants: primary, old pass per scene, old pass per image, all current shots
  pooled, and reference extended with interiors + combat tutorial. The "ref
  all" comparison (includes cutscenes and the loading screen) is reported for
  completeness but is deliberately excluded from the verdict.
* The design is unpaired: there is no same-camera-position pair between the two
  games. Aggregates describe the *look distributions*, not a pixel-aligned
  difference, and n is small (13 / 11).
  Because the current set is visually homogeneous (one build, one time of day)
  its sd is small, so Cohen's d is inflated for any mean shift. Raw Δ and
  relative gap are listed next to d so the effect can be read without that
  denominator.

### 1.5 Determinism

`tools/image-metrics.py` runs in ~45 s: it extracts/reuses the 24 reference
frames in `/tmp/glassline-image-metrics/frames`, computes all metrics, rewrites
`metrics.json` and the three comparison sheets. Timestamps, ffmpeg/ffprobe
invocations, file orders, resize filter and thresholds are fixed; there are no
wall-clock fields. Two consecutive runs produce byte-identical JSON and PNG
sheets. Every source file's sha256 is recorded in `metrics.json`, so a stale
run can be detected. The script records the exact metric definitions and the
frame classification in the JSON metadata.

## 2. Caveats — what these numbers can and cannot say

1. **Lossy video vs lossless PNG.** The reference is a YouTube upload
   (H.264 4:2:0, 3655.3 kbit/s); the current images are
   lossless PNGs.
   4:2:0 chroma subsampling smooths colour detail, which can only *reduce*
   reference saturation/colorfulness (so the measured desaturation gap is
   conservative). Compression also adds 8/16-px blocking and ringing, which can
   *inflate* reference block-std and Sobel energy — so the measured
   detail/edge gaps are directionally credible but not precise magnitudes.
   Any *reference-lower* detail value would be suspect; there are none of
   practical size.
2. **Burned-in tutorial UI.** Reference frames contain light subtitle boxes
   (in the bottom ~20 % of the frame) and a crosshair; the fresh GLASSLINE
   captures have no persistent HUD (only act title cards in two shots). The UI-exclusion check shows the near-white gap is not
   a UI artefact: `frac_near_white` 0.273 → 0.060 but `frac_near_white_upper75`
   (rows 0–75 %, no UI possible) 0.251 → 0.074; `frac_deep_shadow` 0.030 →
   0.002, upper75 0.032 → 0.001.
3. **Different content, deliberate art direction.** The reference is a
   photorealistic 2008 city with sky, clouds and hundreds of distinct props;
   GLASSLINE is a deliberately pale, minimal blockout (see `docs/DESIGN.md:42-45`
   "Surfaces use near-white tops and desaturated blue-grey sides": the near-white/desaturated palette is stated art direction). Saturation, colorfulness
   and detail metrics therefore measure *how different* the palette and content
   are, not that either is "wrong". The defensible reading is about direction
   and size, and §4 separates what is likely intended from what reads as an
   unintended tone/atmosphere loss.
4. **Unpaired composition.** Reference frames look at different locations of a
   tutorial than the current captures. The sky band is especially
   composition-sensitive (it contains buildings in some frames of both sets).
   This is why separation flags, the sensitivity matrix and the robustness rule
   exist; individual sd values are content variance, not measurement noise.
5. **Video range.** FFmpeg decoded the reference to full range: the pillar bars
   decode to exactly 0.0 and luma p99 averages 0.998 (a frame maximum of 1.000),
   so there is no hidden limited-range black lift inflating the reference shadow
   values.
6. **Frame choice is annotated, not hidden.** Cutscenes (t = 145, 175, 380,
   420 s) and the loading screen (t = 440 s) are excluded from gameplay
   aggregates; the combat tutorial (t = 340, 360, 400 s) and interiors are
   included only in the extended sensitivity set, and doing so does not change
   the sign of any headline gap (§5).
7. **The sheets are evidence illustrations, not data.** They are for human
   inspection; the metrics behind them are in `metrics.json`.

## 3. Primary comparison table

Reference = 13 clean outdoor gameplay frames; current = 11 fresh gameplay
captures. Full-precision values are in `metrics.json`.

### 3.1 Tonal distribution

| Metric | Reference (n=13) | Current (n=11) | Δ cur−ref | Cohen's d | Separation |
|---|---|---|---|---|---|
| `luma_mean` | 0.589 ± 0.128 | 0.736 ± 0.035 | +0.147 | +1.56 | overlap |
| `luma_std` | 0.272 ± 0.050 | 0.166 ± 0.017 | -0.106 | -2.87 | **full** (R > C) |
| `luma_p1` | 0.112 ± 0.051 | 0.205 ± 0.047 | +0.093 | +1.89 | overlap |
| `luma_p5` | 0.183 ± 0.075 | 0.337 ± 0.026 | +0.154 | +2.75 | overlap |
| `luma_p25` | 0.370 ± 0.154 | 0.698 ± 0.047 | +0.329 | +2.88 | overlap |
| `luma_p50` | 0.595 ± 0.220 | 0.774 ± 0.049 | +0.178 | +1.12 | overlap |
| `luma_p75` | 0.806 ± 0.197 | 0.846 ± 0.032 | +0.040 | +0.28 | overlap |
| `luma_p95` | 0.979 ± 0.041 | 0.904 ± 0.008 | -0.075 | -2.56 | overlap |
| `luma_p99` | 0.998 ± 0.004 | 0.937 ± 0.013 | -0.062 | -6.47 | **full** (R > C) |
| `frac_near_white` | 0.273 ± 0.194 | 0.060 ± 0.024 | -0.213 | -1.54 | overlap |
| `frac_near_white_upper75` | 0.250 ± 0.203 | 0.074 ± 0.031 | -0.176 | -1.21 | overlap |
| `frac_deep_shadow` | 0.030 ± 0.030 | 0.002 ± 0.001 | -0.028 | -1.34 | overlap |
| `frac_deep_shadow_upper75` | 0.032 ± 0.038 | 0.001 ± 0.001 | -0.031 | -1.16 | overlap |

### 3.2 Colour

| Metric | Reference (n=13) | Current (n=11) | Δ cur−ref | Cohen's d | Separation |
|---|---|---|---|---|---|
| `sat_mean` | 0.359 ± 0.134 | 0.102 ± 0.013 | -0.257 | -2.69 | **full** (R > C) |
| `sat_p90` | 0.745 ± 0.121 | 0.279 ± 0.087 | -0.466 | -4.42 | **full** (R > C) |
| `colorfulness` | 71.1 ± 28.0 | 22.5 ± 6.1 | -48.6 | -2.40 | overlap |
| `rgb_mean_r` | 0.566 ± 0.170 | 0.725 ± 0.043 | +0.159 | +1.28 | overlap |
| `rgb_mean_g` | 0.585 ± 0.128 | 0.739 ± 0.034 | +0.154 | +1.65 | overlap |
| `rgb_mean_b` | 0.688 ± 0.123 | 0.730 ± 0.029 | +0.042 | +0.47 | overlap |
| `rb_mean` | -31.1 ± 49.7 | -1.5 ± 6.9 | +29.6 | +0.84 | overlap |
| `gb_mean` | -26.2 ± 31.2 | 2.3 ± 2.1 | +28.5 | +1.29 | overlap |
| `splittone_bright_rb` | -4.6 ± 16.0 | 13.3 ± 4.2 | +17.9 | +1.53 | overlap |
| `splittone_dark_rb` | -48.6 ± 59.4 | -17.1 ± 21.1 | +31.5 | +0.71 | overlap |
| `splittone_delta` | 44.0 ± 51.9 | 30.4 ± 21.3 | -13.6 | -0.34 | overlap |

### 3.3 Detail and local contrast

| Metric | Reference (n=13) | Current (n=11) | Δ cur−ref | Cohen's d | Separation |
|---|---|---|---|---|---|
| `local_contrast_mean` | 0.0713 ± 0.0149 | 0.0376 ± 0.0076 | -0.0338 | -2.85 | overlap |
| `edge_energy` | 0.0341 ± 0.0094 | 0.0154 ± 0.0025 | -0.0187 | -2.73 | **full** (R > C) |
| `contrast_top_third` | 0.0585 ± 0.0216 | 0.0188 ± 0.0068 | -0.0397 | -2.48 | overlap |
| `contrast_bottom_third` | 0.0770 ± 0.0217 | 0.0470 ± 0.0173 | -0.0299 | -1.53 | overlap |
| `contrast_top_over_bottom` | 0.84 ± 0.39 | 0.44 ± 0.22 | -0.39 | -1.23 | overlap |

### 3.4 Sky band (top 40 % of rows)

| Metric | Reference (n=13) | Current (n=11) | Δ cur−ref | Cohen's d | Separation |
|---|---|---|---|---|---|
| `sky_mean_r` | 0.478 ± 0.207 | 0.770 ± 0.048 | +0.292 | +1.94 | overlap |
| `sky_mean_g` | 0.532 ± 0.195 | 0.783 ± 0.044 | +0.251 | +1.78 | overlap |
| `sky_mean_b` | 0.672 ± 0.175 | 0.775 ± 0.043 | +0.102 | +0.80 | overlap |
| `sky_luma_mean` | 0.531 ± 0.191 | 0.780 ± 0.044 | +0.249 | +1.79 | overlap |
| `sky_luma_std` | 0.217 ± 0.059 | 0.102 ± 0.022 | -0.115 | -2.58 | overlap |
| `sky_sat_mean` | 0.398 ± 0.156 | 0.074 ± 0.010 | -0.323 | -2.92 | **full** (R > C) |
| `sky_blue_frac` | 0.531 ± 0.286 | 0.012 ± 0.013 | -0.520 | -2.57 | **full** (R > C) |

### 3.5 Red accent

| Metric | Reference (n=13) | Current (n=11) | Δ cur−ref | Cohen's d | Separation |
|---|---|---|---|---|---|
| `red_accent_frac` | 0.042 ± 0.065 | 0.010 ± 0.023 | -0.032 | -0.65 | overlap |

## 4. Per-metric interpretation — what each number implies visually

### 4.1 Tone and dynamic range

| Metric | Reference → current | What it implies visually |
|---|---|---|
| `luma_mean` | 0.589 → 0.736 (+0.147) | The build is overall brighter. The impression is not "too dark" but "high-key": the average pixel sits in the upper midtones. |
| `luma_std` | 0.272 → 0.166 (−39 %) | The luma histogram is compressed. Fewer pixels at both extremes, most pixels bunched in a bright band — this is the single best numeric description of "washed out / flat". |
| `luma_p1`, `luma_p5` | 0.112 → 0.205, 0.183 → 0.337 | Blacks are lifted by 9–15 percentage points of luma. There is no anchored darkness; deep recesses, undersides and cast-shadow cores become grey instead of black, so form shading loses its darkest step. |
| `luma_p25` | 0.370 → 0.698 | A quarter of the reference image is darker than 0.37; in the build a quarter of the image is darker than only 0.70. Most of the lower half of the histogram is absent. |
| `luma_p50` | 0.595 → 0.774 | Median brightness is high-key; the frame reads as lit by large ambient/sky fill rather than directional sun plus shadow. |
| `luma_p75` | 0.806 → 0.846 (Δ small, overlapping, **not robust**) | The upper midtones are already close; the difference is concentrated at the dark end, not a global exposure shift. |
| `luma_p95`, `luma_p99` | 0.979 → 0.904, 0.998 → 0.937 (p99: full separation) | Highlights are rolled off: the reference keeps true white (p99 ≈ 1.0, every frame ≥ 0.987) while the build tops out at 0.937 (every shot ≤ 0.950). Sun glare, specular hits and white plaster never reach white — they look chalky, and the frame lacks a white point to anchor the contrast range. |
| `frac_near_white` | 0.273 → 0.060 (−21.3 pp, 4.5× fewer) | Mirror's Edge's white architecture and sky highlights clip into near-white on ~27 % of pixels; in the build only 0.060 of pixels exceed 0.90 (p95 = 0.904), so its whites stop just short of clipping. "White city in sunlight" becomes "light-grey city in haze". |
| `frac_near_white_upper75` | 0.251 → 0.074 | Same gap with the bottom 25 % of rows removed, so the burned-in subtitle boxes are not the cause. |
| `frac_deep_shadow` | 0.030 → 0.002 (17× fewer) | Shadow cores almost disappear from the frame. Depth cues that come from dark occlusion (under ledges, between props, inside stairwells) are gone. |
| `frac_deep_shadow_upper75` | 0.032 → 0.001 | Confirms the shadow loss is scene tone, not UI. |

### 4.2 Colour

| Metric | Reference → current | What it implies visually |
|---|---|---|
| `sat_mean` | 0.359 → 0.102 (−72 %, **full separation**) | The palette is about 3.5× less saturated (0.359 / 0.102); every reference frame is more saturated than every current shot (reference minimum 0.145 > current maximum 0.123). The world reads as pastel/grey-blue, with red as the only strong hue. |
| `sat_p90` | 0.745 → 0.279 (−63 %, **full separation**) | Even the most saturated 10 % of reference pixels are far more saturated than the build's. This is not just the sky: the reference's 90th-percentile saturation is higher in every frame (minimum 0.532) than in any current shot (maximum 0.396), so material accents, signage, props and blue facades all sit above the build's whole p90 distribution. |
| `colorfulness` | 71.1 → 22.5 (−68 %) | Overall chroma variance is a third of the reference. The image reads close to monochrome with one red override. |
| `rgb_mean_r/g/b` | 0.566/0.585/0.688 → 0.725/0.739/0.730 | The reference is blue-dominant (B is 0.12 above R); the build is bright and nearly neutral (B ≈ R ≈ G). The build's "mint" impression is a low-saturation G≈B lift on a white base, not a strong colour cast. |
| `rb_mean` | −31.1 → −1.5 levels | Same statement in channel-difference units: reference frames average 31 levels more blue than red; the build is neutral. |
| `gb_mean` | −26.2 → +2.3 levels | The reference's cool daylight (B > G) is replaced by a neutral, very slightly green-biased build. |
| `splittone_bright_rb` | −4.6 → +13.3 levels | Reference highlights are neutral/slightly cool; build highlights are warm (sun tint). This is the "creamy sun-white" look. |
| `splittone_dark_rb` | −48.6 → −17.1 levels | Reference shadows are strongly blue; the build's are only mildly blue. The classic warm-sun / cool-shadow split is diluted in the build. |
| `splittone_delta` | 44.0 → 30.4 levels (−31 %, not fully robust) | Total warm-highlight-to-cool-shadow separation is weaker. Content-sensitive, but the direction is consistent across all sampling variants. |

### 4.3 Detail and local contrast

| Metric | Reference → current | What it implies visually |
|---|---|---|
| `local_contrast_mean` | 0.0713 → 0.0376 (−47 %) | Within-16-px detail is halved: surface texture, joints, weathering, window bands and small props stop producing tonal variation. Surfaces read smooth and plastic; the eye gets fewer micro depth cues. (Compression may inflate the reference slightly — direction is credible, exact magnitude is not.) |
| `edge_energy` | 0.0341 → 0.0154 (−55 %, **full separation**) | Half the strong gradients are absent: fewer cables, fences, railings, trim, AC units, signage. The city reads as clean volumes instead of a dense, layered architecture. |
| `contrast_top_third` | 0.0585 → 0.0188 (−68 %) | The far field (top third) loses far more contrast than the near field. Distant buildings dissolve into flat haze; background layering — a core part of the reference's canyon-like city look — is weak. |
| `contrast_bottom_third` | 0.0770 → 0.0470 (−39 %) | Near-field geometry keeps more contrast, but still noticeably less than the reference; the foreground is simple blocks with few details. |
| `contrast_top_over_bottom` | 0.836 → 0.444 (−47 %, **not robust**) | The far/near ratio looks like a strong atmosphere gap, but it is composition-sensitive: Δ here is −0.392 while the old pass Δ is only −0.084 (§5), because that pass's bird's-eye shots fill the top of the frame with detailed city. Quote the absolute third values, not this ratio, as evidence. |

### 4.4 Sky band

| Metric | Reference → current | What it implies visually |
|---|---|---|
| `sky_mean_r/g/b` | 0.478/0.532/0.672 → 0.770/0.783/0.775 | Reference sky is saturated blue (B 0.19 above R); build sky is bright near-neutral white (all three channels ≈ 0.77). |
| `sky_luma_mean` | 0.530 → 0.780 (+0.249) | The build's sky is 47 % brighter — it behaves like a white light source. |
| `sky_luma_std` | 0.217 → 0.102 (−53 %) | Half the tonal structure in the sky band (clouds, gradient, silhouette contrast) is gone; the sky becomes a flat white backdrop. |
| `sky_sat_mean` | 0.398 → 0.075 (−81 %, **full separation**) | Sky saturation is a fifth of the reference. Combined with the brightness above, the visible sky is haze-white rather than blue. |
| `sky_blue_frac` | 0.531 → 0.012 (−98 %, **full separation**) | Half of the reference sky band qualifies as blue sky (hue 190–250°, sat > 0.35); the build has almost none — in fact **no current shot reaches the lowest reference frame** (reference min 0.117 > current max 0.048). This is the most visually explicit gap in the whole data set and matches the reference's defining blue-dome look. |

### 4.5 Red accent

| Metric | Reference → current | What it implies visually |
|---|---|---|
| `red_accent_frac` | 0.042 → 0.011 (−75 %, overlapping) | On average the reference devotes four times more area to saturated red (props, awnings, character clothing, tutorial highlights) than the build's red route line, rails and finish gate. But the reference range is 0.001–0.179 and the build range 0.000–0.076, so some frames of both sets agree: **content-driven, not a reliable look gap**. What is robust is the *role* of red — in the build it is confined to route language; in the reference it is distributed across the scene. |

## 5. Sensitivity — does the gap survive resampling choices?

Δ (current − reference) for the same metric under six different set definitions.
Sign and magnitude are stable for the headline metrics; only
`contrast_top_over_bottom` (see §4.3) moves materially, because the old
capture pass included bird's-eye city views whose top third is full of detail.

| Metric | primary | old, per scene | old, per image | all current | ref extended | ref all* |
|---|---|---|---|---|---|---|
| `luma_std` | -0.106 | -0.149 | -0.155 | -0.145 | -0.117 | -0.156 |
| `luma_p99` | -0.062 | -0.102 | -0.088 | -0.082 | -0.060 | -0.078 |
| `luma_p25` | +0.329 | +0.287 | +0.334 | +0.333 | +0.357 | +0.353 |
| `luma_p1` | +0.093 | +0.238 | +0.268 | +0.232 | +0.108 | +0.251 |
| `luma_p75` | +0.040 | -0.016 | +0.023 | +0.027 | +0.015 | +0.005 |
| `frac_near_white` | -0.213 | -0.227 | -0.229 | -0.225 | -0.211 | -0.222 |
| `frac_deep_shadow` | -0.028 | -0.029 | -0.029 | -0.029 | -0.036 | -0.046 |
| `sat_mean` | -0.257 | -0.256 | -0.270 | -0.267 | -0.268 | -0.280 |
| `sat_p90` | -0.466 | -0.541 | -0.562 | -0.542 | -0.508 | -0.571 |
| `colorfulness` | -48.6 | -50.5 | -51.9 | -51.2 | -52.2 | -56.8 |
| `local_contrast_mean` | -0.0338 | -0.0387 | -0.0376 | -0.0368 | -0.0300 | -0.0307 |
| `edge_energy` | -0.0187 | -0.0187 | -0.0181 | -0.0182 | -0.0164 | -0.0148 |
| `contrast_top_third` | -0.0397 | -0.0325 | -0.0327 | -0.0341 | -0.0370 | -0.0282 |
| `sky_luma_mean` | +0.249 | +0.191 | +0.228 | +0.233 | +0.275 | +0.247 |
| `sky_sat_mean` | -0.323 | -0.305 | -0.321 | -0.321 | -0.373 | -0.373 |
| `sky_blue_frac` | -0.520 | -0.512 | -0.522 | -0.521 | -0.465 | -0.414 |
| `splittone_bright_rb` | +17.9 | +17.2 | +16.4 | +16.7 | +15.7 | +12.7 |
| `red_accent_frac` | -0.032 | -0.038 | -0.040 | -0.039 | -0.049 | -0.085 |
| `rgb_mean_b` | +0.042 | +0.012 | +0.050 | +0.048 | +0.066 | +0.092 |
| `sky_mean_b` | +0.102 | +0.042 | +0.074 | +0.080 | +0.176 | +0.166 |

\* "ref all" includes 4 cutscenes and the loading screen and is a stress test
only. Even there no headline sign flips.

The previous capture pass shows the same look as the fresh one: mean saturation 0.103 per scene vs 0.102 fresh (reference 0.359); blue-sky fraction 0.019 vs 0.012 fresh (reference 0.531); luma sd 0.123 vs 0.166 fresh (reference 0.272). The measured gap is therefore a property of the current art/tone state, not of one capture run.

## 6. Ranked biggest measurable gaps

Ranked by |Cohen's d| (standardised mean difference, pooled sd). d answers "how
far apart are the distributions in units of their own spread"; because the fresh
current set is homogeneous its sd is small and d is large even for modest mean
shifts, so the raw Δ and relative gap are shown too. The top of this list is
dominated by tone-curve and saturation metrics; the most *visually obvious* gaps
(blue sky, palette) sit slightly lower only because the reference content varies
more.

| # | Metric | Ref | Current | Δ | \|d\| | relative gap | robust | separation |
|---|---|---|---|---|---|---|---|---|
| 1 | `luma_p99` | 0.998 | 0.937 | -0.062 | 6.47 | 0.06 | yes | **full** (R > C) |
| 2 | `sat_p90` | 0.745 | 0.279 | -0.466 | 4.42 | 0.63 | yes | **full** (R > C) |
| 3 | `sky_sat_mean` | 0.398 | 0.074 | -0.323 | 2.92 | 0.81 | yes | **full** (R > C) |
| 4 | `luma_p25` | 0.370 | 0.698 | +0.329 | 2.88 | 0.47 | yes | overlap |
| 5 | `luma_std` | 0.272 | 0.166 | -0.106 | 2.87 | 0.39 | yes | **full** (R > C) |
| 6 | `local_contrast_mean` | 0.0713 | 0.0376 | -0.0338 | 2.85 | 0.47 | yes | overlap |
| 7 | `luma_p5` | 0.183 | 0.337 | +0.154 | 2.75 | 0.46 | yes | overlap |
| 8 | `edge_energy` | 0.0341 | 0.0154 | -0.0187 | 2.73 | 0.55 | yes | **full** (R > C) |
| 9 | `sat_mean` | 0.359 | 0.102 | -0.257 | 2.69 | 0.72 | yes | **full** (R > C) |
| 10 | `sky_luma_std` | 0.217 | 0.102 | -0.115 | 2.58 | 0.53 | yes | overlap |
| 11 | `sky_blue_frac` | 0.531 | 0.012 | -0.520 | 2.57 | 0.98 | yes | **full** (R > C) |
| 12 | `luma_p95` | 0.979 | 0.904 | -0.075 | 2.56 | 0.08 | yes | overlap |
| 13 | `contrast_top_third` | 0.0585 | 0.0188 | -0.0397 | 2.48 | 0.68 | yes | overlap |
| 14 | `colorfulness` | 71.1 | 22.5 | -48.6 | 2.40 | 0.68 | yes | overlap |
| 15 | `sky_mean_r` | 0.478 | 0.770 | +0.292 | 1.94 | 0.38 | yes | overlap |

Full separation (every reference frame vs every current shot) is reached by
7 metrics: `luma_std`, `luma_p99`, `sat_mean`, `sat_p90`, `edge_energy`, `sky_sat_mean`, `sky_blue_frac`.

For reference, the same list ordered by **relative gap**
(|Δ| / max(|ref|,|cur|)) starts:
`splittone_bright_rb`, `gb_mean`, `sky_blue_frac`, `frac_deep_shadow_upper75`, `rb_mean`, `frac_deep_shadow`, `sky_sat_mean`, `frac_near_white`, `red_accent_frac`, `sat_mean`. Signed split-tone/R−B metrics rank
artificially high in a relative ranking because their reference means are close
to zero; the |d| ranking is the primary one.

## 7. Confidence — robust gaps vs likely artefacts

**Robust to content/sampling** (32 of 37 metrics; these keep
sign and ≥40 % of magnitude across all five game-only variants):

`luma_mean`, `luma_std`, `luma_p5`, `luma_p25`, `luma_p50`, `luma_p95`, `luma_p99`, `frac_near_white`, `frac_near_white_upper75`, `frac_deep_shadow`, `frac_deep_shadow_upper75`, `sat_mean`, `sat_p90`, `colorfulness`, `local_contrast_mean`, `edge_energy`, `contrast_top_third`, `contrast_bottom_third`, `sky_mean_r`, `sky_mean_g`, `sky_luma_mean`, `sky_luma_std`, `sky_sat_mean`, `sky_blue_frac`, `splittone_bright_rb`, `splittone_dark_rb`, `splittone_delta`, `red_accent_frac`, `rgb_mean_r`, `rgb_mean_g`, `rb_mean`, `gb_mean`

Of these, the ones with a clean interpretation are: the lifted black floor
(p5/p25; p1 has the same sign but is not robust), the rolled highlight ceiling (p95/p99 — full separation), the
compressed tonal range (`luma_std` — full separation), the desaturated palette
(`sat_mean`/`sat_p90` — full separation), the flat far field
(`contrast_top_third`), the low-detail surfaces (`local_contrast_mean`,
`edge_energy` — full separation), the white-haze sky (`sky_luma_mean`,
`sky_sat_mean`, `sky_blue_frac` — full separation), the weaker cool-shadow /
warm-highlight split, and the smaller red accent mean (robust in sign, but content-driven — see below).

**Not robust** (5 metrics) — report these only with the content
caveat:

| Metric | Why it is not robust |
|---|---|
| `luma_p1` | Δ changes by more than the 0.4× magnitude window across sampling variants; see §5 row. |
| `luma_p75` | Δ changes by more than the 0.4× magnitude window across sampling variants; see §5 row. |
| `contrast_top_over_bottom` | Δ changes by more than the 0.4× magnitude window across sampling variants; see §5 row. |
| `sky_mean_b` | Δ changes by more than the 0.4× magnitude window across sampling variants; see §5 row. |
| `rgb_mean_b` | Δ changes by more than the 0.4× magnitude window across sampling variants; see §5 row. |

**Likely artefacts or content-driven, not look differences:**

* `local_contrast_mean` / `edge_energy` — H.264 blocking at 8/16-px can inflate
  the reference; the *direction* (the build has fewer gradients) is consistent with the
  blockout art direction, but do not use the exact percentage as a target.
* `colorfulness` / `sat_mean` / `sat_p90` — 4:2:0 chroma subsampling can only
  lower the reference's chroma, so the measured gap is a lower bound.
* `contrast_top_over_bottom` — composition-sensitive (|Δ| ranges from 0.084 to
  0.392 across the sampling variants, see §5); not a look constant.
* `sky_*` — the top-40 % band contains buildings in some frames; still, the
  blue-sky separation (reference min > current max) and −98 % relative gap are
  too large to be composition alone.
* `red_accent_frac` — mean gap is real but distributions overlap heavily; the
  reference's red is partly drive-by content (character clothing, props) that
  the build intentionally does not copy.
* `splittone_*` / `rb_mean` / `gb_mean` — channel-difference means are
  content-weighted (blue sky vs blue buildings) and partly overlap with the
  sky/global-cast story; use them as the same story told in colour-balance
  units, not as independent evidence.
* `luma_p75`, `luma_p1`, `rgb_mean_b`, `sky_mean_b` — see the non-robust table;
  these are the metrics most sensitive to which scenes are sampled.

**What would make the comparison stronger** (future work, not done here):

1. Scene-matched pairs: capture the current build at camera positions/FOVs chosen
   to match specific reference frames, then compare paired differences instead of
   distributions.
2. A native-resolution reference (original capture or a less-compressed source)
   to remove the compression handicap.
3. A larger current sample across acts and times of day, so the current sd is a
   real look variance rather than one graded state.
4. Reference frames without burned-in subtitles (or a mask restricted to the
   subtitle boxes) to remove the last UI confound entirely — although the
   upper-75 % check already shows it is not driving the headline gaps.

## 8. Reproduce

Requirements: Python 3.10+ with `numpy` and `Pillow` (on this machine the bundled
DSH runtime `~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3`
has them; the system `python3` does not), plus `ffmpeg`/`ffprobe` on `PATH`.

```sh
# full run (extracts frames on first use, ~45 s)
python tools/image-metrics.py

# reuse cached reference frames / skip sheet rendering
python tools/image-metrics.py --skip-extract --no-sheets

# alternative output paths (useful for a before/after comparison)
python tools/image-metrics.py --out-json /tmp/metrics-after.json --no-sheets
```

Deliverables written by the script:

| Path | Content |
|---|---|
| `docs/visual-gap/metrics.json` | per-image metrics, set aggregates, primary comparison, 6-way sensitivity matrix, robustness flags, scene clusters, definitions |
| `docs/visual-gap/shots/compare-01.png` | reference t=115 s vs `current-02-jump` (rooftop walkway) |
| `docs/visual-gap/shots/compare-02.png` | reference t=460 s vs `current-11-sky` (city vista) |
| `docs/visual-gap/shots/compare-03.png` | reference t=235 s vs `current-06-balance` (red accent) |

Scratch frames live in `/tmp/glassline-image-metrics/` and are not deliverables.
One consequence of the deterministic pipeline: `metrics.json` records the sha256
of every input image, so if the capture pass is regenerated the file can be
checked for staleness and the script rerun.
