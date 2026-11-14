# GLASSLINE performance and reliability

- Date: 2026-11-14
- Branch: `feat/glassline-polish`
- Scope: tutorial scene, quality profiles, draw-call/LOD work and reliability probes
- Target: desktop Chrome/Edge, 60 FPS, single-file build

## Baseline (before instancing)

Measured in headless Edge at 1280×720 with the tutorial autostarted:

| Quality | Draw calls | Triangles | Geometries | Textures | FPS |
|---|---:|---:|---:|---:|---:|
| low | 409 | 12,723 | 259 | 39 | 59.9 |
| medium | 412 | 12,726 | 259 | 47 | 59.9 |
| high | 413 | 12,727 | 259 | 48 | 59.8 |

The triangle count was modest; draw-call and geometry counts were the problem.

## Changes

- Window lights are one `InstancedMesh` instead of ~56 meshes.
- Route strips are one `InstancedMesh` of a unit box instead of ~26 meshes.
- Platform edge lines are merged into one `LineSegments` buffer; low quality
  skips them.
- Instanced meshes compute bounding spheres for culling.
- The existing engine dynamic-resolution and quality pipeline remains in use
  (`?q=low|medium|high`).
- Added `?stats=1` / **F3** performance overlay with FPS, frame ms, calls,
  triangles, geometries, textures, buffer, pipeline, quality, scale and error
  state.

## After instancing

Measured under the same conditions:

| Quality | Draw calls | Triangles | Geometries | Textures | FPS |
|---|---:|---:|---:|---:|---:|
| low | 255 | 12,915 | 105 | 45 | 59.8 |
| medium | 259 | 12,918 | 106 | 47 | 59.9 |
| high | 375 | 13,391 | 106 | 48 | 59.3 |

At a smaller 800×600 viewport the low-quality frame showed 367 calls / 13,351
triangles because more of the route entered the wider vertical frustum; the
draw-call number is view-dependent. At 1280×720 some frames include the
alternating shadow-map refresh (~367 calls); the cheapest complete low-quality
frame is ~255 calls. The important result is the reduction from ~409 to ~255 at
the normal 1280×720 low/medium base frame, with geometry count reduced from 259
to ~106.

## Hardware peak-load profile

Command (headed Microsoft Edge, Apple M1 Pro, 1920×1080, DPR 2, high quality,
dynamic resolution disabled, all static objects forced visible):

```sh
BASE_URL=http://127.0.0.1:4173 DPR=2 QUALITY=high DURATION=8 \
  node tools/bench-glassline.mjs
```

Result:

| Metric | Value |
|---|---:|
| GPU | ANGLE Metal Renderer: Apple M1 Pro |
| Buffer | 2022×1137 (high-quality pixel cap) |
| Draw calls | 623 |
| Triangles | 14,467 |
| Geometries | 114 |
| Frames sampled | 957 |
| Average frame | 8.36 ms |
| p50 / p95 / p99 | 8.3 / 9.3 / 10.5 ms |
| Effective FPS | 119.6 |
| 60 FPS verdict | **PASS** |

This is a worst-case-style render (all static objects forced visible), not a
gameplay camera. The 60 FPS budget is met with headroom; the browser was running
on a 120 Hz ProMotion display. The buffer is capped by the renderer's high-quality
pixel budget even at DPR 2.

Raw result is written to ignored `artifacts/glassline-hardware-bench.json` by the
script. The benchmark is manual hardware tooling and is not part of CI.

## Automated budgets

`tests/e2e/glassline-perf.spec.js` asserts at low quality / 1280×720:

- cheapest sampled draw calls < 300
- triangles < 20,000
- geometries < 150
- FPS > 20 (headless software floor; real hardware target remains 60)
- F3 toggles the overlay
- resize does not produce `__errors` or `__fatal`
- three repeated reloads boot without fatal errors

The FPS floor is deliberately loose because headless software WebGL is not a
hardware benchmark. Hardware 60 FPS validation remains a release check.

## Quality and LOD policy

- `low`: no merged platform edge lines; engine low post/shadow resolution and
  dynamic scale.
- `medium`: edge lines enabled; medium resolution profile.
- `high`: edge lines, higher post/shadow resolution and full dynamic scale.
- The engine can drop quality automatically if frame time stays high at minimum
  scale (`quality:auto` path in the renderer).
- Static level geometry is authored as data; repeated window/strip geometry is
  instanced, and frustum culling is left enabled.

## Reliability evidence

- Boot/error assertions are part of the Playwright boot helper.
- Tutorial reload/persistence, fail-safe auto-respawn, pause/restart and finish
  flows are covered.
- Repeated reload test (`glassline-perf.spec.js`) covers three cold boots.
- Asset/QA audit is in [`GLASSLINE_AUDIT.md`](GLASSLINE_AUDIT.md).

## Remaining limits

- Headless software WebGL numbers are not a substitute for hardware profiling.
- Human 10–20 minute pacing and audio QA remain open.
- Gamepad/touch are out of scope for this desktop-keyboard slice.
- The single-file bundle still carries the Phase 1 Saltline mode; release
  packaging/tree-shaking is a separate decision.
