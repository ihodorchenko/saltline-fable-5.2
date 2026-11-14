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

  const makeLabel = (text) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(8, 12, 16, 0.78)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#eef1ef';
    context.font = '700 58px "IBM Plex Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    sprite.scale.set(6, 0.94, 1);
    return sprite;
  };

  const palette = level.palette || [0xd7d2c6, 0xc3cbca, 0xb3bdc2];
  const routeMat = new THREE.MeshBasicMaterial({ color: 0xb51f2a });

  for (const [index, platform] of level.platforms.entries()) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...platform.size),
      standard(platform.color || palette[index % palette.length], 0.86),
    );
    mesh.name = `platform-${platform.id}`;
    mesh.position.fromArray(platform.pos);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);

    const [px, py, pz] = platform.pos;
    const [pw, ph, pd] = platform.size;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, Math.min(1.5, pd * 0.35)), routeMat);
    strip.name = `route-strip-${platform.id}`;
    strip.position.set(px, py + ph / 2 + 0.012, pz);
    root.add(strip);

    if (game.physics) {
      game.physics.addBox([px - pw / 2, py - ph / 2, pz - pd / 2], [px + pw / 2, py + ph / 2, pz + pd / 2], {
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

  for (const scenery of level.scenery || []) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...scenery.size),
      standard(scenery.color || 0x7a858b, 0.95),
    );
    mesh.name = 'scenery';
    mesh.position.fromArray(scenery.pos);
    root.add(mesh);
  }

  for (const act of level.acts || []) {
    const label = makeLabel(act.title);
    label.name = `sign-${act.id}`;
    label.position.fromArray(act.pos);
    root.add(label);
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

  const startLine = new THREE.Mesh(new THREE.BoxGeometry(4, 0.025, 0.2), routeMat);
  startLine.name = 'start-line';
  startLine.position.set(level.spawn.x, level.spawn.y + 0.02, level.spawn.z - 0.9);
  root.add(startLine);

  const finish = level.finish.pos;
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0xb51f2a,
    emissive: 0x2a0205,
    emissiveIntensity: 0.45,
    roughness: 0.55,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, 0.28), gateMat);
    post.name = 'finish-post';
    post.position.set(finish[0] + side * 2.1, finish[1] + 1.25, finish[2]);
    post.castShadow = true;
    root.add(post);
  }
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.28, 0.28), gateMat);
  gateTop.name = 'finish-gate';
  gateTop.position.set(finish[0], finish[1] + 2.5, finish[2]);
  gateTop.castShadow = true;
  root.add(gateTop);

  scene.fog = new THREE.Fog(0x9aa4ad, 34, 125);
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
