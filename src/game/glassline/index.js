// @ts-check
// GLASSLINE Step 0 prototype. This is a standalone showcase scene: a clean
// rooftop block, a first-person-height capsule, a red traversal accent and a
// fixed camera. The real movement controller arrives in later steps.

/**
 * @typedef {import('../../../types/engine').GameContext} GameContext
 * @typedef {{cam: number[], target: number[], update: (dt: number) => void}} Showcase
 */

const PROTOTYPE_NAME = 'glassline-prototype';
const PLAYER_NAME = 'glassline-player';

/**
 * @param {GameContext} game
 * @param {any} material
 * @param {number} color
 * @returns {any}
 */
function standardMaterial(game, material, color) {
  if (material) return material;
  return new game.THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.05,
  });
}

/**
 * @param {GameContext} game
 * @returns {any}
 */
function createLights(game) {
  const { THREE } = game;
  const hemisphere = new THREE.HemisphereLight(0xcfe6ff, 0x30343a, 2.0);
  const key = new THREE.DirectionalLight(0xffe2b8, 3.0);
  key.position.set(-6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  return [hemisphere, key];
}

/**
 * @param {GameContext} game
 * @returns {any}
 */
function createPrototype(game) {
  const { THREE, scene } = game;
  const root = new THREE.Group();
  root.name = PROTOTYPE_NAME;

  const groundMaterial = standardMaterial(
    game,
    game.mats && game.mats.get ? game.mats.get('concrete') : null,
    0xb9c0c6,
  );
  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xb51f2a,
    emissive: 0x2a0205,
    emissiveIntensity: 0.4,
    roughness: 0.55,
    metalness: 0.08,
  });
  const whiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6e8e6,
    roughness: 0.8,
    metalness: 0.02,
  });

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.5, 34),
    groundMaterial,
  );
  ground.name = 'glassline-ground';
  ground.position.set(0, -0.25, -4);
  ground.receiveShadow = true;
  root.add(ground);

  const roofDeck = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.25, 14),
    whiteMaterial,
  );
  roofDeck.name = 'glassline-deck';
  roofDeck.position.set(-5, 0.125, -8);
  roofDeck.receiveShadow = true;
  roofDeck.castShadow = true;
  root.add(roofDeck);

  const player = new THREE.Group();
  player.name = PLAYER_NAME;
  player.position.set(-2.4, 1.15, 2.2);
  player.rotation.y = 0.18;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.92, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1d2226,
      roughness: 0.6,
      metalness: 0.1,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  player.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8b29a, roughness: 0.8 }),
  );
  head.position.y = 0.78;
  head.castShadow = true;
  player.add(head);
  root.add(player);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 8), redMaterial);
  beam.name = 'glassline-route-beam';
  beam.position.set(-3.2, 0.6, -5.5);
  beam.rotation.y = 0.08;
  beam.castShadow = true;
  beam.receiveShadow = true;
  root.add(beam);

  const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), whiteMaterial);
  block.name = 'glassline-vault-block';
  block.position.set(0.8, 0.45, -1.8);
  block.castShadow = true;
  block.receiveShadow = true;
  root.add(block);

  const marker = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.18), redMaterial);
  marker.name = 'glassline-start-marker';
  marker.position.set(0, 0.03, 1.4);
  root.add(marker);

  // A few low-poly city blocks give the prototype a readable rooftop scale
  // without committing to a level layout yet.
  const skyline = [
    [-11, 5, -19, 4, 10, 6, 0x8b9298],
    [10, 4, -17, 5, 8, 7, 0x9ba1a5],
    [-18, 7, -27, 6, 14, 8, 0x7f868c],
    [3, 6, -26, 7, 12, 6, 0xa4a9ab],
    [18, 9, -30, 6, 18, 8, 0x737b82],
  ];
  for (const [x, y, z, w, h, d, color] of skyline) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    tower.name = 'glassline-skyline';
    tower.position.set(x, y, z);
    tower.castShadow = false;
    tower.receiveShadow = false;
    root.add(tower);
  }

  const edge = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 0.4), whiteMaterial);
  edge.name = 'glassline-roof-edge';
  edge.position.set(-5, 0.55, -15);
  edge.castShadow = true;
  edge.receiveShadow = true;
  root.add(edge);

  for (const light of createLights(game)) scene.add(light);
  scene.add(root);
  return root;
}

/**
 * @param {GameContext} game
 * @returns {Promise<Showcase>}
 */
export async function showcaseGlassline(game) {
  createPrototype(game);
  game.camera.position.set(0, 2.6, 8.6);
  game.camera.lookAt(0, 0.9, -2.2);
  if (game.render && game.render.exposure != null) game.render.exposure = 1.0;
  return {
    cam: [0, 2.6, 8.6],
    target: [0, 0.9, -2.2],
    update() {},
  };
}

/**
 * Registry entry for `src/modes`. A real game factory replaces this in Step 1.
 */
export const glasslineMode = {
  /** @param {GameContext} game */
  create: async (game) => showcaseGlassline(game),
  /** @param {GameContext} game */
  showcase: showcaseGlassline,
};
