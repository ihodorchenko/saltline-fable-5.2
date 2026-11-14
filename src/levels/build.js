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
  const sideMat = standard(0x5b6b72, 0.92);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xa8b4b7,
    transparent: true,
    opacity: 0.22,
  });
  const textureCache = new Map();
  const edgePositions = [];
  const stripMatrices = [];
  const windowMatrices = [];
  const detailed = game.quality?.name !== 'low';
  const stripGeometry = new THREE.BoxGeometry(1, 1, 1);
  const windowGeometry = new THREE.BoxGeometry(0.05, 0.75, 0.42);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8edf5,
    transparent: true,
    opacity: 0.78,
  });

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
    root.add(mesh);

    const [px, py, pz] = platform.pos;
    const [pw, ph, pd] = platform.size;
    if (detailed) {
      const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
      const positions = edgeGeometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        edgePositions.push(positions.getX(i) + px, positions.getY(i) + py, positions.getZ(i) + pz);
      }
      edgeGeometry.dispose();
    }
    stripMatrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(px, py + ph / 2 + 0.012, pz),
        new THREE.Quaternion(),
        new THREE.Vector3(0.18, 0.025, Math.min(1.5, pd * 0.35)),
      ),
    );

    if (game.physics) {
      game.physics.addBox([px - pw / 2, py - ph / 2, pz - pd / 2], [px + pw / 2, py + ph / 2, pz + pd / 2], {
        surface: platform.material || 'concrete',
        tag: platform.tag || '',
      });
    }
  }

  if (edgePositions.length) {
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    const edges = new THREE.LineSegments(edgeGeometry, edgeMat);
    edges.name = 'platform-edges';
    root.add(edges);
  }

  if (stripMatrices.length) {
    const strips = new THREE.InstancedMesh(stripGeometry, routeMat, stripMatrices.length);
    strips.name = 'route-strips';
    stripMatrices.forEach((matrix, index) => strips.setMatrixAt(index, matrix));
    strips.instanceMatrix.needsUpdate = true;
    strips.computeBoundingSphere();
    root.add(strips);
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
        windowMatrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(innerX, sy + sh * 0.12 + row * 1.15, sz - sw * 0.22 + col * sw * 0.34),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1),
          ),
        );
      }
    }
  }

  if (windowMatrices.length) {
    const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, windowMatrices.length);
    windows.name = 'window-lights';
    windowMatrices.forEach((matrix, index) => windows.setMatrixAt(index, matrix));
    windows.instanceMatrix.needsUpdate = true;
    windows.computeBoundingSphere();
    root.add(windows);
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
    } else if (prop.type === 'planter') {
      const size = prop.size || [1.4, 0.6, 0.7];
      const base = new THREE.Mesh(new THREE.BoxGeometry(...size), standard(0x879398, 0.92));
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);
      const leaves = new THREE.Mesh(
        new THREE.BoxGeometry(size[0] * 0.84, 0.12, size[2] * 0.78),
        standard(prop.color || 0x78977d, 0.95),
      );
      leaves.position.y = size[1] / 2 + 0.06;
      group.add(leaves);
      for (const side of [-1, 0, 1]) {
        const tuft = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.6, 7),
          standard(prop.color || 0x78977d, 1),
        );
        tuft.position.set(side * size[0] * 0.22, size[1] / 2 + 0.34, 0);
        group.add(tuft);
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

  scene.fog = new THREE.Fog(0xcfe0e7, 62, 240);
  const hemisphere = new THREE.HemisphereLight(0xeaf7ff, 0x7d898b, 2.6);
  const key = new THREE.DirectionalLight(0xffe5c0, 3.5);
  key.position.set(-8, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  const rim = new THREE.DirectionalLight(0xa9d9ff, 1.8);
  rim.position.set(14, 8, -24);
  const warm = new THREE.DirectionalLight(0xffa56f, 0.7);
  warm.position.set(-12, 4, -60);
  scene.add(hemisphere, key, rim, warm);
  if (game.render && game.render.exposure != null) {
    game.render.exposure = 1.18;
  }
  const sky = game.render?.sky || game.scene?.getObjectByName?.('sky');
  if (sky?.material?.uniforms) {
    const uniforms = sky.material.uniforms;
    uniforms.uZen?.value?.set?.(0.09, 0.34, 0.66);
    uniforms.uHor?.value?.set?.(0.86, 0.93, 0.96);
    uniforms.uHorAway?.value?.set?.(0.6, 0.74, 0.82);
    uniforms.uSunCol?.value?.set?.(1, 0.82, 0.62);
    sky.material.needsUpdate = true;
  }
  // Original procedural sun glow: a soft utopian light source beyond the route.
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 256;
  sunCanvas.height = 256;
  const sunContext = sunCanvas.getContext('2d');
  const sunGradient = sunContext.createRadialGradient(128, 128, 0, 128, 128, 128);
  sunGradient.addColorStop(0, 'rgba(255, 246, 218, 0.95)');
  sunGradient.addColorStop(0.12, 'rgba(255, 225, 174, 0.72)');
  sunGradient.addColorStop(0.42, 'rgba(255, 184, 122, 0.2)');
  sunGradient.addColorStop(1, 'rgba(255, 184, 122, 0)');
  sunContext.fillStyle = sunGradient;
  sunContext.fillRect(0, 0, 256, 256);
  const sunTexture = new THREE.CanvasTexture(sunCanvas);
  sunTexture.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunSprite.name = 'glassline-sun';
  sunSprite.position.set(34, 58, -190);
  sunSprite.scale.set(110, 110, 1);
  sunSprite.renderOrder = -1;
  root.add(sunSprite);
  game.physics?.build?.();
  scene.add(root);
  return { root, checkpointMeshes, finishMesh };
}
