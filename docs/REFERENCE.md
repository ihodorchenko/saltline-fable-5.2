# GLASSLINE reference notes

Status: **reviewed 2026-11-14**. Reference is a local, owner-provided
walkthrough of the Mirror's Edge tutorial. The video itself is not committed
(large third-party reference); observations below are textual only.

## Source

- File: `docs/reference/Прохождение Mirrors Edge - Часть 1 - Обучение (изучить основные навыки) [XxzhPEjGHw0].mp4`
- Runtime: **8:37** (517 s)
- Video: **1920×810, 60 fps**, H.264; the game is pillarboxed inside the video.
- Language: Russian voice-over and on-screen tutorial prompts.
- Scope of clip: intro, first-person rooftop movement tutorial, climbing,
  balance, wall-run, pipe/wire traversal, then a combat/disarm tutorial.
- Use: analysis of motion, camera, level language and UI only. No frames, audio,
  textures or level data are copied into GLASSLINE.

## Timeline

| Time | Segment | Observation |
| --- | --- | --- |
| 0:00–1:20 | Intro | Cinematic city shots, character intro, title; no player control. |
| 1:20–1:44 | Spawn / first run | First-person rooftop, no weapon, hands at the bottom edge. Prompt explains that **Space** handles jumps and other upper-body moves. |
| 1:44–2:16 | Jump basics | Running jump across roof gaps; camera stays level, momentum carries into the landing. |
| 2:16–2:40 | Beams and obstacle | Narrow red beams across a gap; red ramp/obstacle marks the route. The prompt teaches jumping over an obstacle while running. |
| 2:40–2:56 | Wall-run | Red wall is a traversal cue. The player jumps from a run, plants on the wall, crosses it with a strong camera bank, then drops back to the roof. **Mouse 1** is taught for red doors/interactions. |
| 2:56–3:28 | Interior / pipe | Indoor section, door frame and NPC. At 3:28 the player hangs from a red pipe; **Mouse X/Y** looks around, **Space** jumps off. |
| 3:28–3:44 | Ladder | **Space** climbs ladders. Hands and arms are visible at the edges of the view. |
| 3:44–4:32 | Climb / traversal | Ascending rooftop geometry, first-person hand plants. The route uses clean white surfaces with red edge markers. |
| 4:32–5:20 | Wires / balance | Prompt teaches jumping to wires and **automatic grabbing**. Balance on a narrow ledge uses **A/D**. Camera looks down at the ledge and remains level while the player corrects. |
| 5:20–7:20 | Combat tutorial | Punch/disarm, **Mouse 2** stealth disarm, slow-motion/impact feedback. Outside the pure parkour slice. |
| 7:20–8:16 | Outro | Cinematic city shots and credits; not gameplay. |

The exact frame of each transition varies with the player; timestamps are for
orientation, not frame-accurate contracts.

## Movement set observed

- **Run**: immediate, readable acceleration; no stamina, no weapon sway.
- **Jump**: running jump clears gaps and low obstacles; no double jump observed.
- **Wall-run**: entered from a running jump toward a wall; crosses a short section;
  exits with a drop/jump. The wall is the route, not a wall-climb replacement.
- **Balance**: lateral **A/D** correction on narrow surfaces; forward speed is
  maintained but corrections dominate the input.
- **Hang / pipe**: automatic grab when jumping to a pipe; free look while hanging;
  Space releases/jumps.
- **Ladder**: Space climbs; camera stays first-person and close to the ladder.
- **Vault / hand plant / mantle**: first-person hands plant on geometry; the camera
  rises with the body. The clip shows the family, not a frame-accurate state graph.
- **Wire grab**: automatic catch after a jump; momentum transfers into traversal.
- **Combat**: punches and disarms in the second half. Not part of the first
  GLASSLINE parkour slice.

Not demonstrated clearly in this clip: slide, landing roll, wall-climb (as
distinct from wall-run), moving platforms. Treat these as genre extensions, not
as copied requirements.

## Camera observations

- **First-person, eye-height**, arms/hands visible at the lower corners; no
  weapon and no aim-down-sights.
- **Wide FOV**, stable horizon in normal running. The world has strong vertical
  scale and clean white/grey surfaces.
- **Small center dot** reticle; no large crosshair, ammo or health HUD during the
  movement tutorial.
- **Wall-run bank**: camera rolls strongly into the wall, on the order of
  20–30° in the sampled frames, then recenters within a few tenths of a second
  after leaving the wall. The view stays forward along the route; it does not
  stare at the wall.
- **Jump/fall**: camera follows the look direction; there is no forced
  auto-level. A short landing compression is visible on drops.
- **Balance**: camera remains near level and looks slightly down at the beam;
  lateral correction does not snap the view.
- **Climb / mantle**: camera follows the hands and body upward; the motion is
  smooth, not a teleport.
- **Speed feedback**: subtle motion blur / edge streaks and a slight FOV widening
  during fast traversal; not enough to obscure the route.
- **Mouse look**: free look while running, hanging and balancing. Camera does not
  hard-lock to the route.

## Level and UI language

- **Runner vision**: saturated red marks traversable/interactable objects against
  white, grey and blue architecture. Red is used consistently for ramps, beams,
  walls, pipes and doors.
- Roof routes are linear but read as a real city: wide safe roofs, narrow beams,
  vertical drops, ladders, pipes and wires.
- Tutorial prompts are bottom-center bars with a key glyph and short action text.
- NPCs act as checkpoints/instructions; there is no quest log in the tutorial.
- Combat prompts introduce attack/disarm later; the parkour section is almost
  HUD-free.

## Implications for GLASSLINE

- Keep the **hands-first first-person camera**, wide FOV and small center reticle.
- Make **red a traversal language**, not decoration: route objects, ledges,
  interactables and danger edges share a consistent accent system.
- Teach one mechanic at a time on a safe roof, then combine two mechanics.
- Prioritize **run → jump → wall-run → balance → climb → wire/hang** for the first
  slice. Add slide/roll only if they improve flow and can be tuned.
- Do not copy Mirror's Edge assets, logos, character, story or level layouts.
  Build an original rooftop district and courier fiction.

## Measurable starting targets

These are GLASSLINE targets, not extracted game constants; tune them in Step 1–2.

| Metric | Starting target |
| --- | --- |
| Run speed | 5.4 m/s |
| Sprint speed | 7.2 m/s |
| Jump height | 1.2 m |
| Running jump distance | 4.5–5.0 m |
| Wall-run duration | 1.2–1.6 s |
| Wall-run camera roll | 20° (tune 15–25°) |
| Balance lateral correction | 1.8 m/s |
| Ladder climb speed | 1.6 m/s |
| Mantle height | 1.4–2.0 m |
| Camera eye height | 1.65 m |
| Base vertical FOV | 74° |
| Sprint FOV kick | +5° |
| Center reticle | 2 px dot |
| Target frame rate | 60 FPS desktop |

See [`MOVEMENT.md`](MOVEMENT.md) and [`CAMERA.md`](CAMERA.md) for the derived
specifications.
