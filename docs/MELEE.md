# Melee — intermediate release

Branch: `feat/melee`, based on `dev` after Phase 1 acceptance.

## Mechanics (v1)

- Key: **Q** (`KeyQ` → `melee`; `V` is unbound).
- Range: 1.6 m from the player's eye.
- Cone: 60° total (30° half-angle), checked horizontally (vertical tolerance 1.2 m), plus a physics line-of-sight check.
- Damage: 40, one target per swing (nearest valid target).
- Cooldown: 0.8 s.
- No ammo use, combos or stealth takedowns in v1.

## Feedback

- Rifle-butt view-model swing (0.38 s, applied after the weapon update).

- `weapon:melee` audio event: short whoosh; metallic impact on hit.
- `player:hitEnemy` → HUD hitmarker (kill/weak variants still supported).
- `impact` event for existing impact effects.
- Small camera shake and recoil kick.

## Files

- `src/engine/melee/index.js` — melee module (`createMelee(game)`);
- `src/engine/input/bindings.js` — Q binding;
- `src/engine/ui/index.js` — controls legend says Q;
- `src/game/main.js` — creates the module and updates it in the game loop;
- `README.md` — controls and branch status.

## Verification

- Unit-level test (Node): first swing damages once, cooldown blocks the next swing, swing after cooldown damages again, enemy behind the player is ignored, and a ground-level hound at 1.2 m is hit (the cone is horizontal, not eye-to-feet 3D); the weapon root receives the swing offsets and returns to base after the animation.
- Browser probe: synthetic `KeyQ` reaches `input.pressed('melee')`; module update runs on the game loop and reports cooldown/last-hit via `__G.melee.debug()`.
- Build + smoke + gameplay/level screenshots unchanged apart from the intended Q legend.

## Out of scope for v1

- Left-hand knife model/animation; hit reactions/ragdolls; combos; executions; melee-specific enemy AI; dedicated sound synthesis beyond the existing hit/whoosh layers.
