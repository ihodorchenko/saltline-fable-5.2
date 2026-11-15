// @ts-check
// Route guide objects: checkpoint rings, the finish ring and the next-checkpoint
// beacon. Red is the strongest saturation on screen, so guides must stay crisp:
// fine, smooth tori; an opaque, lit beacon that is not washed out by fog.

export const GUIDE = {
  ring: { radius: 0.62, tube: 0.04, radial: 12, segments: 64, lowRadial: 8, lowSegments: 28 },
  finish: { radius: 1.25, tube: 0.06, radial: 12, segments: 72, lowRadial: 8, lowSegments: 36 },
  beacon: { size: 0.28, color: 0xd23a39, emissive: 0x8a1418, edge: 0x1b2429, intensity: 0.5 },
};

/**
 * Shared by every checkpoint ring: one geometry instead of one per checkpoint.
 * @param {any} THREE
 * @returns {any}
 */
export function createRingGeometry(THREE, low = false) {
  const { radius, tube, radial, segments, lowRadial, lowSegments } = GUIDE.ring;
  return new THREE.TorusGeometry(radius, tube, low ? lowRadial : radial, low ? lowSegments : segments);
}

/**
 * @param {any} THREE
 * @returns {any}
 */
export function createFinishGeometry(THREE, low = false) {
  const { radius, tube, radial, segments, lowRadial, lowSegments } = GUIDE.finish;
  return new THREE.TorusGeometry(radius, tube, low ? lowRadial : radial, low ? lowSegments : segments);
}

/**
 * A solid, faceted gem with a thin ink outline. Opaque and fog-free so it stays
 * the clearest thing in the haze; flat-shaded and lit so facets read as a form
 * instead of a flat cut-out.
 * @param {any} THREE
 * @returns {any} a Group named glassline-next-checkpoint
 */
export function createBeacon(THREE) {
  const { size, color, emissive, edge, intensity } = GUIDE.beacon;
  const geometry = new THREE.OctahedronGeometry(size);
  const gem = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: intensity,
      roughness: 0.4,
      metalness: 0,
      flatShading: true,
      fog: false,
    }),
  );
  gem.name = 'beacon-gem';
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: edge, fog: false }),
  );
  outline.name = 'beacon-outline';
  const group = new THREE.Group();
  group.name = 'glassline-next-checkpoint';
  group.add(gem, outline);
  return group;
}
