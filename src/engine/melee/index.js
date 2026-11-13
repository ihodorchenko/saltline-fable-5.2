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
  const SWING_TIME = 0.38;
  const COS_HALF_CONE = Math.cos(Math.PI / 6);
  const origin = new V();
  const dir = new V();
  const toTarget = new V();
  const point = new V();
  const fallbackDir = new V(0, 0, -1);
  let cooldown = 0;
  let last = null;
  let wasDown = false;
  let swing = 0;

  function update(dt) {
    cooldown = Math.max(0, cooldown - (dt || 0));
    applySwing(dt);

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
    swing = SWING_TIME;
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

  function applySwing(dt) {
    swing = Math.max(0, swing - (dt || 0));
    if (swing <= 0) return;

    const root = game.weapon && game.weapon.root;
    if (!root || !root.position || !root.rotation) return;

    const t = 1 - swing / SWING_TIME;
    const s = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
    // Rifle-butt swing: pull the view-model left/up and roll it across the
    // screen. The weapon module resets the base transform every frame, so the
    // offsets are applied after that update and stay one-shot.
    root.position.x -= 0.18 * s;
    root.position.y += 0.08 * s;
    root.position.z += 0.1 * s;
    root.rotation.x -= 0.55 * s;
    root.rotation.y += 0.28 * s;
    root.rotation.z += 0.3 * s;
  }

  return {
    update,
    reset() {
      cooldown = 0;
      last = null;
      wasDown = false;
      swing = 0;
    },
    debug() {
      return { cooldown, last, swing };
    },
  };
}
