# GLASSLINE camera specification

Derived from [`REFERENCE.md`](REFERENCE.md). The goal is a hands-first,
wide-angle first-person camera that makes speed and verticality readable without
causing motion sickness.

## Base camera

| Property | Value |
| --- | --- |
| Type | first-person, head-mounted |
| Eye height | 1.65 m |
| Base vertical FOV | 74° |
| Near / far | 0.08 / 900 |
| Rotation order | YXZ |
| Reticle | 2 px center dot |
| Weapon/aim | none |

The engine camera must remain separate from the gameplay camera state so that
parkour can add roll/FOV/offset without fighting player look.

## Look

- Mouse/stick look is free; no hard route lock.
- Base sensitivity comes from settings.
- Add a small look smoothing/lag (20–30 ms) but do not make aiming mushy.
- Invert-Y and sensitivity are shared with the engine settings.
- Do not auto-level the view during normal running.
- Balance uses a soft lateral assist only; it must not snap the camera.

## Speed feedback

| State | FOV | Camera effect |
| --- | --- | --- |
| Walk | 74° | minimal bob |
| Run | 74–76° | subtle bob, slight forward lean |
| Sprint | 76–80° | +5° FOV, edge motion blur/streak |
| Slide | 78–82° | lower eye, stronger blur |
| Wall-run | +3–5° | roll 20° into the wall |
| Fall | 74–78° | no forced tilt; wind/streak cue |
| Landing | 74° | short dip and rebound |

FOV changes use a damped spring, roughly 0.15–0.25 s.

## Head motion

- Run bob: vertical 0.015–0.025 m, lateral 0.005–0.01 m, ~1.8 steps/s.
- Sprint: slightly stronger bob but still readable.
- Idle: breathing motion, very small.
- Landing: downward offset 0.06–0.10 m with a spring back; scale with impact.
- Hard landing: short camera shake, not a long screen wobble.
- Add an accessibility option to reduce bob/shake/motion blur.

## Wall-run

- Trigger: valid wall + speed + jump.
- Roll into the wall: **20° target**, tune 15–25°.
- Roll-in time: 80–120 ms; hold while on wall; recenter in 160–220 ms after exit.
- Keep the view forward along the route; do not look directly at the wall.
- Add slight FOV widening and wind/audio cue.
- On wall-jump, blend the camera toward the exit direction, not a snap.
- Never let the roll exceed 25° (motion sickness/route readability).

## Jump, fall, landing

- Jump: no camera pitch kick by default; optional 1–2° lift.
- Fall: preserve look direction; add speed streaks/wind, not forced tilt.
- Landing: dip + short spring; no long freeze.
- High fall: stronger dip/shake, then immediate control.
- Camera collision: prevent clipping into walls; pull in smoothly, restore slowly.

## Vault, mantle, climb, hang

- Vault: camera moves with the body, small forward/down arc, no roll.
- Mantle: camera follows hand plant and pull-up; smooth height change.
- Ladder: camera stays first-person; allow free look but keep body aligned.
- Hang: free look; camera offset follows hands; no forced auto-center.
- Wire/zipline: camera follows travel direction; field of view may widen slightly.

## Balance

- Camera remains near level; look slightly down at the beam.
- Lateral correction adds a small lean, not a hard roll.
- Falling off: blend back to air camera, no instant reset.
- Optional soft assist: 10–15% of lateral error, never full auto-balance.

## UI/feedback

- Small center dot only; no ammo/health/weapon HUD in the parkour slice.
- Prompt bars at the bottom: key glyph + short action.
- Red route accents; subtle edge highlights only when needed.
- Optional speed/flow indicator after the core feel is approved.
- Accessibility: FOV, bob, shake, motion blur, reticle size/visibility.

## Implementation contract

- Gameplay camera state: base eye + look + FOV offset + roll + positional spring.
- Apply after player look and before rendering, once per frame.
- Use a damped spring for offsets; clamp dt to the engine maximum.
- Do not accumulate offsets across frames; the player look is authoritative.
- Camera tests: base, sprint FOV, wall-run roll/recenter, landing dip, collision.

## Acceptance

- 60 FPS on desktop Chrome with the camera effects enabled.
- Wall-run roll reads clearly but the route stays visible.
- No camera clipping through walls or floors.
- No motion-sickness defaults: effects are tunable and can be reduced.
- Camera never changes gameplay direction on its own.
