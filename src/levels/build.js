// @ts-check
// Build a playable level from tutorial data: meshes, AABB colliders, checkpoint
// rings and a finish gate. No game-specific imports.

import { validateLevel } from './validate.js';
import { buildCity, createCityPlan } from './city.js';
import { createTextureFactory } from './textures.js';
import { createHighKeySky } from './sky.js';
import { applyAtmosphere } from './atmosphere.js';
import { STRIPE, buildFloorStripes, edgeStripes } from './floor.js';
import { SIGN, drawSignPlate } from './signs.js';
import { createLighting } from './lighting.js';
import { SUN_DIRECTION } from './sun.js';
import { CONTACT, buildContactShadows, contactFootprint } from './contact.js';
import { createFinishGeometry, createRingGeometry } from './guides.js';
import { assignReflectionProbes, createReflectionProbes } from './reflections.js';

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

  // World-space UVs for a box: the platform tops used to be textured by cloning
  // a texture per roof and setting a repeat, which created 26 near-identical
  // materials with slightly different tiling. Scaling the UV attribute instead
  // means one 6 m tile density everywhere and shared materials. At that scale the
  // four cast panels per tile land at ~1.5 m, the slab pitch the reference roofs
  // actually have.
  const worldUv = (geometry, [w, h, d], tile = 6) => {
    const uv = geometry.attributes.uv;
    const faces = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    for (let face = 0; face < 6; face += 1) {
      const [uw, uh] = faces[face];
      for (let vertex = 0; vertex < 4; vertex += 1) {
        const index = face * 4 + vertex;
        uv.setXY(index, uv.getX(index) * (uw / tile), uv.getY(index) * (uh / tile));
      }
    }
    uv.needsUpdate = true;
  };

  // A stock BoxGeometry has six groups, so a platform mesh with a top material and
  // a side material costs six draw calls even though only two are distinct. Reorder
  // the index buffer (side faces first, top last) and regroup: two draw calls per
  // slab instead of six, no extra geometry and no visual change. The material array
  // keeps six entries so existing consumers that read `material[2]` (the top slot)
  // still find the roof material.
  const mergeBoxFaceGroups = (geometry, sideMaterial, topMaterial) => {
    const index = geometry.index;
    if (!index || index.count !== 36) return [sideMaterial, topMaterial];
    const faceOrder = [0, 1, 3, 4, 5, 2];
    const source = index.array;
    const reordered = new source.constructor(source.length);
    let cursor = 0;
    for (const face of faceOrder) {
      for (let slot = 0; slot < 6; slot += 1) reordered[cursor++] = source[face * 6 + slot];
    }
    geometry.setIndex(new THREE.BufferAttribute(reordered, 1));
    geometry.clearGroups();
    geometry.addGroup(0, 30, 0);
    geometry.addGroup(30, 6, 1);
    return [sideMaterial, topMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
  };

  // Material pools: most flat colours were created per object, which is how the
  // probe reached 155 materials. Sharing by (colour, roughness, maps) is free
  // quality and fewer state changes.
  const materialPool = new Map();
  const poolMaterial = (key, build) => {
    if (!materialPool.has(key)) materialPool.set(key, build());
    return materialPool.get(key);
  };
  const flatMaterial = (color, rough = 0.8) =>
    poolMaterial(
      `flat:${color}:${rough}`,
      () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.04 }),
    );
  // Pale cast concrete: the albedo carries the joints/stains, the relief normal
  // catches the sun at close range and the roughness map breaks the specular so
  // the slab reads as a rough poured surface instead of painted plastic.
  const concreteSurface = (key, maps) =>
    poolMaterial(key, () => {
      const material = new THREE.MeshStandardMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1, 1),
        roughnessMap: maps.roughnessMap,
        roughness: 1,
        metalness: 0.04,
      });
      return material;
    });
  const topMaterialFor = (color) => concreteSurface(`top:${color}`, textures.concreteMaps(color));

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
    drawSignPlate(context, canvas.width, canvas.height);
    context.fillStyle = SIGN.ink;
    context.font = '700 58px "IBM Plex Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
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
  const redMaps = textures.redMaps();
  const routeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: redMaps.map,
    normalMap: redMaps.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: redMaps.roughnessMap,
    emissive: 0x7a0e12,
    emissiveIntensity: 1.05,
    roughness: 1,
    metalness: 0.05,
  });
  const sideBundle = textures.sideMaps();
  const sideMat = poolMaterial('side', () => {
    const material = standard(0xffffff, 1, sideBundle.map);
    material.normalMap = sideBundle.normalMap;
    material.normalScale.set(1.1, 1.1);
    material.roughnessMap = sideBundle.roughnessMap;
    return material;
  });
  const metalBundle = textures.metalMaps();
  // Brushed metal: the roughness map carries the rolled-sheet streaks, so the
  // per-part `rough` argument scales gloss rather than flattening it.
  const metalStandard = (color, rough, metalness = 0.7) =>
    poolMaterial(`metal:${color}:${rough}:${metalness}`, () => {
      const material = new THREE.MeshStandardMaterial({
        color,
        map: metalBundle.map,
        normalMap: metalBundle.normalMap,
        normalScale: new THREE.Vector2(1, 1),
        roughnessMap: metalBundle.roughnessMap,
        roughness: Math.min(1, rough * 1.3),
        metalness,
      });
      material.userData.reflections = 'metal';
      return material;
    });
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
  const copingMatrices = [];
  const cableMatrices = [];
  const dishPoleMatrices = [];
  const dishPlateMatrices = [];
  const ductMatrices = [];
  const billboardFrameMatrices = [];
  const billboardPanelMatrices = [];
  const billboardPostMatrices = [];
  const billboardRuleMatrices = [];
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
  const edgeStripeMatrices = [];
  const detailed = game.quality?.name !== 'low';
  const floorDetail = game.quality?.name === 'high' || game.quality?.name === 'ultra';
  // One unit cube is shared by every instanced box in the level (route strips,
  // fascia, curbs, coping, roof kit): geometry memory and buffer uploads stay flat
  // no matter how much service kit the route gains.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const windowGeometry = new THREE.BoxGeometry(0.05, 0.75, 0.42);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8edf5,
    transparent: true,
    opacity: 0.78,
  });

  for (const [index, platform] of level.platforms.entries()) {
    const color = platform.color || palette[index % palette.length];
    const topMat = topMaterialFor(color);
    const platformGeometry = new THREE.BoxGeometry(...platform.size);
    worldUv(platformGeometry, platform.size);
    const mesh = new THREE.Mesh(platformGeometry, mergeBoxFaceGroups(platformGeometry, sideMat, topMat));
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
    // Continuous route paint: the strip spans the whole roof depth so the red
    // thread reads as a line instead of 26 dashes (the reference uses red as a
    // traversal language, and our route paint was only 19 % of the route length).
    stripMatrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(px, py + ph / 2 + 0.012, pz),
        new THREE.Quaternion(),
        new THREE.Vector3(0.26, 0.025, Math.max(0.8, pd - 0.24)),
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
    if (floorDetail) {
      for (const stripe of edgeStripes(slab)) {
        edgeStripeMatrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(stripe.x, topY + STRIPE.lift, stripe.z),
            new THREE.Quaternion(),
            new THREE.Vector3(stripe.w, STRIPE.thickness, stripe.d),
          ),
        );
      }
    }
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
    // A thinner coping cap overhanging the curb: a real roof edge profile instead
    // of a single flat band, and a clean highlight line at eye level. High/ultra
    // only: it is a silhouette detail, and low quality has a triangle budget.
    if (floorDetail) {
      const capY = topY + 0.115;
      pushBox(copingMatrices, pw - 0.02, 0.05, 0.22, px, capY, pz + pd / 2 - 0.08);
      pushBox(copingMatrices, pw - 0.02, 0.05, 0.22, px, capY, pz - pd / 2 + 0.08);
      pushBox(copingMatrices, 0.22, 0.05, pd - 0.02, px + pw / 2 - 0.08, capY, pz);
      pushBox(copingMatrices, 0.22, 0.05, pd - 0.02, px - pw / 2 + 0.08, capY, pz);
    }

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

    // Service kit v2: a second condenser bank, extra vent stack, dishes, duct
    // runs and billboards. The authored prop list is deliberately sparse (12
    // props / 203 m), so the generated kit carries the near-field density that
    // makes a roof read as working infrastructure.
    if (detailed && pw > 4.0 && pd > 3.0) {
      pushBox(acMatrices, 0.92, 0.6, 0.72, px + pw / 2 - 1.2, topY + 0.3, pz - pd / 2 + 1.6);
      pushContact(0.92, 0.72, px + pw / 2 - 1.2, pz - pd / 2 + 1.6);
      pushBox(ventMatrices, 0.26, 1.3, 0.26, px - pw / 2 + 1.55, topY + 0.65, pz + pd / 2 - 1.55);
    }
    if (detailed && pw > 5.2 && pd > 3.8 && index % 2 === 1) {
      const poleX = px - pw / 2 + 1.05;
      const poleZ = pz - pd / 2 + 1.25;
      pushBox(dishPoleMatrices, 0.09, 1.7, 0.09, poleX, topY + 0.85, poleZ);
      dishPlateMatrices.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(poleX, topY + 1.78, poleZ + 0.1),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.45),
          new THREE.Vector3(0.95, 0.06, 0.72),
        ),
      );
    }
    if (detailed && pw > 6 && pd > 4.2 && index % 3 === 1) {
      pushBox(ductMatrices, 2.6, 0.52, 0.56, px + pw / 2 - 2.2, topY + 0.3, pz - pd / 2 + 1.9);
      pushBox(ductMatrices, 0.56, 0.52, 1.15, px + pw / 2 - 0.9, topY + 0.3, pz - pd / 2 + 1.6);
    }
    if (detailed && pw > 4.6 && (index % 5 === 1 || index === 3)) {
      const side = index % 2 === 0 ? -1 : 1;
      const boardX = px + side * (pw / 2 - 0.45);
      const boardY = topY + 2.35;
      pushBox(billboardFrameMatrices, 0.12, 1.85, 3.3, boardX, boardY, pz);
      pushBox(billboardPanelMatrices, 0.06, 1.5, 2.95, boardX - side * 0.04, boardY, pz);
      pushBox(billboardRuleMatrices, 0.07, 0.22, 2.95, boardX - side * 0.05, boardY + 0.82, pz);
      for (const postSide of [-1, 1]) {
        pushBox(billboardPostMatrices, 0.12, 3.1, 0.12, boardX, topY + 1.55, pz + postSide * 1.25);
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

  // Catenary cables spanning the gaps: thin dark silhouettes against the sky that
  // connect the slabs into a circuit and give the low band of the frame detail.
  if (floorDetail) {
    const up = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const segmentQuaternion = new THREE.Quaternion();
    for (let i = 1; i < level.platforms.length; i += 1) {
      // Sparse on purpose: a cable on every gap reads as a web across the view.
      if (i % 2 === 0) continue;
      const from = level.platforms[i - 1];
      const to = level.platforms[i];
      const dz = to.pos[2] - from.pos[2];
      const directionSign = Math.sign(dz);
      const gap = Math.abs(dz) - (from.size[2] + to.size[2]) / 2;
      if (gap < 0.3 || gap > 12) continue;
      const fromTop = from.pos[1] + from.size[1] / 2;
      const toTop = to.pos[1] + to.size[1] / 2;
      // Only span gaps between roofs on roughly the same level; a cable strung
      // across a big height difference reads as a floating hook.
      if (Math.abs(fromTop - toTop) > 2.5) continue;
      const z0 = from.pos[2] + directionSign * (from.size[2] / 2 + 0.1);
      const z1 = to.pos[2] - directionSign * (to.size[2] / 2 + 0.1);
      const halfWidth = Math.min(from.size[0], to.size[0]) / 2 - 0.35;
      // One cable per gap, alternating sides, outside the route corridor and
      // above head height.
      {
        const side = i % 4 === 1 ? 1 : -1;
        const x = (from.pos[0] + to.pos[0]) / 2 + side * Math.max(0.9, halfWidth);
        const baseY = Math.max(fromTop, toTop) + (side > 0 ? 2.9 : 2.35);
        const steps = 10;
        for (let step = 0; step < steps; step += 1) {
          const t0 = step / steps;
          const t1 = (step + 1) / steps;
          const sag = (t) => Math.sin(Math.PI * t) * (0.14 + gap * 0.03);
          const a = new THREE.Vector3(x, baseY - sag(t0), z0 + (z1 - z0) * t0);
          const b = new THREE.Vector3(x, baseY - sag(t1), z0 + (z1 - z0) * t1);
          direction.copy(b).sub(a);
          const length = direction.length();
          midpoint.copy(a).addScaledVector(direction, 0.5);
          segmentQuaternion.setFromUnitVectors(up, direction.normalize());
          cableMatrices.push(
            new THREE.Matrix4().compose(
              midpoint.clone(),
              segmentQuaternion.clone(),
              new THREE.Vector3(0.024, length, 0.024),
            ),
          );
        }
      }
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

  if (floorDetail) {
    const stripes = buildFloorStripes(THREE, edgeStripeMatrices);
    if (stripes) root.add(stripes);
  }

  if (stripMatrices.length) {
    const strips = new THREE.InstancedMesh(unitBox, routeMat, stripMatrices.length);
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
  addInstances('platform-fascia', unitBox, metalStandard(0xb6c8d6, 0.6), fasciaMatrices);
  const curbMaps = textures.concreteMaps(0xcfd6d2);
  const curbMaterial = concreteSurface('curb', curbMaps);
  addInstances('platform-curbs', unitBox, curbMaterial, curbMatrices);
  const copingMaps = textures.concreteMaps(0xe4e7e2);
  const copingMaterial = concreteSurface('coping', copingMaps);
  addInstances('platform-coping', unitBox, copingMaterial, copingMatrices);
  const legMaps = textures.sideMaps();
  const legMaterial = poolMaterial('legs', () => {
    const material = standard(0xffffff, 1, legMaps.map);
    material.normalMap = legMaps.normalMap;
    material.normalScale.set(1.2, 1.2);
    material.roughnessMap = legMaps.roughnessMap;
    return material;
  });
  addInstances('platform-legs', unitBox, legMaterial, columnMatrices);
  addInstances('platform-ac', unitBox, metalStandard(0xffffff, 0.72), acMatrices);
  addInstances(
    'platform-vents',
    new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    metalStandard(0xffffff, 0.72),
    ventMatrices,
  );
  const hutMaps = textures.sideMaps(0x7a8c9c);
  const hutMaterial = poolMaterial('huts', () => {
    const material = standard(0xffffff, 1, hutMaps.map);
    material.normalMap = hutMaps.normalMap;
    material.normalScale.set(1.1, 1.1);
    material.roughnessMap = hutMaps.roughnessMap;
    return material;
  });
  addInstances('platform-huts', unitBox, hutMaterial, hutMatrices);
  addInstances('platform-pipes', unitBox, metalStandard(0xffffff, 0.5), pipeMatrices);
  addInstances('platform-rail-bars', unitBox, metalStandard(0xffffff, 0.55), railBarMatrices);
  addInstances('platform-rail-posts', unitBox, metalStandard(0xffffff, 0.55), railPostMatrices);
  addInstances('platform-solar', unitBox, metalStandard(0x21333f, 0.3, 0.35), solarMatrices);
  addInstances('platform-doors', unitBox, metalStandard(0x3d4e5a, 0.62, 0.5), doorMatrices);
  addInstances('route-cables', unitBox, metalStandard(0x3a4854, 0.42, 0.4), cableMatrices);
  addInstances('platform-dish-poles', unitBox, metalStandard(0x6b7c88, 0.55), dishPoleMatrices);
  addInstances('platform-dishes', unitBox, metalStandard(0xd8e4e8, 0.45, 0.45), dishPlateMatrices);
  addInstances('platform-ducts', unitBox, metalStandard(0xc2d0d6, 0.5), ductMatrices);
  addInstances('platform-billboard-frames', unitBox, metalStandard(0x3a4854, 0.55), billboardFrameMatrices);
  addInstances(
    'platform-billboard-panels',
    unitBox,
    metalStandard(0xe9e6dc, 0.72, 0.12),
    billboardPanelMatrices,
  );
  addInstances('platform-billboard-posts', unitBox, metalStandard(0x54646f, 0.6), billboardPostMatrices);
  if (billboardRuleMatrices.length) {
    const rules = new THREE.InstancedMesh(unitBox, routeMat, billboardRuleMatrices.length);
    rules.name = 'platform-billboard-rules';
    billboardRuleMatrices.forEach((matrix, index) => rules.setMatrixAt(index, matrix));
    rules.instanceMatrix.needsUpdate = true;
    rules.computeBoundingSphere();
    root.add(rules);
  }

  for (const obstacle of level.obstacles || []) {
    const surfaceMaterial = poolMaterial(
      `obstacle:${obstacle.material || 'concrete'}:${obstacle.color || 0xe6e8e6}`,
      () => {
        if (obstacle.material === 'metal') return metalStandard(obstacle.color || 0xffffff, 0.7);
        const maps = textures.concreteMaps(obstacle.color || 0xe6e8e6);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: maps.map,
          normalMap: maps.normalMap,
          normalScale: new THREE.Vector2(1, 1),
          roughnessMap: maps.roughnessMap,
          roughness: 1,
          metalness: 0.04,
        });
        return material;
      },
    );
    const mesh = new THREE.Mesh(unitBox, surfaceMaterial);
    mesh.name = `obstacle-${obstacle.id}`;
    mesh.position.fromArray(obstacle.pos);
    mesh.scale.fromArray(obstacle.size);
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
      flatMaterial(scenery.color || 0x7a858b, 0.95),
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

  // Props are pooled too: the roof kit used to mint a fresh material and a fresh
  // BufferGeometry per slat, cap, planter and tuft. Shared materials plus a unit
  // box/cylinder/cone/sphere scaled per instance keep both counts flat.
  const propMetal = metalStandard(0xffffff, 0.72);
  const propSlatMat = flatMaterial(0x2e3a40, 0.8);
  const propCapMat = flatMaterial(0x9aa4a8, 0.6);
  const propBeaconMat = poolMaterial('beacon', () => new THREE.MeshBasicMaterial({ color: 0xd23a39 }));
  const propPlanterMat = topMaterialFor(0x879398);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const unitCone = new THREE.ConeGeometry(1, 1, 7);
  const unitSphere = new THREE.SphereGeometry(1, 8, 6);
  for (const prop of level.props || []) {
    const group = new THREE.Group();
    group.name = `prop-${prop.id}`;
    group.position.fromArray(prop.pos);

    if (prop.type === 'ac') {
      const size = prop.size || [1.4, 1, 1.4];
      const body = new THREE.Mesh(unitBox, propMetal);
      body.scale.set(size[0], size[1], size[2]);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      for (let i = 0; i < 4; i += 1) {
        const slat = new THREE.Mesh(unitBox, propSlatMat);
        slat.scale.set(size[0] * 0.82, 0.035, 0.06);
        slat.position.set(0, 0.18 + i * 0.16, size[2] / 2 + 0.02);
        group.add(slat);
      }
    } else if (prop.type === 'vent') {
      const radius = prop.radius || 0.3;
      const height = prop.height || 1;
      const vent = new THREE.Mesh(unitCylinder, propMetal);
      vent.scale.set(radius, height, radius);
      vent.castShadow = true;
      group.add(vent);
      const cap = new THREE.Mesh(unitCylinder, propCapMat);
      cap.scale.set(radius * 1.3, 0.08, radius * 1.3);
      cap.position.y = height / 2;
      group.add(cap);
    } else if (prop.type === 'antenna') {
      const height = prop.height || 4;
      const mast = new THREE.Mesh(unitCylinder, propMetal);
      mast.scale.set(0.06, height, 0.06);
      mast.position.y = height / 2;
      mast.castShadow = true;
      group.add(mast);
      for (let i = 0; i < 3; i += 1) {
        const bar = new THREE.Mesh(unitBox, propMetal);
        bar.scale.set(1.5 - i * 0.3, 0.035, 0.035);
        bar.position.y = height * (0.55 + i * 0.12);
        group.add(bar);
      }
      const light = new THREE.Mesh(unitSphere, propBeaconMat);
      light.scale.setScalar(0.07);
      light.position.y = height;
      group.add(light);
    } else if (prop.type === 'rail') {
      const bar = new THREE.Mesh(unitBox, propMetal);
      bar.scale.set(prop.size[0], prop.size[1], prop.size[2]);
      group.add(bar);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(unitBox, propMetal);
        post.scale.set(0.07, 0.9, 0.07);
        post.position.set((prop.size[0] / 2) * side, -0.45, 0);
        group.add(post);
      }
    } else if (prop.type === 'planter') {
      const size = prop.size || [1.4, 0.6, 0.7];
      const base = new THREE.Mesh(unitBox, propPlanterMat);
      base.scale.set(size[0], size[1], size[2]);
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);
      const foliageMat = flatMaterial(prop.color || 0x78977d, 0.95);
      const leaves = new THREE.Mesh(unitBox, foliageMat);
      leaves.scale.set(size[0] * 0.84, 0.12, size[2] * 0.78);
      leaves.position.y = size[1] / 2 + 0.06;
      group.add(leaves);
      for (const side of [-1, 0, 1]) {
        const tuft = new THREE.Mesh(unitCone, foliageMat);
        tuft.scale.set(0.24, 0.6, 0.24);
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
  const ringGeometry = createRingGeometry(THREE, !detailed);
  for (const checkpoint of level.checkpoints) {
    const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xb51f2a }));
    mesh.name = `checkpoint-${checkpoint.id}`;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(checkpoint.pos[0], checkpoint.pos[1] + 0.08, checkpoint.pos[2]);
    root.add(mesh);
    checkpointMeshes.push(mesh);
  }

  const finishMesh = new THREE.Mesh(
    createFinishGeometry(THREE, !detailed),
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

  scene.fog = new THREE.FogExp2(0xcfe3ef, 0.0014);
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const lighting = createLighting(game);
  lighting.update({ x: level.spawn.x, y: level.spawn.y, z: level.spawn.z });
  const sky = game.render?.sky || game.scene?.getObjectByName?.('sky');
  if (sky) sky.visible = false;
  const highSky = createHighKeySky(game, sunDirection);
  root.add(highSky.mesh);

  // The sun is drawn by the sky dome (disc + aureole) at the true sun direction;
  // the old 110 m additive billboard sat up to 80 deg away from it and veiled a
  // tenth of the frame, so it is gone.

  const city = buildCity(game, level, createCityPlan(level), textures);
  root.add(city.root);
  applyAtmosphere(game);
  game.physics?.build?.();
  scene.add(root);
  // Real reflections for the curtain walls: capture the finished district from a
  // couple of route-height probes, PMREM the cubes and hand them to the glass and
  // metal materials (one-shot build cost, no per-frame work, high+ quality only).
  const previousProbes = game.reflectionProbes;
  const probes = createReflectionProbes(game, level);
  const reflectedMaterials = probes ? assignReflectionProbes(root, probes) : 0;
  if (probes) {
    // Editor rebuilds call buildLevel again; release the previous probe cubes
    // instead of leaking one set of cube targets per rebuild.
    if (previousProbes?.dispose) {
      try {
        previousProbes.dispose();
      } catch {
        /* probe already released */
      }
    }
    game.reflectionProbes = probes;
  }
  return {
    root,
    checkpointMeshes,
    finishMesh,
    city: city.stats,
    sky: highSky.mesh,
    lighting,
    reflections: probes ? { probes, materials: reflectedMaterials } : null,
  };
}
