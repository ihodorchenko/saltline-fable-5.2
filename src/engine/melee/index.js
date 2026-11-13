// Close-range melee: V is bound to the melee action; the first version is a
// single short-range strike with a cooldown, hitmarker, sound and camera kick.

/**
 * @param {object} game game context (player, input, camera, enemies, events)
 * @returns {{update: Function, reset: Function, debug: Function}}
 */
export function createMelee(game) {
  const V = game.THREE.Vector3;
  const RANGE = 1.6;
  const DAMAGE = 40;
  const COOLDOWN = 0.8;
  const COS_HALF_CONE = Math.cos(Math.PI / 6);
  const origin = new V();
  const dir = new V();
  const toTarget = new V();
  const point = new V();
  const fallbackDir = new V(0, 0, -1);
  let cooldown = 0;
  let last = null;
  let wasDown = false;

  function update(dt) {
    cooldown = Math.max(0, cooldown - (dt || 0));

    const player = game.player;
    const input = game.input;
    const enemies = game.enemies;
    if (!player || !player.alive || !player.enabled || !input || !enemies || !enemies.list) {
      wasDown = false;
      return;
    }

    const down = typeof input.down === 'function' ? input.down('melee') : false;
    const tapped = (typeof input.pressed === 'function' && input.pressed('melee')) || (down && !wasDown);
    wasDown = down;
    if (cooldown > 0 || !tapped) return;

    cooldown = COOLDOWN;
    origin.copy(player.eye || player.pos);

    const camera = game.camera;
    if (camera && camera.getWorldDirection) camera.getWorldDirection(dir);
    else dir.copy(player.forward || fallbackDir);

    let target = null;
    let targetPoint = null;
    let best = RANGE;

    for (const enemy of enemies.list) {
      if (!enemy || !enemy.alive || !enemy.pos) continue;
      point.copy(enemy.pos);
      point.y += 0.85;
      if (Math.abs(point.y - origin.y) > 1.2) continue;

      // Use a horizontal cone: eye height vs. a hound's body should not make a
      // point-blank target look like it is outside a 3D cone.
      const dx = point.x - origin.x;
      const dz = point.z - origin.z;
      const horizontal = Math.hypot(dx, dz);
      if (horizontal < 0.05 || horizontal > RANGE) continue;
      if ((dx * dir.x + dz * dir.z) / horizontal < COS_HALF_CONE) continue;
      if (game.physics?.lineOfSight && !game.physics.lineOfSight(origin, point)) continue;

      const distance = toTarget.copy(point).sub(origin).length();
      if (distance <= best) {
        best = distance;
        target = enemy;
        targetPoint = point.clone();
      }
    }

    game.events.emit('weapon:melee', { origin: origin.clone(), hit: !!target });
    player.addShake?.(0.12);
    player.addRecoil?.(0.03, 0);

    if (!target) {
      last = { hit: false, cooldown: COOLDOWN };
      return;
    }

    const killed = target.damage(DAMAGE, targetPoint, dir.clone(), 'body') === true;
    game.events.emit('player:hitEnemy', {
      enemy: target,
      part: 'body',
      killed,
      weak: false,
    });
    game.events.emit('impact', {
      point: targetPoint,
      normal: dir.clone().negate(),
      dist: best,
      surface: 'enemy',
      enemy: target,
      dir: dir.clone(),
      from: 'player',
      killed,
    });
    last = { hit: true, killed, distance: best, type: target.type || null };
  }

  return {
    update,
    reset() {
      cooldown = 0;
      last = null;
      wasDown = false;
    },
    debug() {
      return { cooldown, last };
    },
  };
}
