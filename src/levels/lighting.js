// @ts-check
// Lighting rig for GLASSLINE. One shadow-casting sun that follows the player, so
// shadows exist along the whole route instead of only near the start, plus a small
// sky fill. Tuned against the reference: lit white stucco reaches near-white while
// the shadow side stays a readable blue instead of being lifted to the lit value.
// Look-dev values live in LIGHTING; the sun direction lives in sun.js.

import { SUN_DIRECTION } from './sun.js';

export const LIGHTING = {
  // One key, one sky fill: the reference's sunlight/sky ratio is about 4:1, not
  // the near-1:1 the old three-directional rig produced.
  hemisphere: { sky: 0xbcd9ff, ground: 0x4e6274, intensity: 0.5 },
  // The engine sun already owns a fitted shadow frustum, so `distance` is only
  // used by the private fallback light.
  key: { color: 0xfff4e2, intensity: 6.2, distance: 40 },
  rim: { color: 0xb9e4ff, intensity: 0.35, offset: [28, 16, -48] },
  warm: { color: 0xffd0a4, intensity: 0.2, offset: [-24, 8, -120] },
  // Fallback shadow camera only. The engine's soft-shadow shader bakes its
  // frustum size and depth at renderer start-up, so the engine sun must keep
  // its own camera bounds and near/far.
  shadow: { half: 36, near: 1, far: 120, bias: -0.00012, normalBias: 0.03 },
  exposure: 1.05,
};

/**
 * Snap a light-space coordinate to the shadow-map texel grid so shadow edges do
 * not shimmer while the light follows the player.
 * @param {number} value world-space coordinate along a light-space axis
 * @param {number} texel world size of one shadow texel
 * @returns {number}
 */
export function snapToTexel(value, texel) {
  if (!(texel > 0) || !Number.isFinite(value)) return value;
  return Math.round(value / texel) * texel;
}

/**
 * @param {any} game
 * @returns {{update: (pos: {x: number, y: number, z: number}) => void, key: any}}
 */
export function createLighting(game) {
  const { THREE, scene } = game;
  const L = LIGHTING;

  const hemisphere = new THREE.HemisphereLight(L.hemisphere.sky, L.hemisphere.ground, L.hemisphere.intensity);
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  const warm = new THREE.DirectionalLight(L.warm.color, L.warm.intensity);

  // Reuse the engine sun when present: it already owns soft shadows and the
  // shadow-refresh schedule. Fall back to a private light otherwise.
  const engineSun = game.render?.sun?.isDirectionalLight ? game.render.sun : null;
  const key = engineSun || new THREE.DirectionalLight(L.key.color, L.key.intensity);
  key.color.set(L.key.color);
  key.intensity = L.key.intensity;
  key.castShadow = true;

  const sc = key.shadow.camera;
  let distance = L.key.distance;
  if (engineSun) {
    // The engine's soft-shadow patch embeds the fitted frustum size in the
    // shader; resizing it here would desync the penumbra. Only translate it.
    distance = key.position.distanceTo(key.target.position) || 200;
  } else {
    const size = Math.min(game.quality?.shadow || 2048, 2048);
    key.shadow.mapSize.set(size, size);
    sc.left = -L.shadow.half;
    sc.right = L.shadow.half;
    sc.top = L.shadow.half;
    sc.bottom = -L.shadow.half;
    sc.near = L.shadow.near;
    sc.far = L.shadow.far;
    sc.updateProjectionMatrix();
    scene.add(key, key.target);
  }
  key.shadow.bias = L.shadow.bias;
  key.shadow.normalBias = L.shadow.normalBias;

  // Directional lights only use the vector to their target. Add the targets so
  // the fill directions stay constant while the lights follow the player.
  scene.add(hemisphere, rim, rim.target, warm, warm.target);
  if (game.render && game.render.exposure != null) game.render.exposure = L.exposure;

  const dir = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();

  /** @param {{x: number, y: number, z: number}} pos */
  function update(pos) {
    // Re-read the map size so a quality change also moves the snapping grid.
    const texel = (sc.right - sc.left) / (key.shadow.mapSize.x || 2048);
    // Snap the target in light space (right/up axes) before offsetting the light.
    const r = snapToTexel(pos.x * right.x + pos.y * right.y + pos.z * right.z, texel);
    const u = snapToTexel(pos.x * up.x + pos.y * up.y + pos.z * up.z, texel);
    const d = pos.x * dir.x + pos.y * dir.y + pos.z * dir.z;
    key.target.position.set(
      right.x * r + up.x * u + dir.x * d,
      right.y * r + up.y * u + dir.y * d,
      right.z * r + up.z * u + dir.z * d,
    );
    key.position.set(
      key.target.position.x + dir.x * distance,
      key.target.position.y + dir.y * distance,
      key.target.position.z + dir.z * distance,
    );
    key.target.updateMatrixWorld();
    rim.position.set(pos.x + L.rim.offset[0], pos.y + L.rim.offset[1], pos.z + L.rim.offset[2]);
    rim.target.position.set(pos.x, pos.y, pos.z);
    rim.target.updateMatrixWorld();
    warm.position.set(pos.x + L.warm.offset[0], pos.y + L.warm.offset[1], pos.z + L.warm.offset[2]);
    warm.target.position.set(pos.x, pos.y, pos.z);
    warm.target.updateMatrixWorld();
  }

  return { update, key };
}
