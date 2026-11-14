// @ts-check
// Soft contact-shadow decals under rooftop props. One instanced draw call. They
// add the small ambient-occlusion read at a prop's base that the shadow map is
// too coarse to give.

export const CONTACT = { margin: 0.45, lift: 0.012, opacity: 0.6, color: 0x1d2a31 };

/**
 * Footprint of a decal for a prop, centred on the prop and never reaching past
 * the slab edge (symmetric margin, so the dark core stays under the prop).
 * @param {{x: number, z: number, w: number, d: number}} prop
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} slab
 * @param {number} [margin]
 * @returns {{x: number, z: number, w: number, d: number}}
 */
export function contactFootprint(prop, slab, margin = CONTACT.margin) {
  const room = (min, max, center, size) =>
    Math.max(0, Math.min(margin, center - size / 2 - min, max - (center + size / 2)));
  const mx = room(slab.minX, slab.maxX, prop.x, prop.w);
  const mz = room(slab.minZ, slab.maxZ, prop.z, prop.d);
  return { x: prop.x, z: prop.z, w: prop.w + mx * 2, d: prop.d + mz * 2 };
}

/**
 * @param {any} THREE
 * @returns {any} a CanvasTexture with a soft, rectangular alpha falloff
 */
export function createContactTexture(THREE) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const steps = 28;
  for (let i = 0; i < steps; i += 1) {
    const inset = (i / steps) * (size / 2);
    // White RGB: the material colour supplies the tint, this texture only
    // carries the alpha falloff.
    context.fillStyle = `rgba(255, 255, 255, ${0.9 / steps})`;
    context.fillRect(inset, inset, size - inset * 2, size - inset * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * @param {any} THREE
 * @param {{x: number, y: number, z: number, w: number, d: number}[]} decals
 * @returns {any | null}
 */
export function buildContactShadows(THREE, decals) {
  if (!decals.length) return null;
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: createContactTexture(THREE),
    color: CONTACT.color,
    transparent: true,
    opacity: CONTACT.opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, decals.length);
  mesh.name = 'contact-shadows';
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  decals.forEach((decal, index) => {
    matrix.compose(
      new THREE.Vector3(decal.x, decal.y, decal.z),
      quaternion,
      new THREE.Vector3(decal.w, 1, decal.d),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
