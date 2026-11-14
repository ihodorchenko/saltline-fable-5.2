// @ts-check
// GLASSLINE Step 0 prototype. This is a standalone showcase scene: a clean
// rooftop block, a first-person-height capsule, a red traversal accent and a
// fixed camera. The real movement controller arrives in later steps.

/**
 * @typedef {import('../../../types/engine').GameContext} GameContext
 * @typedef {{cam: number[], target: number[], update: (dt: number) => void}} Showcase
 */

import { createPlayerController } from './player.js';

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

  // A stepped collider under a smooth-looking ramp. The engine currently moves
  // capsules against AABBs, so the visual ramp is paired with 8 shallow steps
  // until the smooth slope solver lands in Step 1b/2.
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 6), whiteMaterial);
  ramp.name = 'glassline-ramp';
  ramp.position.set(5, 0.61, -8);
  ramp.rotation.x = -Math.atan2(1.2, 6);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  root.add(ramp);
  if (game.physics) {
    for (let i = 0; i < 8; i++) {
      const z0 = -5 - i * 0.75;
      const z1 = z0 - 0.76;
      const height = (i + 1) * 0.15;
      game.physics.addBox([3.5, 0, z1], [6.5, height, z0], {
        surface: 'concrete',
      });
    }
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.25, 2),
    redMaterial,
  );
  platform.name = 'glassline-moving-platform';
  platform.position.set(2, 1.2, -5);
  platform.castShadow = true;
  platform.receiveShadow = true;
  root.add(platform);
  root.userData.glasslinePlatform = platform;

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

  // Step 1 sandbox colliders. The visual meshes and the AABB colliders are
  // intentionally separate so later level tooling can replace the layout.
  if (game.physics) {
    game.physics.addBox([-13, -0.5, -21], [13, 0, 13], { surface: 'concrete' });
    game.physics.addBox([-9.5, 0, -15], [-0.5, 0.25, -1], { surface: 'concrete' });
    game.physics.addBox([0, 0, -2.6], [1.6, 0.9, -1], { surface: 'metal' });
    game.physics.addBox([-9.5, 0.25, -15], [-9.1, 1.5, -1], { surface: 'metal' });
    root.userData.glasslinePlatformBox = game.physics.addBox(
      [1, 1.075, -6],
      [3, 1.325, -4],
      { surface: 'metal', tag: 'moving-platform' },
    );
    game.physics.build();
  }
  return root;
}

/**
 * @param {GameContext} game
 * @returns {Promise<Showcase>}
 */
export async function showcaseGlassline(game) {
  const root = createPrototype(game);
  const player = root.getObjectByName(PLAYER_NAME);
  if (player) player.visible = false;
  const controller = createPlayerController(game);
  const platform = root.userData.glasslinePlatform;
  const platformBox = root.userData.glasslinePlatformBox;
  game.glassline = { controller, root, platform };
  if (game.render && game.render.exposure != null) game.render.exposure = 1.0;
  let clock = 0;
  // No `cam` field: the capsule controller owns the camera every frame.
  return {
    update(dt) {
      clock += dt;
      if (platform && platformBox) {
        const y = 1.2 + Math.sin(clock * 0.8) * 0.25;
        platform.position.y = y;
        platformBox.min.y = y - 0.125;
        platformBox.max.y = y + 0.125;
      }
      controller.update(dt);
    },
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
