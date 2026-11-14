// @ts-check
// Build a playable level from tutorial data: meshes, AABB colliders, checkpoint
// rings and a finish gate. No game-specific imports.

import { validateLevel } from './validate.js';
import { buildCity, createCityPlan } from './city.js';
import { createTextureFactory } from './textures.js';
import { createHighKeySky } from './sky.js';
import { createLighting, SUN_DIRECTION } from './lighting.js';
import { CONTACT, buildContactShadows, contactFootprint } from './contact.js';

/**
 * @param {any} game
 * @param {any} level
 * @returns {{root: any, checkpointMeshes: any[], finishMesh: any, city: any, lighting: any}}
 */
export function buildLevel(game, level) {
  const errors = validateLevel(level);
  if (errors.length) throw new Error(`Invalid level: ${errors.join(', ')}`);

  const { THREE, scene } = game;
  const root = new THREE.Group();
  root.name = `glassline-level-${level.id}`;

  const textures = createTextureFactory(game);
  const standard = (color, rough = 0.8, map = null) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: 0.04,
      ...(map ? { map } : {}),
    });

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
  const routeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.red(),
    emissive: 0x7a0e12,
    emissiveIntensity: 1.05,
    roughness: 0.38,
    metalness: 0.05,
  });
  const sideMat = standard(0xffffff, 0.92, textures.side());
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xa8b4b7,
    transparent: true,
    opacity: 0.22,
  });
  const edgePositions = [];
  const stripMatrices = [];
  const windowMatrices = [];
  const fasciaMatrices = [];
  const curbMatrices = [];
  const columnMatrices = [];
  const acMatrices = [];
  const ventMatrices = [];
  const hutMatrices = [];
  const pipeMatrices = [];
  const railBarMatrices = [];
  const railPostMatrices = [];
  const solarMatrices = [];
  const doorMatrices = [];
  const contactDecals = [];
  const detailed = game.quality?.name !== 'low';
  const stripGeometry = new THREE.BoxGeometry(1, 1, 1);
  const windowGeometry = new THREE.BoxGeometry(0.05, 0.75, 0.42);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8edf5,
    transparent: true,
    opacity: 0.78,
  });

  for (const [index, platform] of level.platforms.entries()) {
    const color = platform.color || palette[index % palette.length];
    const topTexture = textures.concrete(color).clone();
    topTexture.repeat.set(
      Math.max(1, Math.round(platform.size[0] / 4)),
      Math.max(1, Math.round(platform.size[2] / 4)),
    );
    topTexture.needsUpdate = true;
    const topMat = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.84,
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

    const topY = py + ph / 2;
    const pushBox = (list, w, h, d, x, y, z) => {
      list.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion(),
          new THREE.Vector3(w, h, d),
        ),
      );
    };
    const slab = { minX: px - pw / 2, maxX: px + pw / 2, minZ: pz - pd / 2, maxZ: pz + pd / 2 };
    const pushContact = (w, d, x, z) =>
      contactDecals.push({ ...contactFootprint({ x, z, w, d }, slab), y: topY + CONTACT.lift });
    // Dark metal fascia band and a shallow roof curb give every slab real edges.
    pushBox(fasciaMatrices, pw, 0.34, 0.1, px, topY - 0.2, pz + pd / 2 + 0.05);
    pushBox(fasciaMatrices, pw, 0.34, 0.1, px, topY - 0.2, pz - pd / 2 - 0.05);
    pushBox(fasciaMatrices, 0.1, 0.34, pd, px + pw / 2 + 0.05, topY - 0.2, pz);
    pushBox(fasciaMatrices, 0.1, 0.34, pd, px - pw / 2 - 0.05, topY - 0.2, pz);
    pushBox(curbMatrices, pw, 0.09, 0.13, px, topY + 0.045, pz + pd / 2 - 0.08);
    pushBox(curbMatrices, pw, 0.09, 0.13, px, topY + 0.045, pz - pd / 2 + 0.08);
    pushBox(curbMatrices, 0.13, 0.09, pd, px + pw / 2 - 0.08, topY + 0.045, pz);
    pushBox(curbMatrices, 0.13, 0.09, pd, px - pw / 2 + 0.08, topY + 0.045, pz);

    // Structural legs down to the street; purely visual.
    const streetY = level.city?.streetY ?? -18;
    if (pw > 2.4 && py - ph / 2 > streetY + 3 && index % 2 === 0) {
      const legTop = py - ph / 2;
      const legHeight = legTop - streetY;
      const legY = streetY + legHeight / 2;
      for (const side of [-1, 1]) {
        pushBox(columnMatrices, 0.4, legHeight, 0.4, px + side * (pw / 2 - 0.55), legY, pz);
      }
    }

    // Rooftop services sit on the edges, never on the route line.
    if (pw > 4.4 && pd > 2.6) {
      pushBox(acMatrices, 1.05, 0.75, 0.8, px - pw / 2 + 1.1, topY + 0.4, pz - pd / 2 + 1.05);
      pushContact(1.05, 0.8, px - pw / 2 + 1.1, pz - pd / 2 + 1.05);
      if (index % 2 === 0) {
        pushBox(ventMatrices, 0.32, 1.1, 0.32, px + pw / 2 - 1.15, topY + 0.55, pz + pd / 2 - 1.1);
        pushContact(0.32, 0.32, px + pw / 2 - 1.15, pz + pd / 2 - 1.1);
      }
      if (index % 5 === 2 || index === 0) {
        pushBox(hutMatrices, 1.7, 1.5, 2.1, px + pw / 2 - 1.25, topY + 0.75, pz);
        pushContact(1.7, 2.1, px + pw / 2 - 1.25, pz);
      }
      pushBox(pipeMatrices, Math.min(2.8, pw * 0.32), 0.11, 0.11, px, topY + 0.12, pz + pd / 2 - 0.55);
    }

    // Low glass-and-steel guard rails along the sides of larger roofs.
    if (pw > 3.5 && index % 2 === 0) {
      const railY = topY + 0.72;
      const railLength = pd * 0.76;
      for (const side of [-1, 1]) {
        pushBox(railBarMatrices, 0.07, 0.07, railLength, px + side * (pw / 2 - 0.16), railY, pz);
        for (let post = -2; post <= 2; post += 1) {
          pushBox(
            railPostMatrices,
            0.06,
            0.7,
            0.06,
            px + side * (pw / 2 - 0.16),
            topY + 0.36,
            pz + (post * railLength) / 5,
          );
        }
      }
    }

    // A couple of solar arrays break up the larger roof planes.
    if (pw > 4.8 && pd > 3.5 && index % 3 === 0) {
      for (let panel = 0; panel < 2; panel += 1) {
        solarMatrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(px - pw * 0.12 + panel * 1.15, topY + 0.2, pz + pd / 2 - 1.4),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.18),
            new THREE.Vector3(1.05, 0.06, 0.72),
          ),
        );
      }
    }

    // Access huts need a door, not just a textured box.
    if (index % 5 === 2 || index === 0) {
      doorMatrices.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(px + pw / 2 - 1.25, topY + 0.7, pz - 1.08),
          new THREE.Quaternion(),
          new THREE.Vector3(0.04, 1.05, 0.82),
        ),
      );
    }

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

  if (detailed) {
    const contact = buildContactShadows(THREE, contactDecals);
    if (contact) root.add(contact);
  }

  if (stripMatrices.length) {
    const strips = new THREE.InstancedMesh(stripGeometry, routeMat, stripMatrices.length);
    strips.name = 'route-strips';
    stripMatrices.forEach((matrix, index) => strips.setMatrixAt(index, matrix));
    strips.instanceMatrix.needsUpdate = true;
    strips.computeBoundingSphere();
    root.add(strips);
  }

  const addInstances = (name, geometry, material, matrices) => {
    if (!matrices.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  };
  addInstances(
    'platform-fascia',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.68, textures.metal()),
    fasciaMatrices,
  );
  addInstances(
    'platform-curbs',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xcfd6d2, 0.9, textures.concrete(0xcfd6d2)),
    curbMatrices,
  );
  addInstances(
    'platform-legs',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.75, textures.side()),
    columnMatrices,
  );
  addInstances(
    'platform-ac',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.72, textures.metal()),
    acMatrices,
  );
  addInstances(
    'platform-vents',
    new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    standard(0xffffff, 0.72, textures.metal()),
    ventMatrices,
  );
  addInstances(
    'platform-huts',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.88, textures.side(0x6a7a80)),
    hutMatrices,
  );
  addInstances(
    'platform-pipes',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.5, textures.metal()),
    pipeMatrices,
  );
  addInstances(
    'platform-rail-bars',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.55, textures.metal()),
    railBarMatrices,
  );
  addInstances(
    'platform-rail-posts',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0xffffff, 0.55, textures.metal()),
    railPostMatrices,
  );
  addInstances(
    'platform-solar',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0x18292f, 0.32, textures.metal()),
    solarMatrices,
  );
  addInstances(
    'platform-doors',
    new THREE.BoxGeometry(1, 1, 1),
    standard(0x2c3a3e, 0.65, textures.metal()),
    doorMatrices,
  );

  for (const obstacle of level.obstacles || []) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...obstacle.size),
      standard(
        obstacle.color || 0xffffff,
        0.84,
        obstacle.material === 'metal' ? textures.metal() : textures.concrete(obstacle.color || 0xe6e8e6),
      ),
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

  const propMetal = standard(0xffffff, 0.72, textures.metal());
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
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        standard(0xffffff, 0.92, textures.concrete(0x879398)),
      );
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
    emissive: 0x7a0e12,
    emissiveIntensity: 1.15,
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

  scene.fog = new THREE.FogExp2(0xe3f2f9, 0.0014);
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const lighting = createLighting(game);
  lighting.update({ x: level.spawn.x, y: level.spawn.y, z: level.spawn.z });
  const sky = game.render?.sky || game.scene?.getObjectByName?.('sky');
  if (sky) sky.visible = false;
  const highSky = createHighKeySky(game, sunDirection);
  root.add(highSky.mesh);

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
  const city = buildCity(game, level, createCityPlan(level), textures);
  root.add(city.root);
  if (game.render?.tune) {
    game.render.tune.bloom = 0.09;
    game.render.tune.bloomThreshold = 1.8;
    game.render.tune.streakThreshold = 1.15;
  }
  game.physics?.build?.();
  scene.add(root);
  return { root, checkpointMeshes, finishMesh, city: city.stats, sky: highSky.mesh, lighting };
}
