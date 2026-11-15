#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic visual-metrics extraction for the GLASSLINE visual-gap audit.

Purpose
-------
Quantify the visual difference between the 2008 Mirror's Edge tutorial
walkthrough (local reference video) and the current GLASSLINE browser build,
in a way that is repeatable and not hand-waved.

What the script does
--------------------
1. Extracts reference frames from the local reference video with ``ffmpeg`` at a
   fixed list of timestamps (seconds, first frame with PTS >= t). Frames are
   cached in a scratch directory.
2. Detects uniform black letterbox / pillarbox bars at the image borders and
   crops them. The reference video is 1920x810 with a 16:9 picture centred in it,
   so every reference frame is cropped to its real 16:9 picture area; the crop
   box is computed once for the whole video (intersection over all frames) so
   that every frame is treated identically. Current-build screenshots get the
   same treatment (they normally have no bars).
3. Resamples every image to a canonical height of 810 px with Lanczos
   (aspect ratio preserved). 810 px is the reference picture height, so the
   reference frames are *not* resampled at all; current-build 1920x1080 shots
   become 1440x810. This keeps 16x16 block and Sobel metrics comparable.
4. Computes a documented metric set per image (see ``METRIC_DEFINITIONS``).
5. Writes ``docs/visual-gap/metrics.json``: per-image numbers, per-set
   aggregates (mean / sd / min / max), a primary comparison, a sensitivity
   matrix and ranked gaps.
6. Writes three reference-vs-current side-by-side sheets to
   ``docs/visual-gap/shots/compare-0{1,2,3}.png``.

Determinism
-----------
* fixed timestamps, fixed ffmpeg/ffprobe invocations, fixed resize filter;
* file lists are sorted before processing;
* no wall-clock timestamps, no random seeds, no thread pools;
* every source file's sha256 is recorded so a stale run can be detected.
Running the script twice on unchanged inputs yields byte-identical JSON and PNG
sheets.

Caveats that the metrics themselves cannot remove
-------------------------------------------------
* The reference is a lossy H.264 YouTube upload (4:2:0 chroma, ~3.8 Mbit/s);
  the current images are lossless PNGs. Compression lowers high-frequency
  metrics (local contrast, edge energy, colorfulness) and smears chroma in the
  reference, so *reference-higher* gaps are conservative and
  *current-higher* gaps are inflated by compression.
* The reference frames contain a burned-in tutorial UI (light subtitle boxes,
  one crosshair); the fresh GLASSLINE captures have no HUD. The burned-in
  subtitles sit in the bottom 20% of the frame, so
  ``frac_near_white_upper75`` / ``frac_deep_shadow_upper75`` repeat the
  near-white / deep-shadow metrics on rows 0-75% only, where no burned-in UI can
  exist. If a gap survives that cut it is not a UI artefact.
* Content/composition differ: Mirror's Edge is a photorealistic city with a
  saturated blue sky; GLASSLINE is a deliberately pale blockout. A metric gap is
  not an error by itself; it is evidence about *where* the two images differ.

Usage
-----
    python tools/image-metrics.py                    # full run, writes deliverables
    python tools/image-metrics.py --skip-extract     # reuse cached frames
    python tools/image-metrics.py --no-sheets
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SCRIPT_VERSION = "1.0.0"

# --------------------------------------------------------------------------- #
# Configuration (edit here, not on the command line, when the input changes)
# --------------------------------------------------------------------------- #

DEFAULT_REFERENCE_VIDEO = (
    "docs/reference/Прохождение Mirrors Edge - Часть 1 - Обучение "
    "(изучить основные навыки) [XxzhPEjGHw0].mp4"
)

# Gameplay timestamps requested by the audit brief (seconds into the video).
# A different reference video can be profiled with --video/--timestamps/--classes-json.
DEFAULT_TIMESTAMPS = [
    85, 100, 115, 130, 145, 160, 175, 190, 205, 220, 235, 250,
    265, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480,
]

# Manual visual classification of the extracted reference frames.
# The class drives which subset is used for the primary aggregate.
REFERENCE_FRAME_CLASSES = {
    85: ("gameplay_outdoor", "Rooftop vista over the city; first jump prompt."),
    100: ("gameplay_outdoor", "Rooftop vista; tutorial subtitle bar visible."),
    115: ("gameplay_outdoor", "Rooftop walkway / blue buildings; subtitle bar."),
    130: ("gameplay_outdoor", "Rooftop with red+blue props; subtitle bar."),
    145: ("cutscene", "Dialogue close-up (Celeste) - excluded from gameplay sets."),
    160: ("gameplay_interior", "Interior engine room, blue/dark, subtitle bar."),
    175: ("cutscene", "First-person hand vignette - excluded from gameplay sets."),
    190: ("gameplay_interior", "Interior stair hall, yellow railing."),
    205: ("gameplay_interior", "Interior blue hall with orange platform."),
    220: ("gameplay_outdoor", "Fence and sky, high exposure."),
    235: ("gameplay_outdoor", "Building facade with red awning; blue sky."),
    250: ("gameplay_outdoor", "Rooftop machinery, hard cast shadows."),
    265: ("gameplay_outdoor", "Rooftop looking down at the city."),
    280: ("gameplay_outdoor", "Rooftop red panels, first-person."),
    300: ("gameplay_outdoor", "Rooftop planks, wide sky; subtitle bar."),
    320: ("gameplay_outdoor", "Orange structural frame, close-up."),
    340: ("combat_tutorial", "Combat tutorial: NPC punch demo - flagged."),
    360: ("combat_tutorial", "Combat tutorial: NPC standing on stage - flagged."),
    380: ("cutscene", "Dialogue close-up with subtitle bar - excluded."),
    400: ("combat_tutorial", "Combat tutorial: first-person punch - flagged."),
    420: ("cutscene", "Dialogue close-up - excluded."),
    440: ("loading", "Loading screen ('ЗАГРУЗКА') - excluded."),
    460: ("gameplay_outdoor", "City vista from height, blue sky."),
    480: ("gameplay_outdoor", "Rooftop / building edge, glass panel, sky."),
}

# Classification overrides for the current-build images that are not gameplay.
# Everything else found under artifacts/ (except artifacts/review/) or matching
# docs/visual-gap/shots/current-*.png is treated as gameplay ("gameplay").
CURRENT_CLASS_OVERRIDES = {
    "artifacts/glassline-menu.png": (
        "ui_menu",
        "Title/menu shell - excluded from gameplay aggregates.",
    ),
    "artifacts/glassline-editor.png": (
        "ui_editor",
        "Level inspector / editor overlay - excluded from gameplay aggregates.",
    ),
    "artifacts/glassline-perf.png": (
        "gameplay_debug_lowres",
        "Gameplay with perf HUD, 800x600 - excluded (non-standard resolution).",
    ),
}

CANONICAL_HEIGHT = 810
BLOCK = 16

# Black-bar detection: a border column/row counts as bar when it is almost
# black *and* uniform, and at least BAR_MIN_RUN such lines are consecutive.
BAR_LUMA_MAX = 0.02
BAR_STD_MAX = 0.01
BAR_MIN_RUN = 4
BAR_MAX_FRACTION = 0.25  # never crop more than 25% of a dimension

# Near-duplicate grouping for the (stale) previous capture pass only. Two images
# whose 64x36 greyscale thumbnails differ by less than this mean absolute error
# are considered the same scene/tuning variant.
CLUSTER_THUMB = (64, 36)
CLUSTER_MAE = 0.02

# Comparison pairs for the side-by-side sheets. (reference id, current id, title)
SHEET_PAIRS = [
    ("ref_t115", "current-02-jump", "Rooftop walkway: sky, facade and ground detail"),
    ("ref_t460", "current-11-sky", "City vista from height: sky and skyline"),
    ("ref_t235", "current-06-balance", "Red accent and facade contrast"),
]

METRIC_ORDER = [
    "luma_mean",
    "luma_std",
    "luma_p1",
    "luma_p5",
    "luma_p25",
    "luma_p50",
    "luma_p75",
    "luma_p95",
    "luma_p99",
    "frac_near_white",
    "frac_near_white_upper75",
    "frac_deep_shadow",
    "frac_deep_shadow_upper75",
    "sat_mean",
    "sat_p90",
    "colorfulness",
    "local_contrast_mean",
    "edge_energy",
    "contrast_top_third",
    "contrast_bottom_third",
    "contrast_top_over_bottom",
    "sky_mean_r",
    "sky_mean_g",
    "sky_mean_b",
    "sky_luma_mean",
    "sky_luma_std",
    "sky_sat_mean",
    "sky_blue_frac",
    "splittone_bright_rb",
    "splittone_dark_rb",
    "splittone_delta",
    "red_accent_frac",
    "rgb_mean_r",
    "rgb_mean_g",
    "rgb_mean_b",
    "rb_mean",
    "gb_mean",
]

METRIC_DEFINITIONS = {
    "luma_mean": "Mean Rec.709 luma Y=0.2126R+0.7152G+0.0722B of the sRGB-encoded values in [0,1].",
    "luma_std": "Population standard deviation of luma over all pixels.",
    "luma_p1..p99": "Luma percentiles (numpy linear interpolation).",
    "frac_near_white": "Fraction of pixels with luma > 0.90.",
    "frac_near_white_upper75": (
        "UI-exclusion sensitivity metric: same as frac_near_white but on rows "
        "0-75% only. Burned-in tutorial subtitles live in rows > 80%, so this "
        "value cannot contain subtitle pixels."
    ),
    "frac_deep_shadow": "Fraction of pixels with luma < 0.12.",
    "frac_deep_shadow_upper75": (
        "UI-exclusion sensitivity metric: same as frac_deep_shadow but on rows 0-75% only."
    ),
    "sat_mean": "Mean HSV saturation S (HSV computed on sRGB-encoded RGB, H in degrees).",
    "sat_p90": "90th percentile of HSV saturation.",
    "colorfulness": (
        "Hasler-Suesstrunk colorfulness on 8-bit sRGB: "
        "M = sqrt(std_rg^2+std_yb^2) + 0.3*sqrt(mean_rg^2+mean_yb^2), "
        "rg=R-G, yb=0.5(R+G)-B."
    ),
    "local_contrast_mean": (
        "Mean over non-overlapping 16x16 blocks of the population standard "
        "deviation of luma inside the block (blocks that fit; remainder cropped)."
    ),
    "edge_energy": (
        "Mean Sobel gradient magnitude of luma, normalised by 4*sqrt(2) "
        "(max possible Sobel response on [0,1] luma) and clipped to [0,1]; "
        "3x3 Sobel kernels, image border excluded."
    ),
    "contrast_top_third": "local_contrast_mean restricted to the top third of rows.",
    "contrast_bottom_third": "local_contrast_mean restricted to the bottom third of rows.",
    "contrast_top_over_bottom": "contrast_top_third / contrast_bottom_third.",
    "sky_mean_r/g/b": "Mean sRGB channel value over the top 40% of rows.",
    "sky_luma_mean": "Mean luma over the top 40% of rows.",
    "sky_luma_std": "Population standard deviation of luma over the top 40% of rows.",
    "sky_sat_mean": "Mean HSV saturation over the top 40% of rows.",
    "sky_blue_frac": (
        "Fraction of top-40% pixels with HSV hue in [190,250] deg and saturation > 0.35."
    ),
    "splittone_bright_rb": (
        "Mean (R-B) in 8-bit levels (x255) over pixels with luma >= per-image p80."
    ),
    "splittone_dark_rb": (
        "Mean (R-B) in 8-bit levels (x255) over pixels with luma <= per-image p20."
    ),
    "splittone_delta": "splittone_bright_rb - splittone_dark_rb (warm/cool split-tone signal).",
    "red_accent_frac": (
        "Fraction of pixels with HSV hue in [335,360) U [0,25] deg, saturation > 0.45 "
        "and value > 0.15."
    ),
    "rgb_mean_r/g/b": "Mean sRGB channel value over all pixels.",
    "rb_mean": "Mean (R-B) over all pixels, 8-bit levels.",
    "gb_mean": "Mean (G-B) over all pixels, 8-bit levels (teal/cyan-cast signal).",
}

SET_DEFINITIONS = {
    "reference_primary": "Reference frames classed gameplay_outdoor (clean platforming, outdoors).",
    "reference_interior": "Reference frames classed gameplay_interior (no current-build interior shot exists).",
    "reference_combat_tutorial": "Reference frames classed combat_tutorial (flagged, not platforming).",
    "reference_gameplay_extended": "All gameplay reference frames (outdoor + interior + combat tutorial).",
    "reference_all": "All 24 extracted reference frames, including cutscenes and the loading screen.",
    "current_new": "Fresh 1920x1080 capture pass (docs/visual-gap/shots/current-*.png), all gameplay.",
    "current_old_per_image": (
        "Previous capture pass (artifacts/*.png + artifacts/review/*.png), gameplay only, "
        "per-image weighting. Contains many near-duplicate tuning variants of one scene."
    ),
    "current_old_scene": (
        "Same previous-pass images, but aggregated per near-duplicate scene cluster "
        "(one equal-weight sample per scene), threshold CLUSTER_MAE on 64x36 luma thumbs."
    ),
    "current_all": "Fresh + previous gameplay shots (fresh + old per-image).",
}

COMPARISON_DEFS = [
    ("primary", "reference_primary", "current_new",
     "Primary comparison: outdoor platforming reference vs the fresh capture pass."),
    ("sensitivity_old_scene", "reference_primary", "current_old_scene",
     "Robustness: does the gap survive on the previous pass, de-duplicated per scene?"),
    ("sensitivity_old_per_image", "reference_primary", "current_old_per_image",
     "Robustness: previous pass with per-image weighting (over-weights tuned variants)."),
    ("sensitivity_current_all", "reference_primary", "current_all",
     "Robustness: all gameplay shots of both passes pooled."),
    ("sensitivity_ref_extended", "reference_gameplay_extended", "current_new",
     "Robustness: reference includes interiors + combat tutorial."),
    ("sensitivity_ref_all", "reference_all", "current_all",
     "Stress test: includes cutscenes and the loading screen on the reference side."),
]

# Which comparisons the 'robust' flag is judged on. The last (ref_all) stress
# test is reported but deliberately not part of the robustness verdict, because
# it includes non-gameplay frames that no reviewer would use as a look reference.
ROBUST_COMPARISONS = [
    "primary",
    "sensitivity_old_scene",
    "sensitivity_old_per_image",
    "sensitivity_current_all",
    "sensitivity_ref_extended",
]
ROBUST_MIN_MAGNITUDE = 0.4  # min|delta| must be >= 0.4 * max|delta|


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[image-metrics] {msg}", flush=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def r6(value):
    """Round for stable JSON output; keep None."""
    if value is None:
        return None
    return round(float(value), 6)


# --------------------------------------------------------------------------- #
# Image loading / normalisation
# --------------------------------------------------------------------------- #

def srgb_luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def detect_bar_runs(luma: np.ndarray, axis: int) -> tuple[int, int]:
    """Return (leading, trailing) uniform-near-black line counts along ``axis``.

    ``axis=0`` means reduce over columns (i.e. lines are rows); ``axis=1`` means
    reduce over rows (lines are columns). Only strips of at least BAR_MIN_RUN
    consecutive near-black, low-variance lines count as bars.
    """
    lines = luma.mean(axis=axis)
    spread = luma.std(axis=axis)
    n = lines.shape[0]

    def is_bar(i: int) -> bool:
        return bool(lines[i] < BAR_LUMA_MAX and spread[i] < BAR_STD_MAX)

    lead = 0
    while lead < n and is_bar(lead):
        lead += 1
    trail = 0
    while trail < n and is_bar(n - 1 - trail):
        trail += 1
    if lead < BAR_MIN_RUN:
        lead = 0
    if trail < BAR_MIN_RUN:
        trail = 0
    # Refuse to crop more than BAR_MAX_FRACTION of a dimension.
    if lead + trail > BAR_MAX_FRACTION * n:
        return 0, 0
    return lead, trail


def detect_crop_box(luma: np.ndarray) -> tuple[int, int, int, int]:
    """Detect letterbox/pillarbox borders; return PIL crop box (l, t, r, b)."""
    h, w = luma.shape
    top, bottom = detect_bar_runs(luma, axis=1)
    left, right = detect_bar_runs(luma, axis=0)
    return (left, top, w - right, h - bottom)


def load_rgb_array(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        rgb = im.convert("RGB")
        return np.asarray(rgb, dtype=np.float64) / 255.0


def prepare(
    path: Path,
    canonical_height: int = CANONICAL_HEIGHT,
    shared_crop: tuple[int, int, int, int] | None = None,
) -> tuple[np.ndarray, dict]:
    """Load, crop bars and resample to canonical height. Returns (array, meta)."""
    with Image.open(path) as im:
        source_size = im.size
        rgb = im.convert("RGB")

    arr = np.asarray(rgb, dtype=np.float64) / 255.0
    crop = shared_crop if shared_crop is not None else detect_crop_box(srgb_luma(arr))
    left, top, right, bottom = crop
    width, height = int(right - left), int(bottom - top)

    if height != canonical_height:
        new_w = max(1, int(round(width * canonical_height / height)))
        rgb = rgb.crop(crop).resize((new_w, canonical_height), Image.LANCZOS)
        out = rgb
    else:
        out = rgb.crop(crop)

    work = out.size
    arr = np.asarray(out, dtype=np.float64) / 255.0
    meta = {
        "source_size": [int(source_size[0]), int(source_size[1])],
        "source_aspect": round(source_size[0] / source_size[1], 6),
        "crop_box": [int(left), int(top), int(right), int(bottom)],
        "cropped_size": [int(width), int(height)],
        "cropped_aspect": round(width / height, 6),
        "working_size": [int(work[0]), int(work[1])],
        "resampled_to_height": bool(height != canonical_height),
        "upscaled": bool(height < canonical_height),
    }
    return arr, meta


# --------------------------------------------------------------------------- #
# Metric computation
# --------------------------------------------------------------------------- #

def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Vectorised sRGB -> HSV. H in degrees [0,360), S and V in [0,1]."""
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    mx = np.max(rgb, axis=-1)
    mn = np.min(rgb, axis=-1)
    delta = mx - mn
    h = np.zeros_like(mx)
    s = np.zeros_like(mx)
    v = mx

    chroma = delta > 0
    safe = np.where(chroma, delta, 1.0)
    is_r = chroma & (mx == r)
    is_g = chroma & (mx == g) & ~is_r
    is_b = chroma & (mx == b) & ~is_r & ~is_g
    h[is_r] = ((g[is_r] - b[is_r]) / safe[is_r]) % 6.0
    h[is_g] = (b[is_g] - r[is_g]) / safe[is_g] + 2.0
    h[is_b] = (r[is_b] - g[is_b]) / safe[is_b] + 4.0
    h *= 60.0
    s = np.where(mx > 0, delta / np.where(mx > 0, mx, 1.0), 0.0)
    return h, s, v


def mean_block_std(luma: np.ndarray, block: int = BLOCK) -> float | None:
    """Mean population std over non-overlapping ``block``x``block`` luma blocks."""
    h, w = luma.shape
    hb, wb = h // block, w // block
    if hb == 0 or wb == 0:
        return None
    blocks = (
        luma[: hb * block, : wb * block]
        .reshape(hb, block, wb, block)
        .transpose(0, 2, 1, 3)
        .reshape(hb * wb, block * block)
    )
    return float(blocks.std(axis=1, ddof=0).mean())


def sobel_energy(luma: np.ndarray) -> float | None:
    """Mean normalised absolute Sobel gradient magnitude (see METRIC_DEFINITIONS)."""
    if luma.shape[0] < 3 or luma.shape[1] < 3:
        return None
    l = luma
    gx = (l[:-2, 2:] + 2.0 * l[1:-1, 2:] + l[2:, 2:]) - (
        l[:-2, :-2] + 2.0 * l[1:-1, :-2] + l[2:, :-2]
    )
    gy = (l[2:, :-2] + 2.0 * l[2:, 1:-1] + l[2:, 2:]) - (
        l[:-2, :-2] + 2.0 * l[:-2, 1:-1] + l[:-2, 2:]
    )
    magnitude = np.hypot(gx, gy) / (4.0 * math.sqrt(2.0))
    return float(np.clip(magnitude, 0.0, 1.0).mean())


def colorfulness(rgb: np.ndarray) -> float:
    """Hasler-Suesstrunk colorfulness metric (see METRIC_DEFINITIONS)."""
    r, g, b = rgb[..., 0] * 255.0, rgb[..., 1] * 255.0, rgb[..., 2] * 255.0
    rg = r - g
    yb = 0.5 * (r + g) - b
    return float(
        math.hypot(rg.std(ddof=0), yb.std(ddof=0))
        + 0.3 * math.hypot(rg.mean(), yb.mean())
    )


def compute_metrics(rgb: np.ndarray) -> dict:
    """Compute the full metric set for one prepared sRGB image in [0,1]."""
    h, w = rgb.shape[0], rgb.shape[1]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    luma = srgb_luma(rgb)
    hue, sat, val = rgb_to_hsv(rgb)

    p1, p5, p25, p50, p75, p95, p99 = np.percentile(
        luma, [1.0, 5.0, 25.0, 50.0, 75.0, 95.0, 99.0]
    )

    # Split-tone thresholds are per-image percentiles, so "bright" and "dark"
    # always refer to the same fraction of each image.
    bright = luma >= p80_of(luma)
    dark = luma <= p20_of(luma)

    # Sky band: top 40% of rows.
    sky_rows = int(round(0.40 * h))
    sky = slice(0, max(1, sky_rows))
    sky_luma = luma[sky]
    blue_sky = (hue[sky] >= 190.0) & (hue[sky] <= 250.0) & (sat[sky] > 0.35)

    # UI-exclusion sensitivity window: rows 0-75% contain no burned-in subtitles
    # (which live below row 80% in every reference frame).
    upper75 = luma[: int(round(0.75 * h)), :]

    # Local contrast, and the same measure on the top vs bottom third of rows.
    luma_third = h // 3
    top_rows = (luma_third // BLOCK) * BLOCK
    bottom_rows = (luma_third // BLOCK) * BLOCK
    top_third = luma[:top_rows, :]
    bottom_third = luma[h - bottom_rows :, :]

    red_accent = (
        ((hue >= 335.0) | (hue <= 25.0))
        & (sat > 0.45)
        & (val > 0.15)
    )

    rb = r - b
    metrics = {
        "luma_mean": r6(luma.mean()),
        "luma_std": r6(luma.std(ddof=0)),
        "luma_p1": r6(p1),
        "luma_p5": r6(p5),
        "luma_p25": r6(p25),
        "luma_p50": r6(p50),
        "luma_p75": r6(p75),
        "luma_p95": r6(p95),
        "luma_p99": r6(p99),
        "frac_near_white": r6((luma > 0.90).mean()),
        "frac_near_white_upper75": r6((upper75 > 0.90).mean()),
        "frac_deep_shadow": r6((luma < 0.12).mean()),
        "frac_deep_shadow_upper75": r6((upper75 < 0.12).mean()),
        "sat_mean": r6(sat.mean()),
        "sat_p90": r6(np.percentile(sat, 90.0)),
        "colorfulness": r6(colorfulness(rgb)),
        "local_contrast_mean": r6(mean_block_std(luma)),
        "edge_energy": r6(sobel_energy(luma)),
        "contrast_top_third": r6(mean_block_std(top_third)),
        "contrast_bottom_third": r6(mean_block_std(bottom_third)),
        "contrast_top_over_bottom": None,
        "sky_mean_r": r6(r[sky].mean()),
        "sky_mean_g": r6(g[sky].mean()),
        "sky_mean_b": r6(b[sky].mean()),
        "sky_luma_mean": r6(sky_luma.mean()),
        "sky_luma_std": r6(sky_luma.std(ddof=0)),
        "sky_sat_mean": r6(sat[sky].mean()),
        "sky_blue_frac": r6(blue_sky.mean()),
        "splittone_bright_rb": r6(rb[bright].mean() * 255.0),
        "splittone_dark_rb": r6(rb[dark].mean() * 255.0),
        "red_accent_frac": r6(red_accent.mean()),
        "rgb_mean_r": r6(r.mean()),
        "rgb_mean_g": r6(g.mean()),
        "rgb_mean_b": r6(b.mean()),
        "rb_mean": r6(rb.mean() * 255.0),
        "gb_mean": r6((g - b).mean() * 255.0),
    }
    top_third_contrast = metrics["contrast_top_third"]
    bottom_third_contrast = metrics["contrast_bottom_third"]
    if top_third_contrast is not None and bottom_third_contrast:
        metrics["contrast_top_over_bottom"] = r6(
            top_third_contrast / bottom_third_contrast
        )
    metrics["splittone_delta"] = r6(
        metrics["splittone_bright_rb"] - metrics["splittone_dark_rb"]
    )
    return metrics


def p80_of(values: np.ndarray) -> float:
    return float(np.percentile(values, 80.0))


def p20_of(values: np.ndarray) -> float:
    return float(np.percentile(values, 20.0))


# --------------------------------------------------------------------------- #
# Input discovery
# --------------------------------------------------------------------------- #

def probe_video(video: Path) -> dict:
    out = run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,codec_name,nb_frames,duration,pix_fmt,bit_rate",
            "-show_entries", "format=size,bit_rate,format_name",
            "-of", "json", str(video),
        ]
    )
    parsed = json.loads(out.stdout)
    info = parsed["streams"][0]
    fmt = parsed.get("format", {})
    num, den = info["r_frame_rate"].split("/")
    size_bytes = int(fmt["size"]) if fmt.get("size") else video.stat().st_size
    duration = float(info["duration"]) if info.get("duration") else None
    stream_bit_rate = int(info["bit_rate"]) if info.get("bit_rate") else None
    return {
        "path": str(video),
        "codec": info.get("codec_name"),
        "pix_fmt": info.get("pix_fmt"),
        "width": int(info["width"]),
        "height": int(info["height"]),
        "fps": round(float(num) / float(den), 6),
        "frames": int(info["nb_frames"]) if info.get("nb_frames") else None,
        "duration_s": round(duration, 3) if duration else None,
        "file_size_bytes": size_bytes,
        "container": fmt.get("format_name"),
        "video_bit_rate_kbps": (
            round(stream_bit_rate / 1000.0, 1) if stream_bit_rate
            else (round(size_bytes * 8 / duration / 1000.0, 1) if duration else None)
        ),
    }


def extract_reference_frames(video: Path, timestamps: list[int], out_dir: Path) -> list[tuple[int, Path]]:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found on PATH")
    out_dir.mkdir(parents=True, exist_ok=True)
    frames: list[tuple[int, Path]] = []
    for t in timestamps:
        path = out_dir / f"ref_t{t:03d}.png"
        if not path.exists():
            log(f"extracting reference frame t={t}s -> {path}")
            run(
                [
                    "ffmpeg", "-v", "error", "-nostdin",
                    "-ss", str(t),
                    "-i", str(video),
                    "-frames:v", "1", "-an", "-sn", "-dn",
                    "-y", str(path),
                ]
            )
        if not path.exists():
            raise RuntimeError(f"ffmpeg failed to extract t={t}s")
        frames.append((t, path))
    return frames


def discover_current_images(repo_root: Path) -> list[tuple[str, Path]]:
    """Return (family, path) for current-build screenshots.

    Families: ``fresh`` (docs/visual-gap/shots/current-*.png, newest capture
    pass) and ``old`` (artifacts/*.png plus artifacts/review/*.png, previous
    pass). Sorted for deterministic ordering.
    """
    found: list[tuple[str, Path]] = []
    fresh_glob = sorted((repo_root / "docs" / "visual-gap" / "shots").glob("current-*.png"))
    for path in fresh_glob:
        found.append(("fresh", path))
    for path in sorted((repo_root / "artifacts").glob("*.png")):
        found.append(("old", path))
    for path in sorted((repo_root / "artifacts" / "review").glob("*.png")):
        found.append(("old", path))
    return found


# --------------------------------------------------------------------------- #
# Aggregation / comparison
# --------------------------------------------------------------------------- #

def aggregate(records: list[dict], metrics: list[str] | None = None) -> dict:
    metrics = metrics or METRIC_ORDER
    agg = {}
    for key in metrics:
        vals = [r["metrics"].get(key) for r in records]
        vals = [float(v) for v in vals if v is not None]
        if not vals:
            agg[key] = {"n": 0, "mean": None, "sd": None, "min": None, "max": None}
            continue
        arr = np.asarray(vals, dtype=np.float64)
        agg[key] = {
            "n": int(arr.size),
            "mean": r6(arr.mean()),
            "sd": r6(arr.std(ddof=1)) if arr.size > 1 else None,
            "min": r6(arr.min()),
            "max": r6(arr.max()),
        }
    return agg


def aggregate_cluster_means(clusters: list[list[dict]], metrics: list[str] | None = None) -> dict:
    """Equal weight per scene cluster: per-metric mean of the cluster means."""
    metrics = metrics or METRIC_ORDER
    agg = {}
    for key in metrics:
        per_cluster = []
        for members in clusters:
            vals = [m["metrics"].get(key) for m in members]
            vals = [float(v) for v in vals if v is not None]
            if vals:
                per_cluster.append(float(np.mean(vals)))
        if not per_cluster:
            agg[key] = {"n": 0, "mean": None, "sd": None, "min": None, "max": None}
            continue
        arr = np.asarray(per_cluster, dtype=np.float64)
        agg[key] = {
            "n": int(arr.size),
            "mean": r6(arr.mean()),
            "sd": r6(arr.std(ddof=1)) if arr.size > 1 else None,
            "min": r6(arr.min()),
            "max": r6(arr.max()),
        }
    return agg


def compare(ref_agg: dict, cur_agg: dict, metric: str, per_image: bool = True) -> dict:
    ref = ref_agg.get(metric, {})
    cur = cur_agg.get(metric, {})
    ref_mean, cur_mean = ref.get("mean"), cur.get("mean")
    ref_sd, cur_sd = ref.get("sd"), cur.get("sd")
    row = {
        "metric": metric,
        "ref_mean": ref_mean,
        "ref_sd": ref_sd,
        "ref_min": ref.get("min"),
        "ref_max": ref.get("max"),
        "cur_mean": cur_mean,
        "cur_sd": cur_sd,
        "cur_min": cur.get("min"),
        "cur_max": cur.get("max"),
        "delta": None,
        "delta_pct": None,
        "cohen_d": None,
        "relative_gap": None,
        "separation": None,
    }
    if ref_mean is None or cur_mean is None:
        return row
    delta = cur_mean - ref_mean
    row["delta"] = r6(delta)
    denom = abs(ref_mean)
    if denom > 1e-4:
        row["delta_pct"] = r6(delta / denom * 100.0)
    pooled = None
    if ref_sd is not None and cur_sd is not None:
        pooled = math.sqrt((ref_sd ** 2 + cur_sd ** 2) / 2.0)
    if pooled and pooled > 1e-9:
        row["cohen_d"] = r6(delta / pooled)
    scale = max(abs(ref_mean), abs(cur_mean))
    if scale > 1e-4:
        row["relative_gap"] = r6(abs(delta) / scale)
    ref_min, ref_max = row["ref_min"], row["ref_max"]
    cur_min, cur_max = row["cur_min"], row["cur_max"]
    if per_image and None not in (ref_min, ref_max, cur_min, cur_max):
        if ref_min > cur_max:
            row["separation"] = "all_ref_above_all_cur"
        elif cur_min > ref_max:
            row["separation"] = "all_cur_above_all_ref"
        else:
            row["separation"] = "overlap"
    return row


def build_comparison(ref_agg: dict, cur_agg: dict, per_image: bool = True) -> dict:
    rows = [compare(ref_agg, cur_agg, m, per_image=per_image) for m in METRIC_ORDER]
    ranked_d = sorted(
        [r for r in rows if r["cohen_d"] is not None],
        key=lambda r: abs(r["cohen_d"]),
        reverse=True,
    )
    ranked_rel = sorted(
        [r for r in rows if r["relative_gap"] is not None],
        key=lambda r: r["relative_gap"],
        reverse=True,
    )
    return {
        "rows": rows,
        "ranked_by_abs_cohen_d": [r["metric"] for r in ranked_d],
        "ranked_by_relative_gap": [r["metric"] for r in ranked_rel],
    }


def build_robustness(per_comparison: dict) -> dict:
    """Flag metrics whose sign and magnitude are stable across game-only variants."""
    flags = {}
    for metric in METRIC_ORDER:
        deltas = []
        for key in ROBUST_COMPARISONS:
            rows = per_comparison[key]["rows"]
            row = next((r for r in rows if r["metric"] == metric), None)
            if row is None or row["delta"] is None:
                deltas = []
                break
            deltas.append(float(row["delta"]))
        if not deltas or any(abs(d) < 1e-9 for d in deltas):
            flags[metric] = {
                "robust": False,
                "reason": "missing or zero delta in a comparison",
                "deltas": [r6(d) for d in deltas] if deltas else None,
            }
            continue
        signs = {d > 0 for d in deltas}
        mags = [abs(d) for d in deltas]
        stable = min(mags) >= ROBUST_MIN_MAGNITUDE * max(mags)
        flags[metric] = {
            "robust": bool(len(signs) == 1 and stable),
            "reason": (
                "sign consistent and min|delta| >= "
                f"{ROBUST_MIN_MAGNITUDE} * max|delta| across game-only comparisons"
            ),
            "deltas": [r6(d) for d in deltas],
        }
    return flags


def cluster_records(records: list[dict], thumb: tuple[int, int], threshold: float) -> list[list[dict]]:
    """Union-find grouping of near-duplicate images by thumbnail MAE."""
    thumbs = []
    for rec in records:
        with Image.open(rec["_path"]) as im:
            small = im.convert("L").resize(thumb, Image.BILINEAR)
            thumbs.append(np.asarray(small, dtype=np.float64) / 255.0)
    parent = list(range(len(records)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            if np.abs(thumbs[i] - thumbs[j]).mean() < threshold:
                union(i, j)

    groups: dict[int, list[dict]] = {}
    for i, rec in enumerate(records):
        groups.setdefault(find(i), []).append(rec)
    return [groups[k] for k in sorted(groups)]


# --------------------------------------------------------------------------- #
# Sheets
# --------------------------------------------------------------------------- #

def _font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _label_box(draw: ImageDraw.ImageDraw, x: int, y: int, lines: list[tuple[str, ImageFont.ImageFont]]) -> None:
    pad = 6
    widths = [draw.textlength(text, font=font) for text, font in lines]
    heights = [font.size for _, font in lines]
    box_w = int(max(widths)) + 2 * pad
    box_h = sum(heights) + 2 * pad + 2 * (len(lines) - 1)
    draw.rectangle([x, y, x + box_w, y + box_h], fill=(0, 0, 0))
    cy = y + pad
    for (text, font), height in zip(lines, heights):
        draw.text((x + pad, cy), text, fill=(255, 255, 255), font=font)
        cy += height + 2


def make_sheet(
    out_path: Path,
    ref_rec: dict,
    cur_rec: dict,
    title: str,
    image_height: int = 520,
) -> None:
    margin, gap, caption_h = 14, 14, 52
    panels = []
    for rec in (ref_rec, cur_rec):
        arr = rec["_prepared"]
        im = Image.fromarray(np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8))
        scale = image_height / im.size[1]
        panels.append(im.resize((int(round(im.size[0] * scale)), image_height), Image.LANCZOS))

    width = margin * 2 + panels[0].size[0] + gap + panels[1].size[0]
    height = margin * 2 + image_height + caption_h
    sheet = Image.new("RGB", (width, height), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)

    label_font = _font(13, bold=True)
    label_small = _font(12)
    title_font = _font(15, bold=True)
    caption_font = _font(12)

    x_positions = [margin, margin + panels[0].size[0] + gap]
    for panel, rec, x in zip(panels, (ref_rec, cur_rec), x_positions):
        sheet.paste(panel, (x, margin))
        if rec["set_family"] == "reference":
            headline = f"REFERENCE  Mirror's Edge (2008)  t={rec['timestamp_s']} s"
        else:
            headline = f"CURRENT  GLASSLINE  {Path(rec['source']).name}"
        _label_box(
            draw, x + 8, margin + 8,
            [(headline, label_font),
             (f"{rec['source_size'][0]}x{rec['source_size'][1]} -> working "
              f"{rec['working_size'][0]}x{rec['working_size'][1]}", label_small)],
        )

    def metric_triplet(rec: dict) -> str:
        m = rec["metrics"]
        return (
            f"luma {m['luma_mean']:.2f} | sat {m['sat_mean']:.2f} | "
            f"near-white {m['frac_near_white'] * 100:.0f}% | "
            f"blue-sky {m['sky_blue_frac'] * 100:.0f}% | "
            f"red-accent {m['red_accent_frac'] * 100:.1f}%"
        )

    draw.text((margin, margin + image_height + 8), title, fill=(240, 240, 240), font=title_font)
    draw.text((margin, margin + image_height + 30),
              f"REF  {metric_triplet(ref_rec)}", fill=(180, 200, 255), font=caption_font)
    draw.text((margin + width // 2, margin + image_height + 30),
              f"CUR  {metric_triplet(cur_rec)}", fill=(180, 255, 200), font=caption_font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    log(f"wrote sheet {out_path} ({sheet.size[0]}x{sheet.size[1]})")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--scratch-dir", type=Path, default=Path("/tmp/glassline-image-metrics"))
    parser.add_argument("--skip-extract", action="store_true", help="reuse cached reference frames")
    parser.add_argument("--no-sheets", action="store_true", help="skip compare-*.png sheets")
    parser.add_argument("--out-json", type=Path, default=None)
    parser.add_argument("--no-write-json", action="store_true")
    parser.add_argument("--video", type=Path, default=None,
                        help="reference video path (default: the tutorial walkthrough)")
    parser.add_argument("--timestamps", default=None,
                        help="comma-separated seconds, e.g. 115,130,150")
    parser.add_argument("--classes-json", type=Path, default=None,
                        help="JSON object mapping timestamp -> [class, note] for a custom video")
    args = parser.parse_args(argv)

    repo_root: Path = args.repo_root.resolve()
    scratch: Path = args.scratch_dir.resolve()
    out_json = args.out_json or (repo_root / "docs" / "visual-gap" / "metrics.json")
    shots_dir = repo_root / "docs" / "visual-gap" / "shots"
    video = args.video or (repo_root / DEFAULT_REFERENCE_VIDEO)
    if args.video is not None and not video.is_absolute():
        video = (repo_root / args.video).resolve()

    if not video.exists():
        raise SystemExit(f"reference video not found: {video}")

    timestamps = list(DEFAULT_TIMESTAMPS)
    if args.timestamps:
        timestamps = sorted({int(part) for part in args.timestamps.split(",") if part.strip()})

    global REFERENCE_FRAME_CLASSES
    if args.classes_json:
        loaded = json.loads(Path(args.classes_json).read_text())
        REFERENCE_FRAME_CLASSES = {int(key): tuple(value) for key, value in loaded.items()}
    video_info = probe_video(video)
    log(f"reference video: {video_info['width']}x{video_info['height']} "
        f"{video_info['fps']} fps {video_info['codec']} {video_info['duration_s']} s")

    frames_dir = scratch / "frames"
    if args.skip_extract and frames_dir.exists():
        missing = [t for t in timestamps if not (frames_dir / f"ref_t{t:03d}.png").exists()]
        if missing:
            log(f"cache missing {missing}, extracting anyway")
            args.skip_extract = False
    if args.skip_extract:
        frame_paths = [(t, frames_dir / f"ref_t{t:03d}.png") for t in timestamps]
    else:
        frame_paths = extract_reference_frames(video, timestamps, frames_dir)

    ffmpeg_version = run(["ffmpeg", "-version"]).stdout.splitlines()[0]

    # --- shared crop box for the reference video (intersection over frames) ---
    crops = []
    for _, path in frame_paths:
        arr = load_rgb_array(path)
        crops.append(detect_crop_box(srgb_luma(arr)))
    left = max(c[0] for c in crops)
    top = max(c[1] for c in crops)
    right = min(c[2] for c in crops)
    bottom = min(c[3] for c in crops)
    shared_crop = (left, top, right, bottom)
    log(f"reference crop box (l,t,r,b)=({left},{top},{right},{bottom}) "
        f"-> {right - left}x{bottom - top}")

    # --- build records ---
    records: list[dict] = []
    for t, path in frame_paths:
        cls, note = REFERENCE_FRAME_CLASSES.get(t, ("unclassified", ""))
        arr, meta = prepare(path, shared_crop=shared_crop)
        rec = {
            "id": f"ref_t{t}",
            "set_family": "reference",
            "class": cls,
            "note": note,
            "source": f"{video.name}@t={t}s",
            "timestamp_s": t,
            "source_sha256": sha256_file(path),
            "metrics": compute_metrics(arr),
            "_path": path,
            "_prepared": arr,
        }
        rec.update({k: meta[k] for k in (
            "source_size", "source_aspect", "crop_box", "cropped_size",
            "cropped_aspect", "working_size", "resampled_to_height", "upscaled")})
        rec["crop_box_shared"] = True
        records.append(rec)

    current_sources = discover_current_images(repo_root)
    log(f"discovered {len(current_sources)} current-build images")
    for family, path in current_sources:
        rel = path.relative_to(repo_root).as_posix()
        cls, note = CURRENT_CLASS_OVERRIDES.get(rel, ("gameplay", "Gameplay screenshot."))
        arr, meta = prepare(path)
        rec = {
            "id": path.stem,
            "set_family": "current_new" if family == "fresh" else "current_old",
            "class": cls,
            "note": note,
            "source": rel,
            "timestamp_s": None,
            "source_sha256": sha256_file(path),
            "metrics": compute_metrics(arr),
            "_path": path,
            "_prepared": arr,
        }
        rec.update({k: meta[k] for k in (
            "source_size", "source_aspect", "crop_box", "cropped_size",
            "cropped_aspect", "working_size", "resampled_to_height", "upscaled")})
        rec["crop_box_shared"] = False
        records.append(rec)

    by_id = {r["id"]: r for r in records}

    # --- set membership ---
    def select(family: str | None = None, classes: tuple[str, ...] | None = None) -> list[dict]:
        out = []
        for rec in records:
            if family is not None and rec["set_family"] != family:
                continue
            if classes is not None and rec["class"] not in classes:
                continue
            out.append(rec)
        return out

    reference = [r for r in records if r["set_family"] == "reference"]
    current_new = select("current_new", ("gameplay",))
    current_old = select("current_old", ("gameplay",))

    clusters = cluster_records(current_old, CLUSTER_THUMB, CLUSTER_MAE) if current_old else []
    cluster_summary = []
    for idx, members in enumerate(sorted(clusters, key=lambda g: g[0]["id"])):
        ids = [m["id"] for m in members]
        cluster_summary.append({"index": idx, "size": len(ids), "members": ids})
    log(f"old-pass scene clusters: {[c['size'] for c in cluster_summary]}")

    set_members = {
        "reference_primary": [r for r in reference if r["class"] == "gameplay_outdoor"],
        "reference_interior": [r for r in reference if r["class"] == "gameplay_interior"],
        "reference_combat_tutorial": [r for r in reference if r["class"] == "combat_tutorial"],
        "reference_gameplay_extended": [
            r for r in reference
            if r["class"] in ("gameplay_outdoor", "gameplay_interior", "combat_tutorial")
        ],
        "reference_all": reference,
        "current_new": current_new,
        "current_old_per_image": current_old,
        "current_all": current_new + current_old,
    }

    aggregates = {}
    for name, members in set_members.items():
        aggregates[name] = aggregate(members)
    clusters_sorted = sorted(clusters, key=lambda g: g[0]["id"])
    aggregates["current_old_scene"] = aggregate_cluster_means(clusters_sorted)
    set_members["current_old_scene"] = [m for members in clusters_sorted for m in members]

    # --- comparisons ---
    per_comparison = {}
    comparison_meta = {}
    for key, ref_set, cur_set, note in COMPARISON_DEFS:
        per_comparison[key] = build_comparison(
            aggregates[ref_set],
            aggregates[cur_set],
            per_image=(cur_set != "current_old_scene"),
        )
        comparison_meta[key] = {"reference_set": ref_set, "current_set": cur_set, "note": note}

    robustness = build_robustness(per_comparison)

    # --- set descriptions (cluster set is described by clusters, not images) ---
    sets_payload = {}
    for name, members in set_members.items():
        entry = {"definition": SET_DEFINITIONS[name], "aggregate": aggregates[name]}
        if name == "current_old_scene":
            entry["n"] = len(clusters_sorted)
            entry["n_images"] = len(members)
            entry["members"] = [
                {"cluster": idx, "images": [m["id"] for m in cluster_members]}
                for idx, cluster_members in enumerate(clusters_sorted)
            ]
        else:
            entry["n"] = len(members)
            entry["members"] = [m["id"] for m in members]
        sets_payload[name] = entry

    # --- sheets ---
    sheets_written = []
    if not args.no_sheets:
        for index, (ref_id, cur_id, title) in enumerate(SHEET_PAIRS, start=1):
            ref_rec = by_id.get(ref_id)
            cur_rec = by_id.get(cur_id)
            if ref_rec is None or cur_rec is None:
                log(f"WARNING: sheet pair unavailable: {ref_id} / {cur_id}")
                continue
            out_path = shots_dir / f"compare-{index:02d}.png"
            make_sheet(out_path, ref_rec, cur_rec, title)
            sheets_written.append(out_path.relative_to(repo_root).as_posix())

    # --- JSON ---
    def public(rec: dict) -> dict:
        return {k: v for k, v in rec.items() if not k.startswith("_")}

    payload = {
        "meta": {
            "script": "tools/image-metrics.py",
            "script_version": SCRIPT_VERSION,
            "generated_from": "deterministic run; no wall-clock fields",
            "repo_root_relative_to": "paths below are relative to the repo root",
            "ffmpeg": ffmpeg_version,
            "numpy": np.__version__,
            "pillow": Image.__version__,
            "reference_video": video_info,
            "timestamps_s": timestamps,
            "reference_crop": {
                "shared_box_ltrb": list(shared_crop),
                "cropped_size": [int(right - left), int(bottom - top)],
                "note": (
                    "The 1920x810 upload carries a pillarboxed 16:9 picture; one "
                    "fixed crop box is used for every reference frame."
                ),
            },
            "canonical_height_px": CANONICAL_HEIGHT,
            "block_size_px": BLOCK,
            "bar_detection": {
                "luma_max": BAR_LUMA_MAX,
                "std_max": BAR_STD_MAX,
                "min_run_px": BAR_MIN_RUN,
                "max_fraction": BAR_MAX_FRACTION,
            },
            "cluster": {
                "thumb": list(CLUSTER_THUMB),
                "mean_abs_error_threshold": CLUSTER_MAE,
                "scope": "previous capture pass only (current_old_scene aggregate)",
            },
            "robustness_rule": {
                "comparisons": ROBUST_COMPARISONS,
                "min_magnitude_ratio": ROBUST_MIN_MAGNITUDE,
                "description": (
                    "A metric is robust when the sign of the delta is the same and "
                    "min|delta| >= 0.4 * max|delta| across the game-only comparisons; "
                    "sensitivity_ref_all is reported but excluded from the verdict."
                ),
            },
            "metric_definitions": METRIC_DEFINITIONS,
            "set_definitions": SET_DEFINITIONS,
            "reference_frame_annotations": {
                str(t): {"class": cls, "note": note}
                for t, (cls, note) in sorted(REFERENCE_FRAME_CLASSES.items())
            },
            "current_class_overrides": CURRENT_CLASS_OVERRIDES,
            "frame_extraction": {
                "command": (
                    "ffmpeg -v error -nostdin -ss <t> -i <video> -frames:v 1 "
                    "-an -sn -dn -y ref_t<t>.png"
                ),
                "selection": "first decoded frame with PTS >= t seconds",
                "scratch_dir": str(scratch),
                "note": "scratch frames are not deliverables; they are re-extracted on demand",
            },
        },
        "images": [public(r) for r in records],
        "scene_clusters": {
            "threshold": CLUSTER_MAE,
            "clusters": cluster_summary,
        },
        "sets": sets_payload,
        "comparisons": {
            key: {
                "reference_set": comparison_meta[key]["reference_set"],
                "current_set": comparison_meta[key]["current_set"],
                "note": comparison_meta[key]["note"],
                **per_comparison[key],
            }
            for key in per_comparison
        },
        "robustness": robustness,
        "sheets": sheets_written,
    }

    if not args.no_write_json:
        out_json.parent.mkdir(parents=True, exist_ok=True)
        with out_json.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        log(f"wrote {out_json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
