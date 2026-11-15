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
  const doorMatrices = [];
  // Reference prop vocabulary (P1/P2): every piece below is authored in the
  // level data and batched by material here, so a solar array, a fan grille or
  // the covered courtyard interior costs one draw call per material family
  // instead of one per part.
  const solarPanelMatrices = [];
  const solarFlatMatrices = [];
  const paleKitMatrices = [];
  const fanRingMatrices = [];
  const fanBladeMatrices = [];
  const skylightGlassMatrices = [];
  const fenceMatrices = [];
  const redMatrices = [];
  const whiteMatrices = [];
  const darkTrimMatrices = [];
  const acUnits = [];
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
  // Prop-vocabulary instancing: one unit box per material family, with the
  // position/rotation/scale baked into each instance matrix.
  const pushKit = (list, x, y, z, sx, sy, sz, quaternion = null) => {
    list.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        quaternion || new THREE.Quaternion(),
        new THREE.Vector3(sx, sy, sz),
      ),
    );
  };
  const yawQuaternion = (yaw) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  // HVAC condensers are collected for a second pass: their bodies stay in the
  // instanced box kit, the fan grilles are added once every unit is known.
  const pushAircon = (w, h, d, x, y, z, facing) => {
    acUnits.push({ x, y, z, w, h, d, facing });
    pushKit(acMatrices, x, y, z, w, h, d);
  };

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
    // Authored showcases opt out of the generated roof services, so the prop
    // layout on that deck stays exactly as authored.
    const serviceKit = platform.serviceKit !== false;
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
    if (serviceKit && pw > 4.4 && pd > 2.6) {
      pushAircon(1.05, 0.75, 0.8, px - pw / 2 + 1.1, topY + 0.4, pz - pd / 2 + 1.05, 'x+');
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

    // P2.2: `fence: true` on a platform adds an orange safety run along both
    // route-facing side edges. Visual guard only: no collider, the drop stays
    // lethal and the middle of the deck stays walkable.
    if (detailed && platform.fence) {
      const fenceHeight = 1.05;
      const runLength = Math.max(1.2, pd - 1.2);
      const modules = Math.max(1, Math.round(runLength / 2));
      for (const side of [-1, 1]) {
        const fenceX = px + side * (pw / 2 - 0.12);
        for (let module = 0; module <= modules; module += 1) {
          pushBox(
            fenceMatrices,
            0.07,
            fenceHeight,
            0.07,
            fenceX,
            topY + fenceHeight / 2,
            pz - runLength / 2 + (module / modules) * runLength,
          );
        }
        pushBox(fenceMatrices, 0.04, 0.05, runLength, fenceX, topY + fenceHeight - 0.05, pz);
        pushBox(fenceMatrices, 0.035, 0.04, runLength, fenceX, topY + fenceHeight * 0.56, pz);
      }
    }

    // Photovoltaic arrays are authored explicitly in the level data so they
    // face the sun and the route instead of landing on every third roof.

    // Service kit v2: a second condenser bank, extra vent stack, dishes, duct
    // runs and billboards. The authored prop list is deliberately sparse (12
    // props / 203 m), so the generated kit carries the near-field density that
    // makes a roof read as working infrastructure.
    if (serviceKit && detailed && pw > 4.0 && pd > 3.0) {
      pushAircon(0.92, 0.6, 0.72, px + pw / 2 - 1.2, topY + 0.3, pz - pd / 2 + 1.6, 'x-');
      pushContact(0.92, 0.72, px + pw / 2 - 1.2, pz - pd / 2 + 1.6);
      pushBox(ventMatrices, 0.26, 1.3, 0.26, px - pw / 2 + 1.55, topY + 0.65, pz + pd / 2 - 1.55);
    }
    if (serviceKit && detailed && pw > 5.2 && pd > 3.8 && index % 2 === 1) {
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
    if (serviceKit && detailed && pw > 6 && pd > 4.2 && index % 3 === 1) {
      pushBox(ductMatrices, 2.6, 0.52, 0.56, px + pw / 2 - 2.2, topY + 0.3, pz - pd / 2 + 1.9);
      pushBox(ductMatrices, 0.56, 0.52, 1.15, px + pw / 2 - 0.9, topY + 0.3, pz - pd / 2 + 1.6);
    }
    if (serviceKit && detailed && pw > 4.6 && (index % 5 === 1 || index === 3)) {
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
    if (serviceKit && (index % 5 === 2 || index === 0)) {
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

  const addInstances = (name, geometry, material, matrices, shadows = false) => {
    if (!matrices.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (shadows) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
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
  // Reference-vocabulary families (P1/P2). Four new materials total: the PV
  // glass, the skylight glass, red painted steel and safety orange. The pale
  // frames reuse the dish steel, the fan shrouds reuse the cable steel and the
  // white volumes reuse the palest cast-concrete platform material.
  // Painted steel reads brighter as a mostly-dielectric surface: a metallic
  // tint turns the red and the safety orange almost black in shade.
  const paintedSteel = (color, rough) =>
    poolMaterial(
      `paint:${color}:${rough}`,
      () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.18 }),
    );
  const redSteel = paintedSteel(0xc0242e, 0.45);
  const fenceOrange = paintedSteel(0xdf7a26, 0.5);
  const fanSteel = metalStandard(0x3a4854, 0.42, 0.4);
  const paleSteel = metalStandard(0xd8e4e8, 0.45, 0.45);
  const whiteCast = topMaterialFor(0xf2eee3);
  // Blue-black photovoltaic plate with a procedural cell grid. The grid is
  // what makes the array read as PV at gameplay distance instead of as a pale
  // reflective slab; no external image is involved.
  const solarPanelMat = detailed
    ? poolMaterial('solar-panel', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = '#101d2b';
        context.fillRect(0, 0, 128, 128);
        const cols = 4;
        const rows = 6;
        const cw = canvas.width / cols;
        const ch = canvas.height / rows;
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const lift = ((row * cols + col) % 5) * 6;
            context.fillStyle = `rgb(${22 + lift}, ${44 + lift}, ${68 + lift})`;
            context.fillRect(col * cw + 1.5, row * ch + 1.5, cw - 3, ch - 3);
          }
        }
        context.strokeStyle = 'rgba(154, 182, 200, 0.5)';
        context.lineWidth = 1.6;
        for (let col = 0; col <= cols; col += 1) {
          context.beginPath();
          context.moveTo(col * cw, 0);
          context.lineTo(col * cw, canvas.height);
          context.stroke();
        }
        for (let row = 0; row <= rows; row += 1) {
          context.beginPath();
          context.moveTo(0, row * ch);
          context.lineTo(canvas.width, row * ch);
          context.stroke();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.52, metalness: 0.04 });
      })
    : null;
  const skylightGlassMat = poolMaterial('skylight-glass', () => {
    const material = new THREE.MeshStandardMaterial({
      color: 0x9dc3d6,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    material.userData.reflections = 'glass';
    return material;
  });
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const unitCone = new THREE.ConeGeometry(1, 1, 7);
  const unitSphere = new THREE.SphereGeometry(1, 8, 6);
  const propQuaternion = (yaw, tiltX = 0) => {
    const quaternion = yawQuaternion(yaw || 0);
    if (tiltX) {
      quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tiltX));
    }
    return quaternion;
  };
  // Rotate a local XZ offset by a yaw around Y (local +Z is the prop's front).
  const localOffset = (yaw, lx, lz) => [
    lx * Math.cos(yaw || 0) + lz * Math.sin(yaw || 0),
    -lx * Math.sin(yaw || 0) + lz * Math.cos(yaw || 0),
  ];
  // Footprint of a yawed box in world axes (for prop colliders).
  const footprint = (w, d, yaw) => {
    const c = Math.abs(Math.cos(yaw || 0));
    const s = Math.abs(Math.sin(yaw || 0));
    return [w * c + d * s, w * s + d * c];
  };
  const addPropCollider = (x, y, z, w, h, d, surface = 'concrete') => {
    if (!game.physics) return;
    game.physics.addBox([x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2], {
      surface,
      tag: '',
    });
  };
  // P1.1 photovoltaic array: a tilted panel grid on a pale frame. High detail
  // only; low quality keeps the old two-slab silhouette so the roof still reads
  // as a working solar deck without the triangles.
  const pushSolarArray = (prop) => {
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const [w, d] = prop.size || [3.4, 2.2];
    if (!detailed) {
      for (let panel = 0; panel < 2; panel += 1) {
        const [ox, oz] = localOffset(yaw, (panel - 0.5) * (w * 0.3), 0);
        pushKit(
          solarFlatMatrices,
          x + ox,
          y + 0.16,
          z + oz,
          w * 0.32,
          0.06,
          d * 0.62,
          propQuaternion(yaw, -0.18),
        );
      }
      return;
    }
    const cols = Math.max(1, Math.round(prop.panels?.[0] ?? 3));
    const rows = Math.max(1, Math.round(prop.panels?.[1] ?? 2));
    const cellW = w / cols;
    const cellD = d / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const [ox, oz] = localOffset(yaw, -w / 2 + (col + 0.5) * cellW, -d / 2 + (row + 0.5) * cellD);
        // Tilted toward the route side (+Z): every capture looks at the deck
        // from +Z, so the blue-black faces read instead of edge-on slivers.
        pushKit(
          solarPanelMatrices,
          x + ox,
          y + 0.46,
          z + oz,
          cellW - 0.12,
          0.045,
          cellD - 0.14,
          propQuaternion(yaw, 0.34),
        );
      }
    }
    const railY = y + 0.24;
    for (const side of [-1, 1]) {
      const [ex, ez] = localOffset(yaw, 0, side * (d / 2 - 0.09));
      pushKit(paleKitMatrices, x + ex, railY, z + ez, w, 0.07, 0.08, propQuaternion(yaw));
      const [sx, sz] = localOffset(yaw, side * (w / 2 - 0.09), 0);
      pushKit(paleKitMatrices, x + sx, railY + 0.03, z + sz, 0.08, 0.07, d, propQuaternion(yaw));
      for (const depthSide of [-1, 1]) {
        const [lx, lz] = localOffset(yaw, side * (w / 2 - 0.18), depthSide * (d / 2 - 0.2));
        pushKit(paleKitMatrices, x + lx, y + 0.13, z + lz, 0.07, 0.26, 0.07, propQuaternion(yaw));
      }
    }
  };
  // P1.3 roof light: a shallow glass plate in a pale kerb. The glass material is
  // tagged for the scene reflection probe, so it mirrors the district at the
  // grazing angles the route sees it from.
  const pushSkylight = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const [w, d] = prop.size || [1.8, 1.8];
    // A raised light (`raise`) turns the kerb into a roof lantern. The courtyard
    // ceiling uses this so the skylights break the deck line and read from the
    // rim, not only from inside the room.
    const raise = Math.max(0, prop.raise || 0);
    const kerb = 0.1;
    const wallHeight = 0.15 + raise;
    const quaternion = propQuaternion(yaw);
    pushKit(skylightGlassMatrices, x, y + 0.08 + raise, z, w, 0.06, d, quaternion);
    for (const side of [-1, 1]) {
      const [ex, ez] = localOffset(yaw, 0, side * (d / 2 + kerb / 2));
      pushKit(
        paleKitMatrices,
        x + ex,
        y + wallHeight / 2,
        z + ez,
        w + kerb * 2,
        wallHeight,
        kerb,
        quaternion,
      );
      const [sx, sz] = localOffset(yaw, side * (w / 2 + kerb / 2), 0);
      pushKit(paleKitMatrices, x + sx, y + wallHeight / 2, z + sz, kerb, wallHeight, d, quaternion);
    }
    if (prop.collider) {
      const [fw, fd] = footprint(w + 0.2, d + 0.2, yaw);
      addPropCollider(x, y + (wallHeight + 0.06) / 2, z, fw, wallHeight + 0.06, fd, 'metal');
    }
  };
  // P1.4 red ladder leaning against a wall / parapet.
  const pushRedLadder = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const height = prop.height || 2.8;
    const width = prop.width || 0.55;
    const lean = 0.2;
    const quaternion = propQuaternion(yaw, -lean);
    const railLength = height / Math.cos(lean);
    const topOffset = -Math.sin(lean) * height;
    for (const side of [-1, 1]) {
      const [ox, oz] = localOffset(yaw, side * (width / 2 - 0.04), topOffset * 0.5);
      pushKit(redMatrices, x + ox, y + height / 2, z + oz, 0.06, railLength, 0.06, quaternion);
    }
    for (let rung = 1; rung <= 9; rung += 1) {
      const t = rung / 10;
      const [ox, oz] = localOffset(yaw, 0, topOffset * t);
      const rungY = y + Math.cos(lean) * t * height;
      pushKit(redMatrices, x + ox, rungY, z + oz, width, 0.05, 0.05, quaternion);
    }
  };
  // P1.4 red conduit run with collar brackets.
  const pushRedPipe = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const length = prop.length || 4;
    const radius = prop.radius || 0.065;
    const quaternion = yawQuaternion(yaw);
    pushKit(redMatrices, x, y, z, length, radius * 2, radius * 2, quaternion);
    const brackets = Math.max(2, Math.round(length / 1.7));
    for (let i = 0; i < brackets; i += 1) {
      const [ox, oz] = localOffset(yaw, -length / 2 + (i + 0.5) * (length / brackets), 0);
      pushKit(redMatrices, x + ox, y, z + oz, 0.1, radius * 2 + 0.12, radius * 2 + 0.12, quaternion);
    }
  };
  // P2.2 safety fence: 2 m posts-and-rails modules, no collider (fail
  // boundaries stay lethal, the fence is a visual guard only).
  const pushFence = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const length = prop.length || 4;
    const height = prop.height || 1.05;
    const quaternion = yawQuaternion(yaw);
    const modules = Math.max(1, Math.round(length / 2));
    for (let i = 0; i <= modules; i += 1) {
      const [ox, oz] = localOffset(yaw, -length / 2 + (i / modules) * length, 0);
      pushKit(fenceMatrices, x + ox, y + height / 2, z + oz, 0.07, height, 0.07, quaternion);
    }
    pushKit(fenceMatrices, x, y + height - 0.05, z, length, 0.05, 0.04, quaternion);
    pushKit(fenceMatrices, x, y + height * 0.56, z, length, 0.04, 0.035, quaternion);
  };
  // P2.3 white plant room: cast volume, recessed door, vent slats, pipe stub.
  const pushPlantRoom = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const [w, h, d] = prop.size || [2.4, 1.6, 2.0];
    const quaternion = yawQuaternion(yaw);
    pushKit(whiteMatrices, x, y + h / 2, z, w, h, d, quaternion);
    const door = localOffset(yaw, 0, d / 2 - 0.02);
    pushKit(darkTrimMatrices, x + door[0], y + h * 0.42, z + door[1], 0.74, h * 0.7, 0.06, quaternion);
    const threshold = localOffset(yaw, 0, d / 2 + 0.03);
    pushKit(darkTrimMatrices, x + threshold[0], y + 0.05, z + threshold[1], w + 0.08, 0.1, 0.08, quaternion);
    for (let i = 0; i < 3; i += 1) {
      const vent = localOffset(yaw, -w * 0.26, d / 2 + 0.01);
      pushKit(
        darkTrimMatrices,
        x + vent[0],
        y + h * (0.78 + i * 0.06),
        z + vent[1],
        0.52,
        0.05,
        0.03,
        quaternion,
      );
    }
    const stub = localOffset(yaw, w / 2 + 0.07, 0);
    pushKit(paleKitMatrices, x + stub[0], y + h * 0.48, z + stub[1], 0.1, h * 0.86, 0.1, quaternion);
    const [fw, fd] = footprint(w, d, yaw);
    addPropCollider(x, y + h / 2, z, fw, h, fd, 'concrete');
  };
  // P2.1 white ceiling / roof deck slab (top surface at pos[1]).
  const pushCeiling = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const [w, t, d] = prop.size || [4, 0.5, 2];
    pushKit(whiteMatrices, x, y - t / 2, z, w, t, d, yawQuaternion(yaw));
    if (prop.collider === false) return;
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    addPropCollider(x, y - t / 2, z, swap ? d : w, t, swap ? w : d, 'concrete');
  };
  // P2.1 locker row: pale steel bodies with a dark vent line each.
  const pushLockerRow = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const length = prop.length || 3.4;
    const count = Math.max(1, Math.round(prop.count || length / 0.68));
    const pitch = length / count;
    const height = prop.height || 1.85;
    const depth = prop.depth || 0.42;
    const quaternion = yawQuaternion(yaw);
    for (let i = 0; i < count; i += 1) {
      const centre = localOffset(yaw, -length / 2 + (i + 0.5) * pitch, 0);
      pushKit(
        paleKitMatrices,
        x + centre[0],
        y + height / 2,
        z + centre[1],
        pitch - 0.03,
        height,
        depth,
        quaternion,
      );
      const vent = localOffset(yaw, -length / 2 + (i + 0.5) * pitch, depth / 2 + 0.01);
      pushKit(
        darkTrimMatrices,
        x + vent[0],
        y + height * 0.84,
        z + vent[1],
        pitch * 0.52,
        0.035,
        0.03,
        quaternion,
      );
    }
    for (let i = 1; i < count; i += 1) {
      const seam = localOffset(yaw, -length / 2 + i * pitch, depth / 2 + 0.012);
      pushKit(
        darkTrimMatrices,
        x + seam[0],
        y + height / 2,
        z + seam[1],
        0.02,
        height * 0.94,
        0.02,
        quaternion,
      );
    }
    const band = localOffset(yaw, 0, depth / 2 + 0.012);
    pushKit(darkTrimMatrices, x + band[0], y + height - 0.08, z + band[1], length, 0.035, 0.025, quaternion);
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    addPropCollider(x, y + height / 2, z, swap ? depth : length, height, swap ? length : depth, 'metal');
  };
  // P2.1 white wall panel with a recessed service door.
  const pushPanel = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const [w, h, t] = prop.size || [2.0, 2.6, 0.12];
    const quaternion = yawQuaternion(yaw);
    pushKit(whiteMatrices, x, y + h / 2, z, w, h, t, quaternion);
    if (prop.door === false) return;
    const door = localOffset(yaw, 0, t / 2 + 0.005);
    pushKit(darkTrimMatrices, x + door[0], y + h * 0.44, z + door[1], w * 0.44, h * 0.64, 0.04, quaternion);
  };
  // P2.1 red steel service stair: solid treads on red stringers.
  const pushStair = (prop) => {
    if (!detailed) return;
    const [x, y, z] = prop.pos;
    const yaw = prop.yaw || 0;
    const rise = prop.rise || 3;
    const run = prop.run || 2.9;
    const width = prop.width || 1.2;
    const steps = Math.max(2, Math.round(prop.steps || 10));
    const quaternion = yawQuaternion(yaw);
    const stepRise = rise / steps;
    const stepRun = run / steps;
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    for (let i = 0; i < steps; i += 1) {
      const centre = localOffset(yaw, 0, (i + 0.5) * stepRun);
      const height = (i + 1) * stepRise;
      pushKit(
        paleKitMatrices,
        x + centre[0],
        y + height / 2,
        z + centre[1],
        width,
        height,
        stepRun,
        quaternion,
      );
      addPropCollider(
        x + centre[0],
        y + height / 2,
        z + centre[1],
        swap ? stepRun : width,
        height,
        swap ? width : stepRun,
        'metal',
      );
    }
    const slope = Math.atan2(rise, run);
    const slopeLength = Math.hypot(rise, run);
    const stringerQuaternion = propQuaternion(yaw, -slope);
    for (const side of [-1, 1]) {
      const edge = localOffset(yaw, side * (width / 2 + 0.02), run / 2);
      pushKit(
        redMatrices,
        x + edge[0],
        y + rise / 2,
        z + edge[1],
        0.07,
        0.2,
        slopeLength,
        stringerQuaternion,
      );
    }
    const handrail = localOffset(yaw, width / 2 + 0.04, run / 2);
    pushKit(
      redMatrices,
      x + handrail[0],
      y + rise / 2 + 0.95,
      z + handrail[1],
      0.06,
      0.06,
      slopeLength,
      stringerQuaternion,
    );
  };
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
      // Grilles are added in the batched pass below, once every unit is known.
      acUnits.push({
        x: prop.pos[0],
        y: prop.pos[1],
        z: prop.pos[2],
        w: size[0],
        h: size[1],
        d: size[2],
        facing: prop.facing || 'z+',
      });
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
      const yaw = prop.yaw || 0;
      const size = prop.size || [3, 0.1, 0.1];
      if (prop.material === 'red') {
        // Red functional rails route through the batched red-steel kit.
        if (!detailed) {
          root.add(group);
          continue;
        }
        const [x, y, z] = prop.pos;
        const quaternion = yawQuaternion(yaw);
        pushKit(redMatrices, x, y, z, size[0], size[1], size[2], quaternion);
        for (const side of [-1, 1]) {
          const [ox, oz] = localOffset(yaw, side * (size[0] / 2) * 0.94, 0);
          pushKit(redMatrices, x + ox, y - 0.45, z + oz, 0.07, 0.9, 0.07, quaternion);
        }
      } else {
        const bar = new THREE.Mesh(unitBox, propMetal);
        bar.scale.set(size[0], size[1], size[2]);
        bar.rotation.y = yaw;
        group.add(bar);
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(unitBox, propMetal);
          post.scale.set(0.07, 0.9, 0.07);
          post.position.set((size[0] / 2) * side, -0.45, 0);
          post.rotation.y = yaw;
          group.add(post);
        }
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
    } else if (prop.type === 'solar') {
      pushSolarArray(prop);
    } else if (prop.type === 'skylight') {
      pushSkylight(prop);
    } else if (prop.type === 'redLadder') {
      pushRedLadder(prop);
    } else if (prop.type === 'redPipe') {
      pushRedPipe(prop);
    } else if (prop.type === 'fence') {
      pushFence(prop);
    } else if (prop.type === 'plantRoom') {
      pushPlantRoom(prop);
    } else if (prop.type === 'ceiling') {
      pushCeiling(prop);
    } else if (prop.type === 'lockerRow') {
      pushLockerRow(prop);
    } else if (prop.type === 'panel') {
      pushPanel(prop);
    } else if (prop.type === 'stair') {
      pushStair(prop);
    }
    root.add(group);
  }

  // P1.2: circular fan grilles on the route-facing face of every condenser.
  // A ring, a dark shroud plate, three radial blades and a hub are batched into
  // two instanced draws (ring geometry + unit box) for the whole level.
  if (detailed) {
    const facingYaw = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI };
    const unitZ = new THREE.Vector3(0, 0, 1);
    for (const unit of acUnits) {
      const yaw = facingYaw[unit.facing] ?? 0;
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const widthAxis = unit.facing[0] === 'x' ? unit.d : unit.w;
      const depthAxis = unit.facing[0] === 'x' ? unit.w : unit.d;
      const faceX = unit.x + nx * (depthAxis / 2 + 0.012);
      const faceY = unit.y + unit.h * 0.06;
      const faceZ = unit.z + nz * (depthAxis / 2 + 0.012);
      const count = widthAxis >= 1.3 ? 2 : 1;
      const radius = Math.min(widthAxis / (count * 2.3), unit.h * 0.42);
      const spacing = widthAxis * 0.26;
      for (let fan = 0; fan < count; fan += 1) {
        const offset = count === 1 ? 0 : fan === 0 ? -spacing : spacing;
        const gx = faceX + rx * offset;
        const gz = faceZ + rz * offset;
        pushKit(fanRingMatrices, gx, faceY, gz, radius * 2, radius * 2, 0.05, yawQuaternion(yaw));
        // Shroud plate: a flat dark quad behind the blades, so the grille reads
        // as a recessed opening instead of blades floating on a pale body.
        pushKit(
          fanBladeMatrices,
          gx + nx * 0.006,
          faceY,
          gz + nz * 0.006,
          radius * 1.62,
          radius * 1.62,
          1,
          yawQuaternion(yaw),
        );
        for (let blade = 0; blade < 3; blade += 1) {
          const angle = (blade / 3) * Math.PI * 2 + 0.4;
          const bx = gx + rx * Math.cos(angle) * radius * 0.46 + nx * 0.022;
          const by = faceY + Math.sin(angle) * radius * 0.46;
          const bz = gz + rz * Math.cos(angle) * radius * 0.46 + nz * 0.022;
          const bladeQuaternion = yawQuaternion(yaw).multiply(
            new THREE.Quaternion().setFromAxisAngle(unitZ, angle),
          );
          pushKit(fanBladeMatrices, bx, by, bz, radius * 0.98, 0.07, 1, bladeQuaternion);
        }
      }
    }
  }

  const fanRingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
  fanRingGeometry.rotateX(Math.PI / 2);
  // Grilles are flat on the condenser body: no shadow pass so the level's
  // triangle budget stays on the architecture.
  addInstances('prop-fan-rings', fanRingGeometry, fanSteel, fanRingMatrices);
  addInstances('prop-fan-grilles', new THREE.PlaneGeometry(1, 1), fanSteel, fanBladeMatrices);
  addInstances('prop-solar-panels', unitBox, solarPanelMat, solarPanelMatrices, true);
  addInstances('prop-pale-steel', unitBox, paleSteel, paleKitMatrices);
  addInstances('prop-skylight-glass', unitBox, skylightGlassMat, skylightGlassMatrices);
  addInstances('prop-fences', unitBox, fenceOrange, fenceMatrices);
  addInstances('prop-red-steel', unitBox, redSteel, redMatrices);
  addInstances('prop-white-volumes', unitBox, whiteCast, whiteMatrices, true);
  addInstances('prop-dark-trim', unitBox, propSlatMat, darkTrimMatrices);
  if (solarFlatMatrices.length) {
    addInstances('platform-solar', unitBox, metalStandard(0x21333f, 0.3, 0.35), solarFlatMatrices);
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

  // P2.1 interior fill: the covered service block is lit only by its skylights,
  // so a warm point light stands in for the sky bounce. It is local to the
  // courtyard (distance 24) and only exists on the detailed tiers.
  if (detailed) {
    const interiorFill = new THREE.PointLight(0xfff1dc, 30, 26, 2);
    interiorFill.name = 'court-interior-fill';
    interiorFill.position.set(0.4, -0.4, -107.6);
    root.add(interiorFill);
  }

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
