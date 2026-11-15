// @ts-check
// Painted safety stripe inset from every platform edge. It gives the large flat
// roofs a scale cue and a clear edge read without adding any colour: one thin
// steel-grey frame per platform, drawn as a single instanced mesh. It is darker
// than the ivory concrete on purpose: a paler stripe disappears.

export const STRIPE = {
  inset: 0.3,
  width: 0.1,
  thickness: 0.01,
  lift: 0.005,
  color: 0x7f9097,
};

/**
 * Four non-overlapping rectangles forming a frame inset from the slab edge.
 * Returns [] when the slab is too small to hold one.
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} slab
 * @param {number} [inset]
 * @param {number} [width]
 * @returns {{x: number, z: number, w: number, d: number}[]}
 */
export function edgeStripes(slab, inset = STRIPE.inset, width = STRIPE.width) {
  const x0 = slab.minX + inset;
  const x1 = slab.maxX - inset;
  const z0 = slab.minZ + inset;
  const z1 = slab.maxZ - inset;
  if (x1 - x0 < width * 4 || z1 - z0 < width * 4) return [];
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const spanX = x1 - x0 + width;
  const spanZ = z1 - z0 - width;
  return [
    { x: cx, z: z0, w: spanX, d: width },
    { x: cx, z: z1, w: spanX, d: width },
    { x: x0, z: cz, w: width, d: spanZ },
    { x: x1, z: cz, w: width, d: spanZ },
  ];
}

/**
 * @param {any} THREE
 * @param {any[]} matrices Matrix4 per stripe
 * @returns {any | null}
 */
export function buildFloorStripes(THREE, matrices) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: STRIPE.color,
      roughness: 0.85,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    matrices.length,
  );
  mesh.name = 'floor-stripes';
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
