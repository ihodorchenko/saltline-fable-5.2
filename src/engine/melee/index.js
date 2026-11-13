// Close-range melee: Q triggers a rifle-butt bash with a small state machine.
// The animation runs in the game loop after the weapon update, so it can
// override the view-model for the swing while the weapon update continues to
// handle the rest of the gun state.

/**
 * @param {object} game game context (player, input, camera, weapon, enemies, events, physics)
 * @returns {{trigger: Function, update: Function, reset: Function, cancel: Function, attacking: boolean, debug: Function}}
 */
export function createMelee(game) {
  const V = game.THREE.Vector3;
  const RANGE = 1.8;
  const DAMAGE = 40;
  const COOLDOWN = 0.8;

  const WINDUP = 0.12;
  const STRIKE = 0.08;
  const RECOVERY = 0.25;
  const TOTAL = WINDUP + STRIKE + RECOVERY;

  // Offsets relative to the captured weapon base transform (camera space).
  const WINDUP_POS = [0.34, 0.06, 0.18];
  const WINDUP_ROT = [0.32, 1.05, -0.4];
  const STRIKE_POS = [-0.28, 0.02, -0.32];
  const STRIKE_ROT = [-0.12, 1.28, -0.18];

  const origin = new V();
  const dir = new V();
  const fallbackDir = new V(0, 0, -1);
  const basePos = new V();
  const windupPos = new V();
  const strikePos = new V();
  const baseRot = { x: 0, y: 0, z: 0 };
  const windupRot = { x: 0, y: 0, z: 0 };
  const strikeRot = { x: 0, y: 0, z: 0 };

  let attacking = false;
  let elapsed = 0;
  let hitDone = false;
  let cooldown = 0;
  let last = null;

  function root() {
    return game.weapon && game.weapon.root;
  }

  function captureBase() {
    const weapon = root();
    if (!weapon) return false;
    basePos.copy(weapon.position);
    baseRot.x = weapon.rotation.x;
    baseRot.y = weapon.rotation.y;
    baseRot.z = weapon.rotation.z;

    windupPos.set(basePos.x + WINDUP_POS[0], basePos.y + WINDUP_POS[1], basePos.z + WINDUP_POS[2]);
    strikePos.set(basePos.x + STRIKE_POS[0], basePos.y + STRIKE_POS[1], basePos.z + STRIKE_POS[2]);
    windupRot.x = baseRot.x + WINDUP_ROT[0];
    windupRot.y = baseRot.y + WINDUP_ROT[1];
    windupRot.z = baseRot.z + WINDUP_ROT[2];
    strikeRot.x = baseRot.x + STRIKE_ROT[0];
    strikeRot.y = baseRot.y + STRIKE_ROT[1];
    strikeRot.z = baseRot.z + STRIKE_ROT[2];
    return true;
  }

  function applyPose(fromPos, toPos, fromRot, toRot, alpha) {
    const weapon = root();
    if (!weapon) return;
    weapon.position.set(
      fromPos.x + (toPos.x - fromPos.x) * alpha,
      fromPos.y + (toPos.y - fromPos.y) * alpha,
      fromPos.z + (toPos.z - fromPos.z) * alpha,
    );
    weapon.rotation.x = fromRot.x + (toRot.x - fromRot.x) * alpha;
    weapon.rotation.y = fromRot.y + (toRot.y - fromRot.y) * alpha;
    weapon.rotation.z = fromRot.z + (toRot.z - fromRot.z) * alpha;
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function easeInExpo(t) {
    return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function resolveHit() {
    const player = game.player;
    const camera = game.camera;
    if (!player) return;

    origin.copy(player.eye || player.pos);
    if (camera && camera.getWorldDirection) camera.getWorldDirection(dir);
    else dir.copy(player.forward || fallbackDir);

    let limit = RANGE;
    const wall = game.physics && game.physics.raycast ? game.physics.raycast(origin, dir, limit) : null;
    if (wall && typeof wall.dist === 'number' && wall.dist < limit) limit = wall.dist;

    const hit = game.enemies && game.enemies.raycast ? game.enemies.raycast(origin, dir, limit) : null;
    player.addShake?.(0.18);
    player.addRecoil?.(0.035, 0);

    if (!hit || !hit.enemy) {
      last = { hit: false };
      return;
    }

    const point = hit.point ? hit.point.clone() : origin.clone().addScaledVector(dir, limit);
    const part = hit.part || 'body';
    const killed = hit.enemy.damage(DAMAGE, point, dir.clone(), part) === true;

    game.events.emit('weapon:melee', { origin: origin.clone(), hit: true, phase: 'hit' });
    game.events.emit('player:hitEnemy', {
      enemy: hit.enemy,
      part,
      killed,
      weak: part === 'weak',
    });
    game.events.emit('impact', {
      point,
      normal: hit.normal ? hit.normal.clone() : dir.clone().negate(),
      dist: limit,
      surface: 'enemy',
      enemy: hit.enemy,
      dir: dir.clone(),
      from: 'player',
      killed,
    });
    last = { hit: true, killed, part, distance: limit };
  }

  function trigger() {
    const player = game.player;
    const state = game.game && game.game.state;
    if (state && state !== 'playing') return false;
    if (attacking || cooldown > 0 || !player || !player.alive || !player.enabled) return false;
    if (!captureBase()) return false;

    attacking = true;
    elapsed = 0;
    hitDone = false;
    cooldown = COOLDOWN;
    origin.copy(player.eye || player.pos);
    game.events.emit('weapon:melee', { origin: origin.clone(), hit: false, phase: 'swing' });
    return true;
  }

  function cancel() {
    const weapon = root();
    if (weapon) {
      weapon.position.copy(basePos);
      weapon.rotation.x = baseRot.x;
      weapon.rotation.y = baseRot.y;
      weapon.rotation.z = baseRot.z;
    }
    attacking = false;
    elapsed = 0;
    hitDone = false;
  }

  function update(dt) {
    dt = dt || 0;
    cooldown = Math.max(0, cooldown - dt);
    if (!attacking) return;

    const player = game.player;
    if (!root() || !player || !player.alive || !player.enabled) {
      cancel();
      return;
    }

    elapsed += dt;

    if (!hitDone && elapsed >= WINDUP + STRIKE) {
      hitDone = true;
      resolveHit();
    }

    if (elapsed < WINDUP) {
      const t = Math.max(0, Math.min(1, elapsed / WINDUP));
      applyPose(basePos, windupPos, baseRot, windupRot, easeOutQuad(t));
    } else if (elapsed < WINDUP + STRIKE) {
      const t = Math.max(0, Math.min(1, (elapsed - WINDUP) / STRIKE));
      applyPose(windupPos, strikePos, windupRot, strikeRot, easeInExpo(t));
    } else if (elapsed < TOTAL) {
      const t = Math.max(0, Math.min(1, (elapsed - WINDUP - STRIKE) / RECOVERY));
      applyPose(strikePos, basePos, strikeRot, baseRot, easeOutBack(t));
    } else {
      const weapon = root();
      if (weapon) {
        weapon.position.copy(basePos);
        weapon.rotation.x = baseRot.x;
        weapon.rotation.y = baseRot.y;
        weapon.rotation.z = baseRot.z;
      }
      attacking = false;
    }
  }

  function onKeyDown(event) {
    if (event.code !== 'KeyQ' || event.repeat) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
    )
      return;
    const player = game.player;
    if (!player || !player.alive || !player.enabled) return;
    trigger();
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', onKeyDown);
  }

  return {
    trigger,
    update,
    cancel,
    reset() {
      cooldown = 0;
      last = null;
      cancel();
    },
    get attacking() {
      return attacking;
    },
    debug() {
      return { cooldown, attacking, elapsed, swing: Math.max(0, TOTAL - elapsed), last };
    },
  };
}
