# Melee — intermediate release

Branch: `feat/melee`, based on `dev` after Phase 1 acceptance.

## Mechanics (v1)

- Key: **Q** (`KeyQ` → `melee`; `V` is unbound).
- Range: 1.8 m center raycast from the camera.
- Damage: 40, one target per swing.
- Cooldown: 0.8 s.
- Fire lockout: the weapon cannot fire while the melee state machine is running.
- No ammo use, combos or stealth takedowns in v1.

## Animation state machine

Total duration: 0.45 s, updated after the weapon update so the swing is not
overwritten by the normal view-model sway.

1. **Wind-up** (0–0.12 s): weapon pulls right/back, muzzle up; easeOutQuad.
2. **Strike** (0.12–0.20 s): weapon drives forward/left to the strike pose;
   easeInExpo. At 0.20 s the center raycast fires, damage is applied once, and
   the camera gets a shake/recoil punch.
3. **Recovery** (0.20–0.45 s): weapon returns to the captured base transform
   with easeOutBack; fire unlocks at the end.

## Feedback

- Rifle-butt view-model swing.
- `weapon:melee` audio event: whoosh on trigger, metallic impact on hit.
- `player:hitEnemy` → HUD hitmarker.
- `impact` event for existing impact effects.
- Camera shake/recoil at the strike, not at key press.

## Files

- `src/engine/melee/index.js` — melee module (`createMelee(game)`);
- `src/engine/input/bindings.js` — Q binding;
- `src/engine/ui/index.js` — controls legend says Q;
- `src/game/main.js` — creates the module and updates it in the game loop;
- `README.md` — controls and branch status.

## Verification

- Unit-level test (Node): wind-up has no damage, damage lands once at the 0.20 s strike point, attacking/cooldown block retriggering, the weapon root reaches the wind-up/strike poses and returns to base at 0.45 s. Center-raycast hit/miss is covered by the same test.
- Browser probe: synthetic `KeyQ` triggers the state machine immediately, `__G.melee.debug()` exposes attacking/cooldown/last-hit, and the weapon root receives the swing offsets.
- Build + smoke + gameplay/level screenshots unchanged apart from the intended Q legend.

## Out of scope for v1

- Left-hand knife model/animation; hit reactions/ragdolls; combos; executions; melee-specific enemy AI; dedicated sound synthesis beyond the existing hit/whoosh layers.
