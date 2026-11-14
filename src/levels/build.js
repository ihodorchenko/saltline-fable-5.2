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
    context.fillStyle = '#d23a39';
    context.fillRect(260, canvas.height - 16, 504, 4);
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
  const sideMat = standard(0x3d4a52, 0.95);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xa8b4b7,
    transparent: true,
    opacity: 0.22,
  });
  const textureCache = new Map();

  const makeSurfaceTexture = (hex) => {
    if (textureCache.has(hex)) return textureCache.get(hex);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const css = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillStyle = css;
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = 'rgba(28, 36, 40, 0.1)';
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 73) % 256;
      const y = (i * 41) % 256;
      context.fillRect(x, y, 2, 2);
    }
    context.strokeStyle = 'rgba(28, 36, 40, 0.16)';
    context.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      context.beginPath();
      context.moveTo(0, i * 64 + 0.5);
      context.lineTo(256, i * 64 + 0.5);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(hex, texture);
    return texture;
  };

  for (const [index, platform] of level.platforms.entries()) {
    const color = platform.color || palette[index % palette.length];
    const topMat = new THREE.MeshStandardMaterial({
      map: makeSurfaceTexture(color),
      roughness: 0.9,
      metalness: 0.04,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...platform.size), [
      sideMat,
      sideMat,
      topMat,
      sideMat,
      sideMat,
      sideMat,
    ]);
    mesh.name = `platform-${platform.id}`;
    mesh.position.fromArray(platform.pos);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
    edges.name = 'platform-edge';
    mesh.add(edges);
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

    const [sx, sy, sz] = scenery.pos;
    const [sw, sh] = scenery.size;
    const innerX = sx + (sx > 0 ? -sw / 2 - 0.03 : sw / 2 + 0.03);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.75, 0.42),
          new THREE.MeshBasicMaterial({
            color: 0xe0b06a,
            transparent: true,
            opacity: 0.55,
          }),
        );
        windowMesh.name = 'window-light';
        windowMesh.position.set(innerX, sy + sh * 0.12 + row * 1.15, sz - sw * 0.22 + col * sw * 0.34);
        root.add(windowMesh);
      }
    }
  }

  const propMetal = standard(0x68757c, 0.72);
  for (const prop of level.props || []) {
    const group = new THREE.Group();
    group.name = `prop-${prop.id}`;
    group.position.fromArray(prop.pos);

    if (prop.type === 'ac') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(...(prop.size || [1.4, 1, 1.4])), propMetal);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      const slatMat = standard(0x2e3a40, 0.8);
      for (let i = 0; i < 4; i += 1) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(prop.size[0] * 0.82, 0.035, 0.06), slatMat);
        slat.position.set(0, 0.18 + i * 0.16, prop.size[2] / 2 + 0.02);
        group.add(slat);
      }
    } else if (prop.type === 'vent') {
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(prop.radius || 0.3, prop.radius || 0.3, prop.height || 1, 12),
        propMetal,
      );
      vent.castShadow = true;
      group.add(vent);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry((prop.radius || 0.3) * 1.3, (prop.radius || 0.3) * 1.3, 0.08, 12),
        standard(0x9aa4a8, 0.6),
      );
      cap.position.y = (prop.height || 1) / 2;
      group.add(cap);
    } else if (prop.type === 'antenna') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, prop.height || 4, 8), propMetal);
      mast.position.y = (prop.height || 4) / 2;
      mast.castShadow = true;
      group.add(mast);
      for (let i = 0; i < 3; i += 1) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5 - i * 0.3, 0.035, 0.035), propMetal);
        bar.position.y = (prop.height || 4) * (0.55 + i * 0.12);
        group.add(bar);
      }
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xd23a39 }),
      );
      light.position.y = prop.height || 4;
      group.add(light);
    } else if (prop.type === 'rail') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(...prop.size), propMetal);
      group.add(bar);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), propMetal);
        post.position.set((prop.size[0] / 2) * side, -0.45, 0);
        group.add(post);
      }
    }
    root.add(group);
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

  scene.fog = new THREE.Fog(0x87939b, 34, 125);
  const hemisphere = new THREE.HemisphereLight(0xcfe6ff, 0x30343a, 2.0);
  const key = new THREE.DirectionalLight(0xffe2b8, 3.0);
  key.position.set(-8, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  const rim = new THREE.DirectionalLight(0x86b7d4, 1.6);
  rim.position.set(14, 8, -24);
  const warm = new THREE.DirectionalLight(0xff7a4d, 0.8);
  warm.position.set(-12, 4, -60);
  scene.add(hemisphere, key, rim, warm);
  if (game.render && game.render.exposure != null) game.render.exposure = 1.06;
  game.physics?.build?.();
  scene.add(root);
  return { root, checkpointMeshes, finishMesh };
}
