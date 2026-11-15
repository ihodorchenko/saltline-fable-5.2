# 03 — Content audit: what the GLASSLINE roofs are made of, and what is missing

Branch `project/glassline`, three.js r180. Read-only audit of `src/`; the only file written is this one.
All scratch measurement scripts and extracted video frames live in `/tmp/content-audit/` (not committed).

Method: static read of the level data/builders, **execution** of the data modules in Node (platform/prop/city
plans), a **headless Chromium probe of the built bundle** (scene graph, instancing, materials, triangles,
raycast frame composition), pixel statistics over the current shots vs. reference frames, and frame
extraction from `docs/reference/*.mp4` with ffmpeg. Reproducible recipes in §7.

---

## Headline findings

1. The 203 m route is **26 white boxes** (26 platforms, all `BoxGeometry`, all 0.5 m thick, `tutorial.js:107-274`,
   `build.js:116-128`) with **13 generated detail families instanced to 612 modules + 26 slabs = 638 geometry
   modules** — an average of 24.5 modules per roof, maximum 35 (`build.js:172-250`). Nothing is placed in the middle of a roof by design
   (`build.js:193`, comment: “Rooftop services sit on the edges, never on the route line”).
2. Authored content is **12 props in 5 archetypes over 203 m = 0.59 props per 10 m** (`tutorial.js:19-106`);
   act III (69 m) has 3 props, none of them a new type (`tutorial.js:71-105`). The props have **no colliders**
   (`build.js:422-501` adds no `physics.addBox`, unlike obstacles at `build.js:378-385`).
3. The deck is **91 % structurally empty**: AC/hut/vent/pipe/solar/props/obstacles cover 9.0 % of the 1,357 m² of
   roof surface, and the ±2 m route corridor is 80.9 % empty (measured on a 0.25 m grid, §2.4). Paint — the red
   route — covers **0.51 %** of the deck; the red route is **26 dashes of ~1.5 m = 38.6 m = 19 % of the route length**
   (`build.js:140-146`).
4. The city is a **ring of far boxes, not a canyon**: 137 district buildings (71 glass / 52 white / 14 accent,
   `city.js:336-358`), 1,320 geometric window bands (`city.js:387-437`), 348 backdrop boxes at 181–330 m
   (`city.js:225-263`, `city.js:709-733`). Of the 78 buildings within |x| < 60 m of the route, the **median inner
   facade is 34.7 m away and the median roofline is only 4.3 m above eye height**; there is not one tower over
   100 m. Raycast composition of the average checkpoint view: 17.8 % sky, 28.1 % nearer than 10 m, **15.5 %
   midground (10–40 m)**, 38.6 % farther than 40 m — a flat horizon with a large empty deck, not layered depth.
5. The triangle budget is inverted: the **21 red checkpoint rings are 32,256 of the level's 63,102 triangles
   (51.1 %)**, all city geometry is 23.9 %, and *all* platform architecture + props + obstacles together is
   **12.4 %** (7,848 tris). The polygons spent on the world's roofs are below a 2010 mobile budget; content, not
   performance, is the constraint.
6. The build spends **147 distinct material objects** to dress this (measured in the live scene; 142 under the
   level root) because materials are created per object — 26 per-platform tops (`build.js:111-115`), 21 ring
   materials (`build.js:513`), 20 planter materials (`build.js:476-499`), 12 obstacle materials (`build.js:367-371`).
   Only 8 texture generators exist (`textures.js:356`), one of them (`asphalt`, `textures.js:299-336`) is never used.
7. Foreground readability is broken by construction, not by art direction: no normal/roughness/AO maps anywhere
   (`build.js:31-37` is the only material factory), every object is an unbevelled box, side-concrete seam density
   is stretched per-face (`textures.js:148-153`), the fascia is a separate 0.1 m band floated 0.05 m outside the
   slab (`build.js:173-176`), and there is **one** human-scale object in the whole route: a 1.05 × 0.82 m door
   plane on 6 huts (`build.js:241-250`).
8. The HUD is a 6-cluster instrument panel occupying **4.93 % of a 1920×1080 frame** with 220 characters and 5
   keycaps (`tutorial.js:36-52`, `styles.css:76-159`, measured live), plus **three 6 m wide act-label sprites
   floating over the route at 4.4–5.2 m** (`build.js:39-60`, `build.js:503-508`). The reference tutorial is
   near-HUD-free: one bottom prompt bar, a brief top-left hint card, a 2 px centre dot — no timer, brand,
   progress or act labels.

---

## 1. Inventory

### 1.1 Platforms / roofs

The entire playable surface is 26 boxes, one array in the level data (`tutorial.js:107-274`), built as
`BoxGeometry` with a 6-material array (concrete top, board-formed sides) at `build.js:116-128`.

| # | id | x | y (centre) | z | size w×h×d | top Y |
|---|----|---|-----------|----|-----------|-------|
| 1 | start-roof | 0 | −0.25 | 9 | 10×0.5×6 | 0 |
| 2 | jump-roof | 0 | −0.25 | 2 | 8×0.5×4 | 0 |
| 3 | jump-roof-2 | 2 | −0.25 | −3 | 7×0.5×4 | 0 |
| 4 | slide-roof | 2 | −0.25 | −9 | 7×0.5×6 | 0 |
| 5 | vault-roof | 2 | −0.25 | −15 | 7×0.5×5 | 0 |
| 6 | mantle-roof | 2 | 1.35 | −21 | 8×0.5×7 | 1.6 |
| 7 | wallrun-roof | 2 | 1.35 | −30.5 | 8×0.5×7 | 1.6 |
| 8 | climb-roof | 2 | 3.25 | −38.5 | 8×0.5×7 | 3.5 |
| 9 | climb-landing | −4 | 3.25 | −35.5 | 4×0.5×5 | 3.5 |
| 10 | balance-roof | 2 | 3.25 | −45 | 6×0.5×4 | 3.5 |
| 11 | balance-exit | 2 | 3.25 | −55 | 6×0.5×4 | 3.5 |
| 12 | finish-roof | 2 | 1.45 | −61 | 8×0.5×6 | 1.7 |
| 13 | act2-roof-a | 2 | 1.45 | −68 | 8×0.5×8 | 1.7 |
| 14 | act2-roof-b | 2 | 1.45 | −78 | 8×0.5×8 | 1.7 |
| 15 | act2-high | 2 | 3.25 | −87 | 8×0.5×8 | 3.5 |
| 16 | act2-wallrun-roof | 2 | 3.25 | −96 | 8×0.5×8 | 3.5 |
| 17 | act2-balance-a | 2 | 3.25 | −104 | 6×0.5×6 | 3.5 |
| 18 | act2-balance-b | 2 | 3.25 | −113 | 6×0.5×6 | 3.5 |
| 19 | act2-low | 2 | 1.45 | −122 | 8×0.5×8 | 1.7 |
| 20 | act3-a | 2 | 1.45 | −133 | 8×0.5×8 | 1.7 |
| 21 | act3-b | 2 | 1.45 | −143 | 8×0.5×8 | 1.7 |
| 22 | act3-c | 2 | 1.45 | −153 | 8×0.5×8 | 1.7 |
| 23 | act3-d | 2 | 1.45 | −163 | 8×0.5×8 | 1.7 |
| 24 | act3-e | 2 | 1.45 | −173 | 8×0.5×8 | 1.7 |
| 25 | act3-f | 2 | 1.45 | −183 | 8×0.5×8 | 1.7 |
| 26 | final-roof | 2 | 1.45 | −193 | 10×0.5×10 | 1.7 |

*(all values from `tutorial.js:107-274`; every platform uses `material: 'concrete'`, `tutorial.js:113-272`.)*

| Metric | Value | Source |
|---|---|---|
| Platform count | 26 | `tutorial.js:107-274` |
| Slab thickness | 0.5 m on all 26 | `tutorial.js:112-271` |
| Width range / mean | 4–10 m / 7.58 m | computed from `tutorial.js:107-274` |
| Depth range / mean | 4–10 m / 6.73 m | computed |
| Area range / mean | 20–100 m² / 52.2 m² | computed |
| Total deck area | **1,357 m²** | computed |
| Deck area per route metre | 6.68 m²/m | computed |
| Distinct top Y levels | 3 (0 m ×5, 1.6 m ×2, 1.7 m ×11, 3.5 m ×8) | computed |
| Total vertical range | **3.5 m** over 203 m of route | computed |
| Route length (checkpoint polyline) | **203.04 m** | `tutorial.js:354-523` |
| Route length spawn→finish | 205 m (z +10 → −195) | `tutorial.js:9`, `tutorial.js:524` |
| Checkpoints | 21, mean spacing 10.15 m (range 3–20 m) | `tutorial.js:354-523` |
| Inter-roof gaps | 25; mean 1.4 m; 21 of 25 ≤ 3 m; 8 of 25 ≤ 1 m; max 6 m (the one −9 m reading is `climb-landing`, a side annex at x=−4 overlapping `climb-roof` in z, not a hole) | computed |
| Vertical moves per act | act I climbs 0→1.6→3.5 (two ledges), act II 1.7→3.5→1.7, act III flat | `tutorial.js:143-273` |

The level data supports `scenery` and `platform.color`, but **no scenery is authored** and only the 3-colour
palette is used (`tutorial.js:12`, `build.js:104`, `build.js:388-411`), so every roof is the same ivory deck
(three near-identical palette values: `0xf2eee3`, `0xe1eaea`, `0xd2e1e4`).

### 1.2 Authored props (`props`) — 12 items, 5 archetypes

| Act (z span) | ac | vent | antenna | rail | planter | total | props / 10 m |
|---|---|---|---|---|---|---|---|
| I — Ascent (z +10 … −59, 69 m) | 2 | 1 | 1 | 0 | 2 | **6** | 0.87 |
| II — Descent (z −59 … −126, 67 m) | 1 | 1 | 0 | 0 | 1 | **3** | 0.45 |
| III — Final run (z −126 … −195, 69 m) | 0 | 0 | 1 | 1 | 1 | **3** | 0.43 |
| **Total** | **3** | **2** | **2** | **1** | **4** | **12** | **0.59** |

Sources: prop array `tutorial.js:19-106` (ac-start 20-26, ac-start-right 27-33, planter-start-right 34-40,
vent-jump 41-48, antenna-start 49-55, ac-act2 56-62, vent-act2 63-70, antenna-final 71-77, rail-final 78-84,
planter-start 85-91, planter-act2 92-98, planter-final 99-105); acts at `tutorial.js:14-18`.
Act I owns 50 % of all authored props; act III contains no ac, no vent, no new type.

All 12 sit at the side of the route (lateral |x| = 3.9–5.0 m, `tutorial.js:19-105`), never in the sightline, and
none has a collider (`build.js:422-501` contains no `physics.addBox`; the only colliders are platforms
`build.js:252-257` and obstacles `build.js:378-385`). The player can run through every planter and AC unit.

### 1.3 What each prop builder emits (`build.js:422-501`)

| `type` | count | builder | Meshes per prop | New materials per prop | Triangles per prop | Total meshes | Total tris |
|---|---|---|---|---|---|---|---|
| `ac` | 3 | `build.js:428-438` | **5** (1 body box + 4 slat boxes) | 1 (slat material created per prop) | 60 | 15 | 180 |
| `vent` | 2 | `build.js:439-451` | **2** (12-seg cylinder + cap) | 1 (cap material per prop) | 96 | 4 | 192 |
| `antenna` | 2 | `build.js:452-467` | **5** (mast + 3 bars + beacon sphere) | 1 (MeshBasic beacon per prop) | ~148 | 10 | 296 |
| `rail` | 1 | `build.js:468-475` | **3** (bar + 2 posts) | 0 (shared `propMetal`) | 36 | 3 | 36 |
| `planter` | 4 | `build.js:476-499` | **5** (base + leaf slab + 3 cone tufts) | **5** (base, leaves, 3 tufts) | 66 | 20 | 264 |
| **Total** | **12** | | **52 meshes** | **29** | | **52** | **~968** |

So an authored `ac` prop is **1 box + 4 slats (5 draw calls)**, not one box; a planter is 5 meshes and 5 materials.
This is 29 of the scene's 147 materials created by 12 props. Compare the *generated* per-roof AC unit, which is
a single instanced box (`build.js:195`): the authored vocabulary is more expensive per instance and less
numerous than the auto-generated one.

Relevant gap: the vent is the only cylindrical thing on the deck; a 0.32–0.35 m radius cylinder 1.1 m tall
(`tutorial.js:44-47`, `tutorial.js:65-69`) is the closest thing to a duct in the entire level.

### 1.4 Generated rooftop services (instanced, per platform)

Thirteen families; the service families are all edge-placed by rule (`build.js:172-250`), and each is one
`InstancedMesh` except the slab:
counts below are exact (verified in the live scene graph, matching the static build rules).

| Instanced node | Count | Rule (per platform unless noted) | Source |
|---|---|---|---|
| `platform-fascia` | **104** | 4/roof: 0.34 m tall × 0.1 m, offset 0.05 m outside the slab edge | `build.js:173-176` |
| `platform-curbs` | **104** | 4/roof: 0.09 m tall × 0.13 m, inset 0.08 m | `build.js:177-180` |
| `platform-legs` | **26** | 2 columns 0.4×0.4 m, only if slab > 2.4 m wide and > 3 m above street, every 2nd roof | `build.js:184-191` |
| `platform-ac` | **25** | 1 box 1.05×0.75×0.8 m if roof > 4.4×2.6 m (all but `climb-landing`) | `build.js:195-196` |
| `platform-vents` | **12** | 1 cylinder 0.32 m × 1.1 m on even indices | `build.js:197-200` |
| `platform-huts` | **6** | 1 box 1.7×1.5×2.1 m every 5th roof + the first | `build.js:201-204` |
| `platform-pipes` | **25** | 1 box 0.11×0.11×≤2.8 m lying on the deck edge | `build.js:205` |
| `platform-rail-bars` | **26** | 2 bars 0.07 m square per eligible even roof | `build.js:209-214` |
| `platform-rail-posts` | **130** | 10 posts 0.06 m square per eligible even roof | `build.js:214-224` |
| `platform-solar` | **18** | 2 panels 1.05×0.06×0.72 m per 3rd roof | `build.js:229-239` |
| `platform-doors` | **6** | 1 door plane 0.04×1.05×0.82 m on hut roofs | `build.js:241-250` |
| `route-strips` | **26** | 1 red dash 0.18 × 0.025 × 1.4–1.5 m at every roof centre | `build.js:140-146`, `build.js:278-285` |
| `floor-stripes` | **104** | 4 painted stripes 0.1 m wide, 0.3 m inset per roof | `build.js:159-169`, `floor.js:7-13`, `floor.js:46-66` |
| `contact-shadows` | **43** | fake AO decal plane under services (1.05×0.8, 0.32×0.32, 1.7×2.1…) | `build.js:170-171`, `contact.js:46-83` |
| `platform` slabs | **26** | the deck itself | `build.js:116-128` |
| `platform-edges` | 1 line object | 312 wireframe edge segments (12 per box), only if quality ≠ low | `build.js:132-139`, `build.js:260-266` |

**Total generated modules: 638** (excluding slabs: 612). Per roof: **min 16, max 35, mean 24.5**; the two
35-module roofs are `start-roof` and `act2-roof-a` (largest, and both receive a hut). Distribution by act:
act I 277 modules on 11 roofs (40.1 per 10 m), act II 198 on 8 roofs (29.6), act III 163 on 7 roofs (23.6).
Everything except the route strip and floor stripes is on the roof edge; the interior of a 6–10 m wide deck
has zero generated objects (by design, `build.js:193`).

Quality gating changes content, not only fidelity: `detailed` is false on low quality, dropping contact shadows
and edge lines, and `floorDetail` drops the 104 floor stripes on low/medium (`build.js:93-94`, `build.js:132`,
`build.js:159`, `build.js:268-276`).

### 1.5 Obstacles — 12 boxes (`tutorial.js:275-353`)

| Archetype | Count | Sizes | Source |
|---|---|---|---|
| Slide overhang | 3 | 4×0.5×3 m, floating at 1.85/3.55/3.55 m | `tutorial.js:275-281`, `309-313`, `334-339` |
| Vault block | 3 | 2×0.8×1 m | `tutorial.js:282-287`, `314-319`, `340-345` |
| Wallrun wall | 2 | 0.4×4×10 m | `tutorial.js:288-293`, `320-325` |
| Wallclimb wall | 1 | 8×2.6×0.4 m | `tutorial.js:294-299` |
| Balance beam | 2 | 0.6×0.3×6/7 m, signal red | `tutorial.js:300-307`, `326-333` |
| Finish pad | 1 | 4×0.06×4 m, red, no collider | `tutorial.js:346-352` |

All are boxes; 9 of 12 are painted `0xe6e8e6` (near-white: overhangs, vault blocks, walls), 3 are `0xb51f2a` (2 balance beams + the finish pad, `tutorial.js:304`, `tutorial.js:330`, `tutorial.js:350`).
These 3 walls are the only vertical faces on the route taller than 1.5 m (the wallrun wall is 4 m tall and
10 m long, `tutorial.js:288-293`). No parapet, railing run, catwalk or fence exists as level data.

### 1.6 The city: blocks, facade modules, instancing (`city.js`)

| Element | Count | How it is drawn | Source |
|---|---|---|---|
| District buildings (grid + infill + start/finish edge blocks) | **134** | 3 `InstancedMesh` by style — 1 box each | `city.js:94-166`, `city.js:336-358` |
| Landmark towers | 3 (58/74/64 m) | same 3 instanced groups | `city.js:47-61` |
| **All buildings** | **137** = **71 glass / 52 white / 14 accent** | 13 `InstancedMesh` in the whole city (28 objects incl. signs/spire) | `city.js:336-358`, `city.js:754-771` |
| Roof caps | 137 | 1 instanced slab 0.32 m, 0.92 of footprint | `city.js:361-383` |
| Geometric window bands | **1,320** | 1 instanced plane, 0.2 m tall, per floor per windowed building | `city.js:387-437` |
| Balcony bands | **260** | 1 instanced box 0.42×0.14×(d·0.72), every 3rd floor from floor 2 | `city.js:439-472` |
| Roof service units | **64** | 1 instanced 1.2×1.2×1.1 m box on buildings > 22 m | `city.js:593-620` |
| Green-roof trees | **32** (on 16 roofs) | 1 instanced cone 0.42×1.6 m, 2 per green roof | `city.js:474-503` |
| Skybridges | 4 | 1 instanced box 52–72 m long | `city.js:177-182`, `city.js:622-637` |
| Elevated transit | 5 segments + 3 supports | 2 instanced boxes | `city.js:195-202`, `city.js:505-561` |
| Wayfinding signs | 3 | 3 individual `PlaneGeometry` boards, 10–11×2.8–3.2 m, `FrontSide` | `city.js:204-208`, `city.js:563-591` |
| Central spire | 1 (7 meshes) | tapered base + crown cylinders, 3 torus rings, antenna, beacon | `city.js:169-175`, `city.js:656-707` |
| Backdrop tower ring | **348** | 1 instanced box; 3 rings at radius 210/270/330 m (110+132+120 minus skips) | `city.js:225-253`, `city.js:709-733` |
| Distant skyline | 26 | 1 instanced box, `MeshBasicMaterial` | `city.js:210-221`, `city.js:735-752` |
| Planned street lights | **42 created, never built** | `createCityPlan` returns them; no builder consumes `plan.lights`; `stats.lights` is hard-coded 0 | `city.js:184-193`, `city.js:761` |

Facade detail, per building: 2 window bands per floor; 759 floors total but 18 % of buildings get no windows
(`city.js:121`), leaving 660 windowed floors → 1,320 bands (median building: ~10 bands), 1 balcony every 3 floors, at most 1 roof unit. There is **no facade relief geometry** —
no ledges, mullions, canopies, shopfronts, fire escapes, billboards, AC boxes on walls, or roof-edge railings
on city buildings. The only facade articulation is texture + two thin dark lines per floor. Style families are
one material each (`city.js:313-332`), so the 71 “glass” towers are the same box with the same 512² glass
canvas (`textures.js:209-247`) stretched once per face.

### 1.7 Route language (`guides.js`, `signs.js`, `build.js`)

| Element | Count / geometry | Source |
|---|---|---|
| Checkpoint rings | **21** tori, radius 0.62 m, tube 0.04 m, 12×64 seg (1,536 tris each), **flat on the deck** (+0.08 m), colour-coded red current / green passed / grey upcoming | `guides.js:6-10`, `guides.js:17-20`, `build.js:510-519`, `tutorial.js:227-246` |
| Finish ring | 1 torus radius 1.25 m, tube 0.06 m (1,728 tris) | `guides.js:26-29`, `build.js:521-528` |
| Next-checkpoint beacon | 1 octahedron 0.28 m + ink outline, floats 2.3 m above next checkpoint, rotates | `guides.js:38-62`, `tutorial.js:224-246` |
| Red route paint | **26 dashes** 0.18 × 1.4–1.5 m, one per roof centre = **38.6 m = 19 % of route length** | `build.js:140-146` |
| Start line | 1 box 4×0.025×0.2 m | `build.js:530-533` |
| Finish gate | 2 posts 0.28×2.5 + crossbar 4.5×0.28 m | `build.js:535-553` |
| Finish pad | 4×0.06×4 m red plane (no collider) | `tutorial.js:346-352` |
| Act labels | **3 sprites**, 6 × 0.94 m, y = 4.4 / 5.2 / 5.2 m, always camera-facing | `build.js:39-60`, `build.js:503-508`, `tutorial.js:14-18` |
| City signs | 3 ivory canvas boards, 10–11 m wide, floating at y 5.6/9/13 m | `city.js:204-208`, `city.js:563-591` |
| Painted edge stripes | 104 stripes, 0.1 m wide, inset 0.3 m — steel grey, 5.0 % of deck area | `floor.js:7-13`, `build.js:159-169` |
| Sign plate language | ivory plate + ink type + 8 px signal-red top rule | `signs.js:6-28` |

Guidance load: a runner sees a red ring every ~10.2 m, a 1.4 m dash at each roof centre, and the diamond
beacon above the next checkpoint. Between dashes there are **8–10 m of unmarked white deck** with no wall
marks, arrows, edge paint or route ribbon. The emissive red route material is shared by only the 26 dashes
(`build.js:63-70`); rings use plain `MeshBasicMaterial` red (`build.js:513`), so “route” is 26 dashes and 21
floor circles, not a continuous line as `docs/DESIGN.md:140-141` claims.

### 1.8 Characters (`characters.js`) — 2 procedural rigs

| Rig | Mesh parts | Joints | Shadows | Source |
|---|---|---|---|---|
| First-person courier | **13 meshes**: 2×(shoulder capsule, forearm capsule, hand sphere) + 2×(hip capsule, shin capsule, shoe box) + 1 tracker cylinder | 8 pivots (shoulders, elbows, hips, knees) | none (`castShadow = receiveShadow = false`, `frustumCulled = false`) | `characters.js:64-210`, `characters.js:51-59` |
| Mentor NPC | **14 meshes**: torso cylinder, head + hair spheres, pack box, 2×(upper/fore arm capsules), 2×(hip/knee capsules), 2 shoe boxes | arms/legs as pivots only | none | `characters.js:215-322` |
| Materials | 8 definitions, constructed twice = **16 material objects** (suit, cloth, skin, accent red, jacket, pack, dark, shoe) | — | — | `characters.js:12-33` |

No skinned meshes, no external models (`characters.js:1-3`, `docs/DESIGN.md:157-161`). The courier is attached to
the camera (`characters.js:156-158`), with the arm group at `(0, −0.42, −0.42)` (`characters.js:71-74`); its
hands sit ~0.8 m below eye height at 0.42 m forward — ~62° below the view axis against a 37.5° half-FOV
(`player.js` FOV 75; reference FOV and reticle in `docs/REFERENCE.md:62-64`, `120-122`), so **no hands or arms appear in frame** (confirmed in every
`artifacts/review/10-*.png` / `docs/visual-gap/shots/current-*.png`). The mentor runs ahead for at most 7 s or
until passed, then hides (`characters.js:316-318`, `tutorial.js:187-189`, `tutorial.js:721`), after which the
world contains **zero characters** — no crowd, birds, traffic, laundry or NPCs anywhere (`characters.js` is the
only character source in `src/`).

### 1.9 HUD elements (`tutorial.js:28-55`, `styles.css:64-159`)

| Cluster | Contents | Default visibility | Measured area at 1920×1080 | Source |
|---|---|---|---|---|
| `.gl-hud__left` | brand `GLASSLINE`, sub `ROOFTOP INDUCTION`, act line, stage line `01 / 21 · MOVEMENT`, progress bar, `00 / 20 CHECKPOINTS · 0 RESPAWNS` | always in play | 362×139 px = **2.42 %** | `tutorial.js:37-43`, `styles.css:86-100` |
| `.gl-hud__right` | `TIME 00:00`, `BEST --:--`, `SPLIT --:--` | always in play | 190×95 px = **0.87 %** | `tutorial.js:44-48`, `styles.css:101-110` |
| `.gl-hud__prompt` | one contextual instruction with keycaps | always (empty when no prompt) | 329×39 px = 0.62 % | `tutorial.js:49`, `styles.css:114-122` |
| `.gl-hud__help` | `R retry · BACKSPACE restart · click view to look` | always | 355×19 px = 0.32 % | `tutorial.js:50`, `tutorial.js:176-183`, `styles.css:123-126` |
| `.gl-toast` | checkpoint/respawn title + sub, 2.2 s | transient | 0.65 % when on | `tutorial.js:51`, `tutorial.js:254-261`, `styles.css:127-135` |
| `.gl-dispatch` | teal-tagged “DISPATCH” radio caption, 7 s | transient (start only) | 414×33 px = 0.65 % | `tutorial.js:52`, `tutorial.js:166-175`, `styles.css:143-157` |
| **Total** | **6 clusters / 220 characters / 5 `<kbd>` keycaps** | | **4.93 % of frame** | measured live via DOM rects |

Also part of the shell: the title/continue menu with SETTINGS, CONTROLS and a `LEVEL INSPECTOR` link
(`menu.js:180`, `menu.js:356-364`), and an opt-in perf overlay on `?stats=1` / F3 (`perf.js:1-74`) — not part
of the default HUD. There is **no reticle/crosshair and no hands** anywhere (`grep -rn "reticle|crosshair" src/`
returns only CSS `cursor:` properties, `menu.js:73-75`), while the reference tutorial has a small centre dot
(`docs/REFERENCE.md:64`, `docs/REFERENCE.md:122`).

---

## 2. Measured density

### 2.1 Authored props

| Metric | Value |
|---|---|
| Props per 10 m of route | **0.59** (12 / 203.04 m) |
| Props per act per 10 m | 0.87 / 0.45 / 0.43 |
| Distinct prop archetypes | **5** (`ac`, `vent`, `antenna`, `rail`, `planter`) |
| Distinct generated detail families | 13 (fascia, curb, legs, AC, vent, hut, pipe, rail bar/post, solar, door, route strip, floor stripe, contact decal) |
| Total distinct prop/detail archetypes in the route | **14** |
| Prop meshes / triangles / materials | 52 / ~968 / 29 new |
| Props with collision | **0 of 12** |
| Authored props within 8.5 m of spawn | 6 — every act-I prop (`tutorial.js:20-55`, `85-91`) |
| Props added in act III (69 m) | 3, all reused types (`tutorial.js:71-105`) |

### 2.2 Geometry modules per roof

| Metric | Value |
|---|---|
| Modules per roof (all 26, high quality) | **min 16 / mean 24.5 / max 35** (35 = `start-roof`, `act2-roof-a`) |
| Total instanced modules | **638** |
| Generated service modules in the roof interior (outside a 1 m edge band) | **0** — all services are edge-anchored (`build.js:193-206`); only the route strip and floor stripes reach the middle |
| Modules per 10 m by act | act I 40.1, act II 29.6, act III 23.6 |
| Instanced draw calls for all of the above | 13 meshes (`build.js:297-362`, `build.js:413-420`) + 26 slab meshes |

### 2.3 Materials and textures

| Metric | Value | Source |
|---|---|---|
| Distinct `THREE.Material` objects in the live scene | **147** | headless probe, `scene.traverse` |
| … under the level root | 142 | probe |
| Distinct geometries / textures | 155 / 45 (renderer stats: 144 geos, 52 tex) | probe |
| Texture generators (source of all surface look) | **8** (concrete, side, facade, glassFacade, roof, metal, asphalt, red) | `textures.js:356` |
| Generators actually used by the level | 7 — `asphalt` is dead code | `textures.js:299-336`; grep finds no `asphalt()` call |
| Texture map types (normal / roughness / AO / metalness) | **0 — albedo only** | `build.js:31-37`, `textures.js:85-93` |
| Material inflation from per-object creation | 26 platform tops (`build.js:111-115`) + 21 rings (`build.js:513`) + 20 planter parts (`build.js:476-499`) + 12 obstacles (`build.js:367-371`) + 3 AC slats (`build.js:433`) + 2 vent caps (`build.js:448`) + 2 antenna beacons (`build.js:463-465`) = **86 of 147** | code + probe |
| Distinct concrete top patterns | **3** — the texture cache is keyed by colour, and the palette has 3 colours, so 26 roofs repeat 3 stain patterns (`textures.js:109-135`, `tutorial.js:12`) | code |
| Draw calls / triangles rendered | **437 calls / 67,095 tris** (headless probe, 960×540, high; the repo's own 1920×1080 capture reports 415 calls / 63,853 tris in `docs/visual-gap/shots/current-capture.json`) | probe |

### 2.4 How much of a roof surface is empty

Measured on a 0.25 m grid over all 26 decks (1,357 m², 21,712 cells), marking every world-space footprint from
`build.js:172-250` (services, curbs, rails, solar, huts, doors, stripes) plus all authored props and obstacles:

| Coverage tier | Fraction of deck |
|---|---|
| Structural clutter (AC, hut, vent, pipe, solar, planter, AC/antenna props, obstacles — no trim) | **9.0 %** |
| All raised objects incl. 0.13 m curbs, 0.07 m rails, 0.11 m pipes | 22.2 % |
| **Structurally empty deck** | **91.0 %** |
| Route corridor (±2 m around the route line) | **80.9 % empty** |
| Red route paint | **0.51 %** of deck (6.95 m²) |
| Painted edge stripes | 5.0 % of deck (68.2 m²) |

For comparison, the reference tutorial roof in any given 10 m stretch carries dozens of objects: fan banks,
ducts, parapets, railings, crates, barrier frames, signage, wall-mounted pipes and cables (see §3.1).

### 2.5 Triangle budget vs. content

Level root = **63,102 triangles / 177 meshes** (live probe; scene total 64,498 with the courier rig 1,384 and
the engine ground plane 12):

| Content group | Triangles | Share of level |
|---|---|---|
| **21 checkpoint rings** | **32,256** | **51.1 %** |
| City (all 137 buildings + 348 backdrop + windows + balconies + units + trees + spire + transit) | 15,080 | 23.9 % |
| Platform build (26 slabs + all 13 instanced families) | 6,736 | 10.7 % |
| Sky dome | 1,472 | 2.3 % |
| Floor stripes | 1,248 | 2.0 % |
| All props (52 meshes) | ~968 | 1.5 % |
| Contact decals | 86 | 0.1 % |
| Obstacles (12 boxes) | 144 | 0.2 % |
| Remainder: finish ring (1,728), mentor rig (~1.4 k), start line, gate, act sprites, uncategorised | 5,112 | 8.1 % |

The 1,536-triangle torus per checkpoint (`guides.js:6-8`) is the single most expensive object family in the
level, and 21 identical copies of it are submitted as 21 separate draw calls with 21 separate materials. The
whole rooftop vocabulary — every slab, fascia, curb, AC, hut, rail, solar panel, prop and obstacle — costs
**7,848 triangles (12.4 %)**, i.e. the scene is nowhere near triangle-bound for content: it is empty because
the content was never authored, not because it could not be afforded.

### 2.6 Screen-space detail: current build vs. reference

Identical treatment of 11 current shots (`docs/visual-gap/shots/current-*.png`, HUD-free, 1920×1080; plus
`artifacts/glassline-tutorial.png`, `artifacts/glassline-city-generated.png`, `artifacts/review/09-hud-start.png`
and `artifacts/review/10-start.png` inspected visually) and 54
gameplay frames of the reference tutorial (t=1:40–5:15, pillarbox-cropped, 4 s apart), both downscaled to
640×360:

| Metric (mean) | GLASSLINE | Mirror's Edge tutorial | Ratio |
|---|---|---|---|
| Pale pixels (V>0.72, S<0.14) | **66.5 %** | 35.3 % | 1.9× more empty pale screen |
| Dark pixels (V<0.32) | **1.7 %** | 11.8 % | 6.8× fewer dark masses |
| Edge pixels (gradient >0.06) | **7.8 %** | 16.5 % | 2.1× less detail energy |
| Mean gradient | 0.0164 | 0.0326 | 2.0× |
| Mean saturation | 0.100 | 0.329 | 3.3× (route red is the only saturated thing) |
| Colourfulness (Hasler–Süssstrunk) | 0.087 | 0.261 | 3.0× |

Caveat: the reference is a 2008 game with deliberately high-contrast art direction, HUD tooltips and player
hands in frame; these are screen-space proxies, not targets. They do show that the *screen* is dominated by
pale, low-gradient, empty surfaces in GLASSLINE — which is the content gap described below.

### 2.7 Composition: the canyon question

Raycast probe from all 21 checkpoints, eye at `checkpoint.pos[1] + 1.65`, looking along the route yaw, 64×36
rays/frame (2,304 rays each), sprites/lines/HUD-like overlays excluded:

| Checkpoint | Sky % | <10 m % | 10–40 m % | >40 m % | median hit (m) | deck % | city % | other % |
|---|---|---|---|---|---|---|---|---|
| start | 18.7 | 28.0 | 27.9 | 25.4 | 30.7 | 25.1 | 50.8 | 5.4 |
| jump | 17.8 | 31.8 | 24.8 | 25.6 | 32.3 | 15.8 | 48.3 | 18.1 |
| slide | 20.2 | 32.3 | 19.9 | 27.6 | 27.3 | 27.5 | 45.7 | 6.6 |
| vault | 19.6 | 28.1 | 19.1 | 33.2 | 37.1 | 29.5 | 48.6 | 2.4 |
| mantle | 20.7 | 37.2 | 13.0 | 29.1 | 12.5 | 20.5 | 35.3 | 23.4 |
| wallrun | 20.1 | 61.8 | 0.4 | 17.7 | 5.7 | 31.9 | 17.7 | 30.4 |
| wallclimb | 21.6 | 12.1 | 5.0 | 61.3 | 68.8 | 15.2 | 63.1 | 0.1 |
| balance | 20.4 | 6.2 | 16.2 | 57.2 | 63.7 | 5.9 | 70.6 | 3.1 |
| drop | 16.5 | 4.8 | 25.5 | 53.2 | 57.4 | 9.7 | 73.0 | 0.8 |
| act1-end | 14.8 | 14.7 | 22.9 | 47.6 | 53.7 | 17.0 | 67.6 | 0.7 |
| act2 | 14.9 | 31.5 | 10.9 | 42.7 | 41.0 | 32.3 | 51.7 | 1.0 |
| slide2 | 15.1 | 27.9 | 12.0 | 45.0 | 42.7 | 27.8 | 54.6 | 2.6 |
| vault2 | 15.6 | 27.2 | 18.9 | 38.3 | 38.6 | 27.7 | 55.6 | 1.0 |
| mantle2 | 18.1 | 36.3 | 16.3 | 29.3 | 32.5 | 33.7 | 43.4 | 4.9 |
| wallrun2 | 24.2 | 36.6 | 7.2 | 32.0 | 30.1 | 31.9 | 37.8 | 6.2 |
| balance2 | 21.6 | 11.5 | 18.6 | 48.3 | 53.5 | 9.4 | 65.6 | 3.4 |
| drop2 | 16.4 | 32.0 | 9.8 | 41.8 | 31.5 | 33.9 | 49.7 | 0.0 |
| final-a | 14.5 | 32.2 | 6.2 | 47.1 | 53.2 | 33.5 | 51.5 | 0.5 |
| final-b | 17.1 | 31.7 | 6.4 | 44.8 | 41.5 | 33.9 | 48.9 | 0.1 |
| final-c | 15.1 | 31.7 | 23.8 | 29.4 | 35.1 | 33.5 | 51.1 | 0.3 |
| finish | 11.5 | 34.7 | 20.6 | 33.2 | 30.2 | 31.8 | 53.7 | 3.0 |
| **Average** | **17.8** | **28.1** | **15.5** | **38.6** | **39.0** | **25.1** | **51.6** | **5.4** |

Reading: on average **only 15.5 % of the frame is midground (10–40 m)** — the layer where a rooftop canyon
lives — while 38.6 % is >40 m (mostly pale boxes and the 181–330 m backdrop ring) and 28.1 % is <10 m, almost
all of it the deck itself. The deck alone is 25.1 % of every frame; with sky (17.8 %) that is **43 % of the
frame carrying no city content at all**. The two checkpoints with the largest midground (slide2 23.8 %,
drop 25.5 %) are the ones facing the 4 m wallrun walls, not the city.

City-side numbers that explain this (all from `createCityPlan`, executed in Node):

| Metric | Value | Source |
|---|---|---|
| Buildings within \|x\| < 60 m of the route line | 78 of 137 | computed from `city.js:94-166` |
| Inner-facade distance from route line | **median 34.7 m**, p25 20.9 m, min 15.8 m, max 54.4 m | computed |
| Building roofline above route eye height (1.65 m) | **median +4.3 m**, min −10.9 m, max +54.4 m | computed |
| Buildings taller than 60 m / 100 m | 11 / **0** | computed from `city.js:106`, `city.js:47-61` |
| Near-route building heights (inner band, \|x\|<44) | 8–26 m, i.e. tops −10…+8 m: mostly **below** route level | `city.js:105-106` |
| Backdrop ring distance / tops above eye | **181–330 m** / +22…+88 m | `city.js:225-263` |
| Backdrop count | 348 | `city.js:709-733` |
| Median distance of first geometry in frame | 39.0 m | raycast probe |

So the route is not a canyon: it is an open plateau with a shallow, low-rise perimeter (median roofline 4.3 m
above the player's eye at 34.7 m), and all vertical enclosure is pushed to 181–330 m. The frames confirm it:
the horizon band is a pale, low-contrast wall of boxes at roughly 15° elevation, while the reference frames show
vertical faces 2–15° from the camera at 10–40 m with their tops often out of frame.

---

## 3. Gap analysis against a Mirror's Edge 2008 tutorial roof

### 3.1 What the reference roof is actually made of

Sampled frames (`docs/reference/Прохождение Mirrors Edge - Часть 1 - Обучение …mp4`, frames from 2:00–4:35,
54 frames at 4 s plus 5 s detail sheets 2:00–4:35; contact sheets in `/tmp/content-audit/ref/`; timestamps
below are approximate) show the following recurring families, in order of screen area:

1. **Parapets and split roof bays** — raised white/steel walls bounding the roof, sometimes 1 m high with
   coping, splitting a large roof into corridors (visible ~2:10, 2:30, 3:40).
2. **Large circular HVAC fan banks** — 4+ fans of ~1.5–2 m diameter in one cluster, with concentric grilles
   and housings, plus condenser boxes (~2:10–2:30, ~3:30).
3. **Ducts, blue pipe runs and wall-mounted red pipes** with flanges, clamps and brackets (~3:20–4:10).
4. **Corrugated metal walls/panels** in saturated blue and signal red, plus yellow rebar-like railings and
   scaffold frames (~3:40–4:30).
5. **Stair huts / roof access volumes** with doors, boxes, pallets, pipes on the walls (~2:05, 3:05).
6. **Billboards and banners** on nearby facades and rooftops ("The Eden…", "Pirandello"), plus painted
   wayfinding marks (~2:55, 4:20).
7. **Blue glass towers directly abutting the roof** — a facade face fills 30–50 % of the frame at 5–15 m.
8. **Cranes, chains, cables and a red clothesline** crossing gaps in the foreground (~3:50–4:20).
9. **Roof surface**: membrane joints, dirt streaks, safety edge paint, exposed fixings; slab thickness and
   coping visible at every edge and opening.
10. **HUD**: only a bottom-centre prompt bar (key glyph + action); a brief top-left hint card at the start; a
    tiny centre dot. No timer, brand, progress, checkpoint count or act labels.

### 3.2 Family-by-family gap table

Legend: **◐ present but reads wrong**, **✗ absent** (no family in this list is fully present at reference
fidelity). “Where” cites the closest current code.

| # | Family | State | What exists now | Why it matters for the read | Where |
|---|---|---|---|---|---|
| 1 | **Parapet + coping** | ✗ | 0.09 m curb strip and a separate 0.34 m fascia band; nothing solid above ankle height at the edge (only 0.72 m thin rails on half the roofs) | Silhouette and roof-edge law; at 0–5 m it is the object that tells you this is a *roof*, and it establishes safe/unsafe without a rail; it is also the cheapest foreground occluder that frames the route | `build.js:172-180`, `floor.js:7-13` |
| 2 | **Stair hut / access tower** | ◐ | 6 boxes 1.7×1.5×2.1 m (top 0.15 m **below eye level**) with a 0.04 m door plane | Vertical mass on the deck; silhouette against sky; a door is the human scale cue (1.05 m tall here); creates a corner to round at speed | `build.js:201-204`, `build.js:241-250` |
| 3 | **Skylights / roof openings** | ✗ | none | Reads as a roof *of a building* rather than a floating deck; gives the eyes a hole with interior darkness (depth layering) and a light/edge contrast | — |
| 4 | **Ducts / round pipe runs** | ✗ | 1 flat box 0.11×0.11 m lying on the edge per roof; 2 cylinder props | Diagonal foreground shapes; route guidance when placed along the run; scale cue through flange spacing | `build.js:205`, `tutorial.js:41-48` |
| 5 | **AC clusters / fan banks** | ◐ | 1 box 1.05×0.75×0.8 m per roof (25) + 3 authored AC props with 4 flat slats | Midground massing and “lived-in city”; fan grilles are the single most recognisable rooftop object at 2–15 m; clusters build compositional rhythm | `build.js:195-196`, `build.js:428-438` |
| 6 | **Vent stacks** | ◐ | 12 cylinders 0.32 m × 1.1 m with a flat cap | Silhouette punctuation against sky; a row of varying-height stacks gives a roofline rhythm and scale | `build.js:197-200`, `tutorial.js:41-48` |
| 7 | **Cables / wires / chains** | ✗ | none anywhere in `src/` | Depth layering *par excellence*: a cable crossing the frame at 2–5 m instantly separates foreground from midground, and spans across gaps make the gap readable | grep: 0 matches for cable/wire/fence |
| 8 | **Construction kit** (scaffold, tarps, barriers, pallets, crates, yellow boxes) | ✗ | none | Turns “empty roof” into “city under construction”; provides hard-edged colour blocks (yellow/red) as foreground interest and route-blocking geometry; matches 2008 art direction | — |
| 9 | **Crane** (foreground/midground) | ✗ | none; the 348-box backdrop has no masts | Vertical landmark and sky-breaking silhouette; a crane gives scale of 10s of metres without needing terrain | `city.js:225-263` |
| 10 | **Billboards / banners / painted ads** | ✗ | 3 floating ivory sign planes in mid-air at y 5.6/9/13 m, 10–11 m wide | The signature “city canyon” element: facades read as inhabited and scale is set by advert size; also a legitimate use for saturated colour | `city.js:204-208`, `city.js:563-591` |
| 11 | **Facade-mounted signage / wayfinding** | ◐ | 3 city signs + 3 act sprites; the act sprites are 6 m wide and float 4.4–5.2 m over the route, in the sightline | Route guidance and world-building; current sprites occlude the route and read as UI, not place | `build.js:39-60`, `build.js:503-508` |
| 12 | **Glass-walled volumes / glass parapets** | ✗ | city facades are glass-textured boxes; no glass object on a roof | A glass box on a roof reads as luxury/office and adds a semi-transparent layer (depth layering) plus specular highlight in a matte scene | `city.js:313-321` |
| 13 | **Planted terraces (near route)** | ◐ | 4 planter props (base + leaf slab + 3 cones) + 32 distant roof trees | Soft, organic counterpoint to hard geometry; a terrace is a place to be, i.e. “lived-in”; foliage gives scale and colour variance without breaking the white palette | `build.js:476-499`, `tutorial.js:34-40`, `city.js:474-503` |
| 14 | **Street furniture at roof level** (bench, lamp, bollard, bin) | ✗ | none | Human-scale props at 0–3 m teach the player how big 1 m is; they also give the deck a foreground object inside the playable corridor | — |
| 15 | **Antennas / dishes / masts** | ◐ | 2 authored antennas (4.6 m and 5 m) + 1 spire antenna | Silhouette against sky, landmark for orientation; a cluster reads as a real roof, two isolated masts do not | `build.js:452-467`, `tutorial.js:49-55`, `71-77` |
| 16 | **Ladders / hatches / drains** | ✗ | only baked-in 18×10 px grates in the roof texture (`textures.js:264-272`) | Micro-scale fixtures are the 0–5 m readability kit: they say “maintained building” and give the eye a landing point while running | `textures.js:264-272` |
| 17 | **Fixings, joints, expansion strips** | ✗ | one albedo seam grid at 1 m / 4 m (`textures.js:122-131`); no geometry | The difference between “textured plane” and “slab”; bolt plates and joint shadows are what the 0–2 m view is made of | `textures.js:109-135` |
| 18 | **Weathering / stains / puddles / scuffs** | ◐ | 3 radial baked stains at 5–6 % alpha per 512² tile, invisible below ~2 m | Age and contact: dirt accumulates at parapets, runs below AC units, pools at joints; this is what makes a surface read as used | `textures.js:119-121`, `textures.js:261-263` |
| 19 | **Railings with real profiles** (kick plate, tube, mounts) | ◐ | 26 bars + 130 posts, all 0.06–0.07 m square, no kick plate, no top rail profile | Safety law and foreground rhythm; a proper railing line is one of the strongest perspective guides | `build.js:208-226` |
| 20 | **Awnings / canopies / sunshades / umbrellas** | ✗ | none | Breaks the horizon with soft shapes; gives shadow patterns on the deck (the sun is the only light event in the current build) | — |
| 21 | **Water tanks / chimneys / boiler flues** | ✗ | none | Big vertical cylinders/boxes on a roof are the classic skyline read; none exist | — |
| 22 | **NPCs / life** (birds, laundry, crowds, vehicles) | ✗ | 1 mentor for ≤7 s, then nothing; city has no people/vehicles/anim | “Lived-in city” is mostly this; motion draws the eye and gives scale reference without geometry cost | `characters.js:316-318` |
| 23 | **Street-level depth** | ✗ | abyss plane at −150 m (`city.js:297-305`); buildings extend to it | A visible street layer (cars, lights, crosswalks) makes the drop read as a real height rather than a white void | `city.js:297-305` |
| 24 | **Roof-level shadow/AO contact** | ◐ | 43 flat contact decals under generated services only; authored props/obstacles have none | Contact shadows are the cheapest “weight” cue; a floating AC box reads as pasted on | `build.js:170-171`, `contact.js:46-83` |

### 3.3 Composition verdict: canyon vs. flat horizon

- **Reference**: close vertical faces dominate the frame edges (buildings 5–40 m away, tops often out of frame),
  roofs are split into bays by parapets, and the midground is full of hardware at 2–30 m. Foreground (0–5 m)
  always contains something: hands, a railing, a duct, a cable, a parapet top.
- **GLASSLINE**: the deck plane is 25.1 % of the frame; 43 % of the frame is deck+sky; midground is 15.5 %;
  38.6 % of the frame is >40 m away. Median first-hit distance 39 m. The nearest building faces are a
  median 34.7 m away with rooflines just 4.3 m above eye height; 0 of 137 buildings exceed 100 m. The result
  is the “flat horizon of distant boxes” described by the owner, quantified: there is no near-field vertical
  enclosure and almost nothing between the player and the distant ring.

---

## 4. Prioritized additions

Instances are for the existing 203 m / 26-roof route. “Implement at” names the exact place to extend; none of
these require touching player code. Effort is engineering hours including placement pass and look-dev, not
including texture painting time unless stated.

| # | Archetype | What it adds to the read | ≈ Instances on 203 m | Implement at | Effort (h) | Impact/hour |
|---|---|---|---|---|---|---|
| 1 | **Parapet + coping + drip profile** (replace the 0.09 m curb; integrated slab edge with fascia return) | Roof-edge law, silhouette against sky, safe/unsafe read, close-range occluder, slab thickness at 1–3 m | 26 roofs, **~744 m of deck perimeter** (2·(w+d) summed) | `build.js:172-180` (fascia/curb block → new `parapet` instanced family), `floor.js:7-13` (stripe inset adapts) | 10 | **very high** |
| 2 | **Service cluster generator**: fan banks (4–8 circular grilles), condenser banks, duct stubs, refrigerant lines | Midground massing, the single most legible “roof” object at 2–20 m, compositional rhythm along the route | 26 clusters (1–2/roof), ~230 modules | new builder after `build.js:206`; geometry cached per archetype; instanced per part | 14 | **very high** |
| 3 | **Continuous route ribbon + edge paint + wall marks** (replace 26 dashes) | Route guidance once the HUD is reduced; turns a 19 %-painted route into a continuous red thread; uses gaps and walls | 203 m ribbon + 25 gap edges + 12 wall arrows | `build.js:140-146`, `build.js:278-285`; strip geometry as a single extruded ribbon per roof plus connector quads | 4 | **very high** |
| 4 | **Stair hut / access tower** (3.2 m tall, door, roof lip, wall pipes, small sign) | Vertical mass on the deck, silhouette, 1 m-scale door, corner to round | 10–12 (2–3 per act; act III needs 4) | `build.js:201-204`/`241-250` (replace `hut` family), data in `tutorial.js:19-106` as a `props` type | 10 | **high** |
| 5 | **Cables, wires, chains, spans** between roofs/parapets, incl. a red clothesline | Depth layering at 2–8 m; makes gaps read; foreground interest; route-adjacent motion | 30–40 spans (1–2 per gap, 8 over the route) | new instanced family (catenary tube geometry), placed from platform endpoints in `build.js` after `build.js:226` | 6 | **high** |
| 6 | **Signage**: facade billboards (8–12 m), rooftop hoardings, banners, painted wayfinding, plus wall-mounted act plates replacing the 6 m sprites | Canyon framing, lived-in city, saturated colour accents, legitimate route guidance | 12 billboards + 8 banners + 3 act plates + 20 painted marks | `city.js:563-591` (extend sign system to attach to facades), `build.js:39-60` / `503-508` (replace sprite labels) | 8 | **high** |
| 7 | **0–5 m readability kit**: bolt plates, expansion joints, anchor plates, seams, drains, hatch covers, edge chamfers, grime decals | Turns every surface from a textured plane into manufactured slab; contact edges; the difference between blockout and build | ~600 fixings + 200 joint strips + 200 decals | new instanced meshes in `build.js` after `build.js:169`; decal atlas in `textures.js`; chamfer via `BoxGeometry` replacement helper | 12 | **high** |
| 8 | **Construction kit**: scaffold tower, tarps, barriers, pallets, crates, yellow maintenance boxes, 2 cranes | Narrative (roof under work), foreground colour blocks, occlusion, 2008-appropriate yellow/red accents | 24–30 props + 2 cranes (midground) + 1 scaffold on 3 roofs | new `props` types in `build.js:422-501`; crane as instanced `city.js` object | 14 | **high** |
| 9 | **Skylight / sawtooth / glass volume family** | Roof-as-building read, interior darkness for depth layering, specular highlight in a matte scene | 10–14 (skylights) + 6 glass boxes | new instanced families in `build.js`; glass material from `city.js:313-321` recipe | 10 | medium-high |
| 10 | **Weathering pass**: drip streaks under edges/AC, oil patches, puddles, patch repairs, tire scuffs, weeds in joints | Age and contact at 0–5 m; cheap variation that breaks the “same 3 textures” repetition | 300–500 decals | decal atlas in `textures.js`, one instanced plane mesh in `build.js`; scatter from prop/parapet anchors | 8 | medium-high |
| 11 | **Near-facade detail**: floor ledges, mullion strips, parapet caps, wall AC units, fire escapes, billboard frames | Turns the 78 near buildings from white boxes into architecture; adds the missing midground verticals | 78 near buildings × 1–2 treatments | `city.js:361-472` (add instanced families), heights in `city.js:105-106` | 12 | medium-high |
| 12 | **Planted terraces**: raised beds with soil, weeds, shrubs, 2–4 m trees, planters at route edge | Organic counterpoint, colour variance, “place to be”, scale cue | 6–8 terraces + 20 planters | extend planter builder `build.js:476-499`; tree archetype from `city.js:489-503` | 8 | medium |
| 13 | **Roof railings upgrade**: kick plate + tube profile + glass balustrade + yellow temporary barrier variants | Perspective guide, safety read, foreground rhythm | 20 runs, 120 m | `build.js:208-226` | 6 | medium |
| 14 | **Ladders, hatches, drain grates, pipes as route guidance** (hand-over-hand opportunities) | Micro-route grammar, surface scale, encourages traversal | 30 (ladders 8, hatches 10, drains 12) | new prop types `build.js:422-501`; hatch as flush deck detail | 4 | medium |
| 15 | **Sculpted city canyon**: raise 12–16 near buildings to 40–90 m and pull 8 within 12–20 m of the route | Directly fixes §2.7: midground rises, horizon disappears, sky becomes a slot | 12–16 buildings | `city.js:105-106`, `city.js:94-131`; adjust `corridor` in `tutorial.js:13` if needed | 6 | medium-high |
| 16 | **Antenna/dish clusters** | Skyline punctuation, orientation landmarks | 8 clusters (3–5 masts, 2 dishes) | `build.js:452-467` | 3 | medium |
| 17 | **Street-life layer**: abyss replaced/augmented with a lit street grid, cars/lights at −150 m | Gives the drop a real floor; makes height legible | 1 layer (already coded as abyss) | `city.js:297-305`, plus instanced emissive strips | 4 | medium |
| 18 | **Birds / laundry / distant animation** | Motion and life; cheapest “alive” signal | 2 flocks (30 birds), 3 laundry lines | `characters.js` pattern or a new ambient module | 5 | medium |
| 19 | **In-world act signage restyle** (1.2–2 m wall plates at act boundaries instead of 6 m floating sprites) | Removes UI-in-world occlusion; adds place-specific wayfinding | 3 plates | `build.js:39-60`, `503-508` | 2 | medium |
| 20 | **Roof-surface material variation** (rubber membrane, gravel strip, metal flashing, painted bay numbers) | Breaks the “3 palette colours × 1 concrete texture” monotony; creates safe/unsafe area language | 26 roofs | `textures.js:109-135` + per-roof material choice in `build.js:104-115` | 6 | medium |

**Top 8 by visual impact per hour** (ranked):

1. **Continuous route ribbon + edge paint + wall marks** — 4 h, fixes guidance immediately and enables HUD removal.
2. **Parapet + coping + slab-edge profile** — 10 h, changes the silhouette and close-range read of all 26 roofs.
3. **Cables/wires/spans** — 6 h, buys foreground/midground layering for very little geometry.
4. **Service cluster generator (fan banks + ducts)** — 14 h, the largest amount of “real rooftop” mass per hour after the parapet.
5. **Signage/billboards + act-plate restyle** — 10 h combined, canyon framing + removes the floating 6 m sprites.
6. **0–5 m readability kit (fixings/joints/chamfers/contact decals)** — 12 h, converts every surface from plane to slab; also fixes the “floating prop” problem (props currently have no contact decals).
7. **Stair hut / access tower** — 10 h, first true vertical deck object; adds silhouette + 1 m scale.
8. **Near-facade detail + canyon height adjustment** — 18 h combined, closes the flat horizon quantified in §2.7.

Together the eight ranked additions are ≈ 82 h and would roughly double the authored architectural vocabulary while adding
only ~35–45 k triangles (current scene: 64.5 k tris at 437 draw calls) and ~12 draw calls if instanced per
archetype — and merging the 21 per-checkpoint ring materials alone would give 20 of those calls back.

---

## 5. Foreground readability kit

### 5.1 What makes a roof read as real at 0–5 m

At 0–5 m the eye reads **edges, joints, fixings and weathering**, in that order — not colour or texture.

1. **Slab thickness and edge profile** — a visible 0.25–0.5 m slab edge with a chamfer or drip groove and a
   darker underside; at eye height this is the strongest “this is a building” cue. A separate thin band reads
   as paint, not structure.
2. **Parapet/fascia system** — a raised edge (0.3–1.1 m) with a coping cap that oversails the wall by 2–4 cm
   and casts its own thin shadow line. This is the single most repeated silhouette in the reference.
3. **Joints at 0.6–2 m** — recessed panel joints with a 2–5 mm shadow line, expansion joints with a metal
   cover strip, and different joint directions per material zone. Joint scale is the ruler the player uses.
4. **Fixings** — bolt heads and plates at 5–20 cm, anchor plates at corners, screw rows on metal panels,
   brackets under rails and ducts. These are what make a surface look assembled rather than extruded.
5. **Contact edges** — a dark crease/AO where a vertical object meets the deck, where a curb meets the slab,
   where a door meets a wall. Without it every object floats.
6. **Weathering** — dirt accumulation at parapet bases and corners, water streaks below edges and under AC
   units, rust bleed at fixings, patch repairs, tire scuffs, weeds in joints, puddles at low points.
7. **Material variance** — panel tone variation (5–10 %), different roughness between metal/concrete/glass,
   paint edge wear, and specular response on metal (the current build has one roughness per family).
8. **Chamfers and bevels** — a 1–2 cm bevel catches a highlight line on every edge; without it, a box against
   a bright sky shows nothing.
9. **Human-scale objects** at 0.4–1.2 m adjacent to the path (bollards, planters, boxes, door, ladder) to
   establish the metre.
10. **Compositional foreground** — something within 1–3 m at the lower/left frame edge (railing, cable, duct,
    parapet top) that lets the eye separate layers while running.

### 5.2 What breaks the read in the current build

1. **No normal/roughness/AO/metalness maps at all** — the only material factory sets `color`/`roughness`/
   `metalness` with an optional albedo map (`build.js:31-37`); `textures.js:85-93` creates `CanvasTexture`s
   with only `sRGB` colour. Every surface is matte albedo, so no grazing light or micro-shadow exists.
2. **Everything is an unbevelled `BoxGeometry`** — slabs `build.js:116`, fascia/curb `build.js:173-180`,
   rails `build.js:213-224`, props `build.js:429-499`, city `city.js:312`. No chamfers anywhere; combined with
   `EdgesGeometry` wireframe lines at 22 % opacity (`build.js:72-76`, `132-139`, `260-266`), close geometry reads
   as a CAD blockout, not a building.
3. **The fascia floats** — it is a 0.34 m tall × 0.1 m thick band placed 0.05 m **outside** the slab edge
   (`build.js:173-176`), so at 1–2 m it reads as an applied stripe with a visible gap, not as slab thickness.
4. **The curb is 9 cm tall** — below ankle height, 0.13 m wide (`build.js:177-180`); from a 1.65 m eye it
   subtends ~2.6° at 2 m and does not read as a roof edge at all.
5. **Side texture scale is not tied to world size** — the board-formed side material maps one 512² texture per
   box face (4 seams, `textures.js:148-153`), so a 4 m and a 10 m roof side show the same number of seams:
   the strongest existing scale cue stretches by 2.5×. (Tops do set `repeat = size/4`, `build.js:106-109`.)
6. **Only 3 identical concrete patterns for 26 roofs** — the texture cache is keyed by colour and the palette
   has 3 colours (`textures.js:109-114`, `tutorial.js:12`), so every roof repeats one of three stain layouts;
   panel tone variation is 4 % (`textures.js:17`, `textures.js:67-75`).
7. **Weathering is invisible at 0–5 m** — three radial stains at 5–6 % alpha per 512² tile (`textures.js:119-121`,
   `261-263`) are ~0.05 contrast at a 4 m repeat; there are no geometry decals, drip streaks, puddles or patch
   repairs anywhere (grep: 0 hits for puddle; the only decal system is the contact shadow in `contact.js`).
8. **Props have no contact shadows** — `pushContact` is only called for generated services (`build.js:170-171`,
   `196`, `199`, `203`); the 12 authored props (`build.js:422-501`) and the 12 obstacles (`build.js:364-386`)
   receive no contact decal, so they sit on the deck without an occlusion crease.
9. **Props have no collision** — `build.js:422-501` contains no `physics.addBox` (contrast `build.js:378-385`),
   so running into a planter or AC unit passes through it; the lack of physical feedback breaks the read even
   when the visual is acceptable.
10. **One human-scale object on 26 roofs** — a 0.04 × 1.05 × 0.82 m door plane on 6 huts (`build.js:241-250`);
    the next smallest objects are 0.06–0.07 m rail square bars (`build.js:213-224`) and 0.11 m pipes
    (`build.js:205`). There is no benchmark for “1 metre” at running speed.
11. **Uniform albedo across zones** — deck tops are near-white (palette `0xf2eee3`/`0xe1eaea`/`0xd2e1e4`,
    `tutorial.js:12`; `roughness 0.84`, `build.js:112-115`), vs. dark board-formed sides (`0x566a72`,
    `textures.js:137`). With no AO and no normal detail, a 26 m² plane reads as paper. Pale-pixel share in the
    current shots is 66.5 % vs 35.3 % in the reference (§2.6).
12. **No foreground occluders near the camera** — the frame composition (§2.7) shows 28.1 % of the frame within
    10 m, nearly all of it the deck plane; nothing crosses the lower third of the frame within 3 m except the
    act-label sprites, which read as UI.

### 5.3 Recommended kit (minimum viable, 0–5 m)

- **Geometry**: slab edge with 2 cm chamfer + 1.5 cm drip groove; parapet 0.35–0.9 m with a 4 cm oversailing
  coping; 2 cm bevel helper applied to all new boxes; bolt plates (8–15 cm) at 40–80 cm centres on parapets and
  joints; expansion-joint metal strips every 4–6 m; drain grates and hatch covers flush with the deck.
- **Material**: second UV set / vertex-tinted roughness; one shared 1024² detail atlas with normal + roughness
  (poured-concrete, board-formed, painted metal, galvanised steel, rubber membrane); roughness range 0.25–0.95
  per zone instead of 0.84 everywhere.
- **Decals**: one instanced decal mesh with a 512² atlas of drip streaks, rust bleed, oil, patches, tire scuffs,
  weeds; ~300 instances placed relative to parapets, AC units and joints.
- **Contact**: extend `contact.js` instancing to *all* props and obstacles (currently 43 decals, only under generated services; the 12 authored
  props and 11 collidable obstacles have none — `build.js:170-171` vs `build.js:422-501`); add a 4–7 cm dark crease at every
  vertical-to-deck junction via a cheap skirt quad or AO in the deck material.
- **Scale anchors**: at least one 0.4–1.2 m object per 8–10 m of route edge (bollard, planter, crate, door,
  ladder) so the metre is always on screen.

---

## 6. HUD/UI gap

### 6.1 The reference presentation

From the sampled frames and `docs/REFERENCE.md:85-95`: the tutorial is **near-HUD-free** — one bottom-centre
prompt bar (key glyph + 8–12 words) that appears contextually, a brief top-left hint card in the first seconds,
and a small centre dot. No timer, no brand, no act label, no checkpoint counter, no progress bar, no respawn
count, no persistent objective. The world itself (runner-vision red) carries route guidance.

### 6.2 Current element inventory (measured, 1920×1080)

| Element | Text / content | Area | Persistent? |
|---|---|---|---|
| Left plate | `GLASSLINE ROOFTOP INDUCTION` / `ACT I / III · ASCENT` / `01 / 21 · MOVEMENT` / progress bar / `00 / 20 CHECKPOINTS · 0 RESPAWNS` | 2.42 % | yes |
| Right plate | `TIME 00:01` / `BEST --:--` / `SPLIT --:--` | 0.87 % | yes |
| Prompt | `WASD move · Shift sprint · Space jump` | 0.62 % | yes (per checkpoint) |
| Help | `R retry · BACKSPACE restart · click view to look` | 0.32 % | yes |
| Toast | `CHECKPOINT 03 / 20 · SLIDE · +00:12` | 0.04 % empty → ~0.6 % when on | 2.2 s |
| Dispatch | `DISPATCH · Rooftop line is open…` | 0.65 % when on | 7 s at start |
| **Total** | **220 characters incl. transients, 5 keycaps** | **4.93 %** | |

Plus: 3 in-world act sprites 6 m wide at 4.4–5.2 m (`build.js:39-60`), 3 city sign boards 10–11 m wide floating
in mid-air (`city.js:204-208`), and **no reticle**.

### 6.3 Remove / collapse / restyle

| Action | Element | Why | Notes |
|---|---|---|---|
| **Remove from gameplay** | Left plate brand + sub + act line + `01/21` stage + progress bar + checkpoint/respawn count | The reference teaches through the world, not stats; 2.42 % of frame and 5 lines of static text compete with the architecture | Move time/best to pause/complete; a 2 s toast can carry “ACT II — DESCENT” |
| **Remove from gameplay** | Right plate: TIME / BEST / SPLIT | Timers turn a tutorial into a race and pull the eye to the corner; reference has none | Keep in pause + complete screens (`menu.js:364`) |
| **Collapse** | Bottom-left help line | 0.32 % permanently, repeats the prompt; only useful once | Show for first 20 s or in pause/controls (`menu.js` controls screen) |
| **Collapse** | `.gl-dispatch` card | 7 s of plate + teal rule for a line that belongs in audio | Keep the radio line (`audio.playDispatch`, `tutorial.js:427`), drop the DOM card |
| **Keep, restyle** | Bottom prompt | The reference's only persistent HUD element; useful for teaching | One line, no plate, 60 % opacity ink on world, auto-fade after 3 s; keycaps as inline glyphs |
| **Keep, reduce** | Checkpoint toast | Useful feedback | One short line, 1.2 s, no title/sub split |
| **Add** | 2–3 px centre dot | Reference has one (`docs/REFERENCE.md:64`, `docs/REFERENCE.md:122`); currently absent, and it is the cheapest depth/aim anchor | Static, 50 % alpha |
| **Restyle** | In-world act sprites → 1.2–2 m wall-mounted plates at act boundaries | The current 6 m floating cards occlude the route and read as UI (`artifacts/review/10-act2.png`) | `build.js:39-60`, `503-508` |
| **Restyle** | 3 city signs → attach to facades/parapets at plausible heights | Floating 10–11 m boards at y 5.6–13 m with no support read as bugs (`artifacts/review/10-act2.png`) | `city.js:563-591` |
| **Optional** | `?hud=ink` frameless variant | Already exists (`tutorial.js:32-35`); make it the default | `styles.css:111-113` |

**Recommended gameplay HUD**: centre dot + one contextual prompt line, ~0.6 % of frame, 0 brand/time/progress.
That requires the world to carry the missing guidance — hence additions #1, #5, #6 in §4 (route ribbon, cables,
signage) are prerequisites, not decoration.

---

## 7. Appendix: how each number was produced

| Number set | Method | Script / command |
|---|---|---|
| Platform, prop, obstacle, checkpoint, act counts and sizes; gaps; route length; dashes | Import `src/levels/tutorial.js` in Node and reduce the arrays | `/tmp/content-audit/measure.mjs`, `acts.mjs`, `coverage.mjs` |
| Generated module counts (104 fascia, 130 posts, …), modules/roof, per-act density | Re-implement the exact push rules from `build.js:103-258` over the data; cross-checked against the live scene graph | `/tmp/content-audit/measure.mjs`; live probe `probe1.mjs` |
| Deck emptiness (9.0 % / 91.0 % / 80.9 %) | 0.25 m grid over all decks (21,712 cells), marking AABBs of every service/prop/obstacle footprint from the build rules + data | `/tmp/content-audit/coverage2.mjs` |
| City plan counts (137 buildings, 1,320 windows, 348 backdrop, 660 windowed floors, near-facade distances) | Execute `createCityPlan(tutorialLevel)` in Node and reduce the returned plan | `/tmp/content-audit/measure.mjs`, `coverage.mjs` |
| Live scene: mesh/instance/material/geometry/texture counts, triangle budget per content group, draw calls | `npm run build`, serve `dist/index.html`, Playwright (system Edge, headless) → `window.__G.scene` traversal after the autostart path | `/tmp/content-audit/stats.mjs`, `tris.mjs`, `probe2.mjs` |
| Frame composition per checkpoint (sky / <10 m / 10–40 / >40) | Set camera at checkpoint + 1.65 m, 64×36 ray grid, classify first hit; sprites/line/overlay names excluded | `/tmp/content-audit/rays2.mjs` |
| HUD area (4.93 %) | DOM `getBoundingClientRect` of the six HUD clusters at 1920×1080 | `/tmp/content-audit/hud.mjs` |
| Reference vs current image metrics (pale/dark/edge/saturation) | 54 reference gameplay frames (t=1:40–5:15, pillarbox cropped) + 11 current shots, both 640×360, same statistics | `/tmp/content-audit/imgstats2.py`, `imgstats.py` |
| Reference prop families / HUD look | ffmpeg frame extraction (4 s and 5 s cadence) and visual inspection of contact sheets | `/tmp/content-audit/ref/sheet1.png`, `sheet2.png`, `detail_01.png`, `detail_02.png` |

*no `src/` file was modified. Created: this document. All measurements above are reproducible from the working
tree at branch `project/glassline` as of this audit.*
