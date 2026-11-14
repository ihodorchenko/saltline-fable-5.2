# GLASSLINE movement specification

Derived from [`REFERENCE.md`](REFERENCE.md). Numbers are **starting targets** for
the prototype, not copied constants. Tune only after the movement sandbox is
playable at 60 FPS.

## Player model

```text
capsule radius:      0.35 m
capsule height:      1.80 m
eye height:          1.65 m
step height:         0.40 m
max slope:           45°
gravity:             20 m/s²
terminal fall:       35 m/s
```

Use a capsule/AABB hybrid appropriate to the engine physics; keep the movement
state independent of the visual model and camera.

## Speeds and acceleration

| State | Target |
| --- | --- |
| Walk | 2.2 m/s |
| Run | 5.4 m/s |
| Sprint | 7.2 m/s |
| Ground acceleration | 35 m/s² |
| Ground deceleration | 45 m/s² |
| Air acceleration | 8 m/s² |
| Air control | 0.35 |
| Slide entry | current speed + 1.0 m/s |
| Slide friction | 8 m/s² |
| Balance speed | 3.0 m/s |
| Ladder climb | 1.6 m/s |

Momentum is mandatory: a jump keeps horizontal velocity, and a successful
landing/roll retains most of it. Do not stop the player on every state transition.

## Input model

- Move: WASD / left stick.
- Look: mouse / right stick.
- Jump/confirm: Space / A.
- Crouch/slide: C or Ctrl / B.
- Interact: F / X.
- Pause: Esc / Start.
- Buffer jump/vault/mantle for **0.15 s**.
- Coyote time for ground jump: **0.10 s**.
- Do not buffer a second wall-run from the same wall until the player lands or
  jumps to another wall.

## State machine

```text
idle -> run -> sprint
run/sprint -> jump -> air
air -> land -> run
run/sprint + crouch -> slide -> run
run/sprint + jump near obstacle -> vault -> run
air near ledge -> mantle -> run
run/sprint + jump at wall -> wallrun -> jump/land
air near climbable wall -> wallclimb -> mantle/land
air near pipe/wire -> hang -> climb/jump
narrow surface -> balance -> run
landing with speed + crouch -> roll -> run
```

Each transition must define:

- entry conditions (speed, height, normal, input, cooldown);
- duration/window;
- exit conditions (success, cancel, fall);
- camera/animation/audio hook;
- regression tests for stuck state and duplicate input.

## Moves

### Jump

- running jump: horizontal momentum preserved;
- height target 1.2 m, distance 4.5–5.0 m at run speed;
- no double jump;
- landing compression and speed retention.

### Slide

- crouch while moving fast; lowers capsule and camera;
- initial speed boost, gradual friction;
- exits under low ceilings or when speed drops below run;
- can enter vault/roll only after the slide ends.

### Vault

- low obstacle (0.6–1.1 m) approached at speed;
- hands plant, body clears, speed preserved;
- fails safely if too high or too slow.

### Mantle

- ledge 1.4–2.0 m above ground;
- short hang/plant, then pull-up;
- camera follows upward; no teleport;
- release/cancel to drop before the pull-up completes.

### Wall-run

- requires speed > 4.5 m/s and a wall within reach;
- duration 1.2–1.6 s;
- player moves along the wall, not up it;
- camera rolls into the wall (see CAMERA.md);
- jump exits with a directional boost; releasing direction drops;
- same-wall re-entry blocked until landing or another wall.

### Wall-climb

- distinct from wall-run: vertical, short, stamina/cooldown limited;
- ends in mantle or drop;
- no infinite climbing.

### Balance

- narrow surface triggers balance mode;
- A/D lateral correction, forward speed maintained;
- camera level, slight downward look;
- falling off cancels into air/landing;
- no hard auto-align, but a soft assist is acceptable.

### Roll

- triggered by crouch on landing above a speed threshold;
- retains 80–90% speed;
- short animation; camera dips then recovers;
- cannot roll from a standstill.

### Hang / pipes / wires

- automatic grab when the hands reach a valid pipe/wire;
- free look while hanging;
- Space releases/jumps;
- no arbitrary air-grab; require a valid traversal object.

## Failure and recovery

- Fall: respawn at the last checkpoint; no long death animation.
- Stuck: allow a manual `R`/checkpoint reset.
- All parkour state transitions must be testable without rendering.

## Out of scope for the first slice

- combat, weapons, disarms;
- vehicles;
- copying Mirror's Edge level layouts, characters or assets.

## Tuning order

1. run/jump/land feel;
2. vault/mantle;
3. wall-run;
4. balance;
5. hang/wire;
6. slide/roll;
7. chained routes and speed retention.
