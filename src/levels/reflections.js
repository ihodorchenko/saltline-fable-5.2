// @ts-check
// Scene-captured reflection probes for the curtain-wall glass and metal.
//
// The procedural sky PMREM is a soft, nearly uniform environment: glass lit only
// by it reads as flat pale-blue board. At the end of buildLevel we capture the
// real district from two points along the route, prefilter the cubes (PMREM) and
// hand those textures to every material tagged with `userData.reflections`. The
// glass then reflects the neighbouring towers, the canyon and the sky gradient
// per bay, which is the read the 2008 reference towers have and a uniform sky
// map cannot produce.
//
// Cost model: the capture is a one-shot at level build time (2 cube renders plus
// PMREM), never touched per frame. Low quality skips it; unit tests have no
// renderer and get null.

const DEFAULT_PROBE_COUNT = 2;
const CUBE_SIZE = 256;

const INTENSITIES = { glass: 2.3, metal: 1.4 };

/**
 * Reflection probes only make sense when there is something to reflect: a live
 * renderer and a scene. Unit tests and headless builds return null instead of
 * throwing.
 * @param {any} game
 * @returns {boolean}
 */
export function canCaptureReflections(game) {
  return !!game?.THREE?.CubeCamera && !!game?.THREE?.PMREMGenerator && !!game?.renderer && !!game?.scene;
}

/**
 * Probe capture is a high/ultra detail: it costs one-off cube renders at level
 * build. Low quality keeps the sky-only environment.
 * @param {string} [quality]
 * @returns {boolean}
 */
export function resolveProbeQuality(quality) {
  return quality !== 'low';
}

/**
 * Camera positions for the environment capture, sampled along the route so the
 * glass reflects the district at player height rather than a single arbitrary
 * point. Deterministic, so a probe capture is reproducible.
 * @param {any} level
 * @param {number} [count]
 * @returns {{x: number, y: number, z: number}[]}
 */
export function probePositions(level, count = DEFAULT_PROBE_COUNT) {
  const requested = Number(count);
  const total = Number.isFinite(requested)
    ? Math.max(1, Math.min(3, Math.round(requested)))
    : DEFAULT_PROBE_COUNT;
  const platforms = Array.isArray(level?.platforms)
    ? level.platforms.filter(
        (platform) =>
          platform &&
          Array.isArray(platform.pos) &&
          platform.pos.length >= 3 &&
          Array.isArray(platform.size) &&
          platform.size.length >= 2,
      )
    : [];
  if (platforms.length === 0) {
    const fallback = [];
    for (let i = 0; i < total; i += 1) fallback.push({ x: 0, y: 8, z: -30 - i * 90 });
    return fallback;
  }
  const positions = [];
  for (let i = 0; i < total; i += 1) {
    const index = Math.min(
      platforms.length - 1,
      Math.round(((i + 1) / (total + 1)) * (platforms.length - 1)),
    );
    const platform = platforms[index];
    positions.push({
      x: platform.pos[0],
      y: platform.pos[1] + platform.size[1] / 2 + 1.7,
      z: platform.pos[2],
    });
  }
  return positions;
}

/**
 * Capture the live scene into prefiltered cube textures.
 * @param {any} game
 * @param {any} level
 * @param {{positions?: {x: number, y: number, z: number}[], count?: number, size?: number,
 *   quality?: string}} [options]
 * @returns {{textures: any[], categories: Record<string, any>, dispose: () => void} | null}
 */
export function createReflectionProbes(game, level, options = {}) {
  if (!canCaptureReflections(game)) return null;
  if (!resolveProbeQuality(options.quality ?? game.quality?.name)) return null;
  const { THREE, renderer, scene } = game;
  const cubeSize = Math.max(32, Math.min(256, Math.round(Number(options.size) || CUBE_SIZE)));
  const positions =
    Array.isArray(options.positions) && options.positions.length
      ? options.positions
      : probePositions(level, options.count ?? DEFAULT_PROBE_COUNT);

  const savedFog = scene.fog;
  // The engine renders with manual clears (renderer.autoClear = false) because it
  // drives a multi-pass post chain. A cube capture is a plain render, so it needs
  // autoClear back on or the six faces share stale colour/depth from each other.
  const savedAutoClear = renderer.autoClear;
  const targets = [];
  let cubeTarget = null;
  let pmrem = null;
  try {
    renderer.autoClear = true;
    cubeTarget = new THREE.WebGLCubeRenderTarget(cubeSize, { generateMipmaps: false });
    const camera = new THREE.CubeCamera(0.4, 600, cubeTarget);
    camera.layers.set(0);
    // Fog is a screen-space distance cue tuned for the player's camera; inside a
    // reflection it would wash every neighbouring tower into the same haze. Drop
    // it for the capture so the glass reflects a crisper city.
    scene.fog = null;
    pmrem = new THREE.PMREMGenerator(renderer);
    const textures = [];
    for (const position of positions) {
      camera.position.set(position.x, position.y, position.z);
      camera.updateMatrixWorld(true);
      camera.update(renderer, scene);
      const target = pmrem.fromCubemap(cubeTarget.texture);
      targets.push(target);
      textures.push(target.texture);
    }
    if (textures.length === 0) return null;
    return {
      textures,
      categories: {
        glass: textures[0],
        metal: textures[Math.min(1, textures.length - 1)],
      },
      dispose() {
        for (const target of targets) target.dispose();
        pmrem?.dispose();
        cubeTarget?.dispose();
      },
    };
  } catch (error) {
    console.warn('[reflections] scene probe capture unavailable', error);
    return null;
  } finally {
    scene.fog = savedFog;
    renderer.autoClear = savedAutoClear;
    try {
      renderer.setRenderTarget(null);
    } catch {
      /* renderer already disposed */
    }
  }
}

/**
 * Point every material tagged with `userData.reflections` at the captured probe
 * and raise its environment intensity. Shared materials are only updated once.
 * @param {any} root
 * @param {{textures: any[], categories: Record<string, any>}} probes
 * @param {{glassIntensity?: number, metalIntensity?: number}} [options]
 * @returns {number} number of materials updated
 */
export function assignReflectionProbes(root, probes, options = {}) {
  if (!root || !probes || !probes.categories) return 0;
  const glassIntensity = Number(options.glassIntensity) || INTENSITIES.glass;
  const metalIntensity = Number(options.metalIntensity) || INTENSITIES.metal;
  const seen = new Set();
  let assigned = 0;
  const visit = (object) => {
    if (!object?.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || seen.has(material)) continue;
      const category = material.userData?.reflections;
      if (!category) continue;
      seen.add(material);
      const texture = probes.categories[category] || probes.textures?.[0];
      if (!texture || !('envMap' in material)) continue;
      material.envMap = texture;
      material.envMapIntensity = category === 'glass' ? glassIntensity : metalIntensity;
      material.needsUpdate = true;
      assigned += 1;
    }
  };
  if (typeof root.traverse === 'function') root.traverse(visit);
  else if (Array.isArray(root)) root.forEach(visit);
  return assigned;
}
