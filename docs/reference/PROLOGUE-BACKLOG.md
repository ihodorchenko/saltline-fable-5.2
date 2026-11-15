# Reference-driven backlog — prologue walkthrough (P1 → P2 → P3)

Work items distilled from `PROLOGUE-ANALYSIS.md`. Every item names the reference
timestamp that motivates it, the intended implementation in this repo, and the
acceptance check (metric or visual). Imagery stays in the local kit; we build
original geometry and materials, never copies.

Numbers come from the second reference profile (`docs/visual-gap/metrics-prologue.json`)
and the current build (`.`. The two consistent gaps are **white area in frame**
(12.6 % vs 24–27 % in both references) and **red accent area** (2.1 % vs 2.9–4.2 %).

---

## P1 — prop vocabulary (the fastest visual win)

### P1.1 Solar PV arrays — `solar` prop
Reference: 8:20–9:00 blue panels on white roofs; repeated through the mission.
Current state: `platform-solar` exists in the auto roof kit as a dark slab
(`0x21333f`), reads as a black box, not as photovoltaics.
Build: a PV array = tilted panel grid (3–6 panels) on a low frame: panel material
dark blue (`0x1b2a3a..0x27405c`), roughness 0.18, metalness 0.1, env reflection;
frame and legs pale brushed metal; thin panel gaps as separate quads or a canvas
texture. Instanced (one draw call), two sizes.
Placement: explicit `{ type: 'solar' }` props on wide roofs: start roof, wall-run
landing, summit roof, courtyard rim, final roof, branch-low roofs.
Acceptance: solar visible in the 01/05/07/10 capture poses; `probe-scene` calls
and triangles inside +5 % of the current values; no z-fighting with roof tops.

### P1.2 AC units with fan grilles — upgrade `ac` prop
Reference: 11:00–11:20 massive HVAC units, circular fan grilles.
Current state: plain boxes.
Build: keep the box body, add a front/top face with 1–2 recessed circular fan
grilles (dark ring, radial blades, centre hub) + a small service panel. Materials
reuse metalStandard with a second darker roughness. Geometry per unit ≤ 300 tris.
Placement: existing AC props get the grille automatically; add one large unit at
the start roof and one at the summit.
Acceptance: 1134-style close-up reads as machinery; no new materials per unit.

### P1.3 Glass skylights / roof lights — `skylight` prop
Reference: 10:20 red-framed roof light; glass panels in roofs.
Build: a shallow glass panel (1.8×1.8 or 2.4×1.6) with a metal kerb frame,
`userData.reflections = 'glass'` so `src/levels/reflections.js` assigns the scene
cube probe; roughness 0.05–0.12, metalness 0.
Placement: roofs with wide deck: start, wall-run landing, courtyard ceiling (P2),
final roof.
Acceptance: visible sky reflection at grazing angles in captures; one draw call
per skylight or instanced if flat enough.

### P1.4 Red functional props — `redLadder`, `redPipe`, red `rail`
Reference: red ladders, pipes, railings, awnings throughout the mission.
Current state: red exists only as route paint and beams.
Build: `redLadder` = two red rails + 8–10 rungs (thin boxes, instanced), leaning on
a parapet; `redPipe` = horizontal conduit run along a wall with brackets; `rail`
already supports a colour, so use red rails on the final roof and act II.
Placement: red ladder at the wall-climb walls (act I parapet, act III climb), red
pipe runs on the courtyard walls and the final facade, red rails at the finish.
Acceptance: `red_accent_frac` rises from 2.07 % toward 2.5–3 % without route-repaint
changes; reads as functional, not decorative.

---

## P2 — level structure and white area

### P2.1 Covered service block in the act II courtyard
Reference: 10:00–10:50 white service corridor, lockers, skylight shaft, red stair.
Current state: the courtyard is an open 3-tier well with walls; no interior.
Build (data-only where possible): cover the north half of the courtyard
(z ≈ −104…−110) with white ceiling slabs at y ≈ +0.6, leaving a 1.4 m gap for the
player; put 2–3 `skylight` props in the ceiling; line the walls with lockers
(scenery boxes, pale), red pipe runs, a red steel stair up to the east shelf
(decorative, collider optional), and a couple of white service doors. The route
already passes through the floor-level service door, so checkpoints stay intact.
Acceptance: stand on the courtyard floor → covered ceiling with skylights above,
lockers on the wall, red stair visible; the frame reads as an interior room, not a
well. No route change, all tutorial e2e tests pass.

### P2.2 Orange safety fencing — `fence` prop
Reference: 10:50–11:10 orange railings along roof edges.
Build: instanced fence run (2 m module: two posts + two rails, orange `0xd96a1f`
to `0xe07a26`, roughness 0.5). Level tags: `fence: true` on 4–6 platforms near drop
edges; builder adds a run along the route-facing edge minus the walking gap.
Acceptance: orange reads in 02/06/08 poses; adds no colliders (fail boundaries stay
lethal); triangles +≤1.5 k.

### P2.3 White plant rooms and parapet volumes
Reference: white roof volumes everywhere; near-white 24–27 %.
Build: `plantRoom` prop = white concrete volume 2.4×1.6×2.0 with a door recess, a
vent and a small pipe; place 4–5 on wide roofs in the route's forward view (start,
wall-run landing, summit, courtyard rim, final). Also raise the white roof deck
albedo slightly if the metrics still lag.
Acceptance: `frac_near_white` 12.6 % → ≥16 % on the same 11-pose capture set;
all other acceptance metrics stay in band.

---

## P3 — life and finish

### P3.1 Distant helicopter
Reference: 12:10–12:30 helicopter over the skyline.
Build: a small dark silhouette (body + tail + slow rotor disc) on a slow circular
path 120–180 m out and 40–60 m up, `userData.update(time)` driven from the level
update hook; one blinking red light (emissive, no lights). No collider.
Acceptance: visible in the 11-sky and 01-start poses as a moving speck, not a
distraction; ≤ 400 tris; no per-frame allocation.

### P3.2 Opening fly-in
Reference: 0:31–1:47 and the 1:48 title card.
Build: on first start from the menu only (not `autostart`/`shot`), a 2.4 s camera
ease from 12 m above and 8 m behind the spawn down to the spawn eye position,
skippable on any input; HUD fades in after. Implement in the tutorial start flow,
no physics changes.
Acceptance: menu start shows the roof, then settles at the spawn without a jump;
autostart tests unaffected; skipped entirely at `shot=1`.

### P3.3 Audio "air" band
Reference audio: 2.5–5.6 % of energy above 2 kHz from footsteps/cloth/music; our
ambience is ~0.2 % above 1 kHz and 98.6 % below 500 Hz, i.e. darker than the
reference presentation.
Build: a third wind layer (band-pass 2.4–6 kHz, very low gain, speed-scaled) and a
small lift of the score arpeggio / cloth presence in 800–4000 Hz. Re-render the
offline demo and keep the mix inside the existing loudness targets (−22…−18 LUFS
ambience, no clipping).
Acceptance: `tools/audio-render.mjs` shows above-2 kHz share for ambience-idle
rising from ~0.2 % to ~1–2 % without clipping or a hissy top end; sprint render
still opens with speed.

---

## Status (2026-11-16)

All three phases are implemented on `feat/reference-prologue-kit` (merge pending):
P1.1–P1.4 props, P2.1–P2.3 structure, P3.1–P3.3 life/audio. Measured in
`docs/VISUAL_GAP.md §7`: red accent 2.07 → 2.21 %, near-white 12.58 → 12.36 %
(goal missed — the new white volumes present shaded faces to the camera), audio
air band idle above-2 kHz 0.2 → 1.7 %, 13/13 metrics in band, low-quality draw
calls down to 252. Open follow-up: the white-area gap needs a lighting/exposure
or white-facade pass, not more props.

## Order of work and gates

1. P1.1 → P1.4, commit `feat(levels): reference prop vocabulary`.
2. P2.1 → P2.3, commit `feat(levels): covered service block, fences, white volumes`.
3. P3.1 → P3.3, commit `feat(game): helicopter, opening fly-in, audio air band`.
4. After each phase: `npm run check`, `npm test`, `npm run build`, targeted
   Playwright specs; after the last phase: full e2e, `probe-scene`, the 11-pose
   capture + `image-metrics` profile, and update `docs/VISUAL_GAP.md` /
   `docs/DESIGN.md` / `PLAN.md` with the measured result.
