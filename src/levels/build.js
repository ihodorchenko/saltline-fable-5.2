// @ts-check
// Build a playable level from tutorial data: meshes, AABB colliders, checkpoint
// rings and a finish gate. No Saltline-specific imports.

import { validateLevel } from './validate.js';

/**
 * @param {any} game
 * @param {any} level
 * @returns {{root: any, checkpointMeshes: any[], finishMesh: any}}
 */
export function buildLevel(game, level) {
  const errors = validateLevel(level);
  if (errors.length) throw new Error(`Invalid level: ${errors.join(', ')}`);

  const { THREE, scene } = game;
  const root = new THREE.Group();
  root.name = `glassline-level-${level.id}`;

  const standard = (color, rough = 0.8) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.03 });

  const roofMat = game.mats && game.mats.get ? game.mats.get('concrete') : standard(0xb9c0c6);

  for (const platform of level.platforms) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...platform.size), roofMat);
    mesh.name = `platform-${platform.id}`;
    mesh.position.fromArray(platform.pos);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);
    if (game.physics) {
      const [x, y, z] = platform.pos;
      const [w, h, d] = platform.size;
      game.physics.addBox([x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2], {
        surface: platform.material || 'concrete',
        tag: platform.tag || '',
      });
    }
  }

  for (const obstacle of level.obstacles || []) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...obstacle.size),
      standard(obstacle.color || 0xe6e8e6),
    );
    mesh.name = `obstacle-${obstacle.id}`;
    mesh.position.fromArray(obstacle.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (game.physics && obstacle.collider !== false) {
      const [x, y, z] = obstacle.pos;
      const [w, h, d] = obstacle.size;
      game.physics.addBox([x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2], {
        surface: obstacle.material || 'concrete',
        tag: obstacle.tag || '',
      });
    }
  }

  const checkpointMeshes = [];
  for (const checkpoint of level.checkpoints) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xb51f2a }),
    );
    mesh.name = `checkpoint-${checkpoint.id}`;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(checkpoint.pos[0], checkpoint.pos[1] + 0.08, checkpoint.pos[2]);
    root.add(mesh);
    checkpointMeshes.push(mesh);
  }

  const finishMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.09, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xd23a39 }),
  );
  finishMesh.name = 'glassline-finish';
  finishMesh.rotation.x = Math.PI / 2;
  finishMesh.position.set(level.finish.pos[0], level.finish.pos[1] + 0.08, level.finish.pos[2]);
  root.add(finishMesh);

  const hemisphere = new THREE.HemisphereLight(0xcfe6ff, 0x30343a, 2.0);
  const key = new THREE.DirectionalLight(0xffe2b8, 3.0);
  key.position.set(-8, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  scene.add(hemisphere, key);
  game.physics?.build?.();
  scene.add(root);
  return { root, checkpointMeshes, finishMesh };
}
