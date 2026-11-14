// @ts-check
// Deterministic procedural city district around the hand-authored route.
// The city is decorative: route collisions remain the authored level boxes.

const BODY_COLORS = [0xe8e4d8, 0xd7e5e8, 0xc9dde3, 0xf0ece2, 0xbdd6dd];
const ROOF_COLORS = [0xf5f1e7, 0xdce9eb, 0xe7e3d8, 0x78977d];

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * @param {any} level
 * @returns {{seed: number, streetY: number, buildings: any[], bridges: any[], landmarks: any[], lights: any[], distant: any[]}}
 */
export function createCityPlan(level) {
  const config = level.city || {};
  const seed = Number(config.seed) || 731;
  const streetY = Number(config.streetY) || -18;
  const corridor = Number(config.corridor) || 15;
  const rng = makeRng(seed);
  const buildings = [];

  for (let z = 22; z >= -224; z -= 18) {
    for (let x = -88; x <= 88; x += 16) {
      if (Math.abs(x) < corridor + 4) continue;
      if (rng() < 0.13) continue;
      const jitterX = (rng() - 0.5) * 5;
      const jitterZ = (rng() - 0.5) * 5;
      const width = 7 + rng() * 6;
      const depth = 7 + rng() * 6;
      const bx = x + jitterX;
      const bz = z + jitterZ;
      if (Math.abs(bx) - width / 2 < corridor) continue;
      const inner = Math.abs(bx) < 44;
      const height = (inner ? 8 : 20) + rng() * (inner ? 18 : 48);
      const top = streetY + height;
      buildings.push({
        x: bx,
        z: bz,
        w: width,
        d: depth,
        h: height,
        top,
        color: Math.floor(rng() * BODY_COLORS.length),
        roofColor: inner && rng() < 0.3 ? 3 : Math.floor(rng() * (ROOF_COLORS.length - 1)),
        keep: rng(),
        floors: Math.max(2, Math.floor((height - 4) / 5)),
        windows: rng() > 0.18,
        roofUnit: rng() > 0.48,
        landmark: false,
      });
    }
  }

  const landmarks = [
    { x: -34, z: -38, w: 14, d: 14, h: 58, color: 4, roofColor: 1 },
    { x: 35, z: -108, w: 12, d: 12, h: 74, color: 1, roofColor: 0 },
    { x: -36, z: -182, w: 15, d: 15, h: 64, color: 3, roofColor: 2 },
  ].map((landmark) => ({
    ...landmark,
    streetY,
    top: streetY + landmark.h,
    keep: 0,
    floors: Math.max(4, Math.floor((landmark.h - 4) / 5)),
    windows: true,
    roofUnit: false,
    landmark: true,
  }));

  const bridges = [
    { x: -18, z: -44, w: 64, y: 16, d: 1.4, color: 0xb9cdd2 },
    { x: 20, z: -112, w: 72, y: 23, d: 1.8, color: 0xd7e5e8 },
    { x: -22, z: -166, w: 58, y: 19, d: 1.4, color: 0xb9cdd2 },
    { x: 28, z: -198, w: 52, y: 13, d: 1.2, color: 0xd7e5e8 },
  ];

  const lights = [];
  for (let z = 20; z >= -224; z -= 12) {
    for (const side of [-1, 1]) {
      lights.push({
        x: side * (corridor + 1.8),
        z,
        y: streetY + 2.2,
      });
    }
  }

  const transit = [
    { x: -118, z: 18, y: 24 },
    { x: -68, z: -28, y: 24 },
    { x: -18, z: -74, y: 25 },
    { x: 34, z: -120, y: 26 },
    { x: 82, z: -166, y: 27 },
    { x: 128, z: -214, y: 29 },
  ];

  const signs = [
    { x: -27, y: 9, z: -29, w: 11, h: 3.2, text: 'CITY OF LIGHT' },
    { x: 28, y: 13, z: -105, w: 11, h: 3.2, text: 'GLASSLINE / 04' },
  ];

  const distant = [];
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    distant.push({
      x: side * (100 + rng() * 52),
      z: 30 - rng() * 280,
      w: 8 + rng() * 12,
      d: 8 + rng() * 14,
      h: 22 + rng() * 60,
      color: 0x8fa9b2,
    });
  }

  return {
    seed,
    streetY,
    corridor,
    buildings,
    landmarks,
    bridges,
    lights,
    transit,
    signs,
    distant,
  };
}

function makeStreetTexture(game) {
  const { THREE } = game;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#243237';
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = 'rgba(185, 205, 210, .22)';
  context.lineWidth = 2;
  for (let i = 0; i < 256; i += 48) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 256);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(256, i);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * @param {any} game
 * @param {any} level
 * @param {ReturnType<typeof createCityPlan>} plan
 */
export function buildCity(game, level, plan) {
  const { THREE } = game;
  const root = new THREE.Group();
  root.name = 'glassline-city';
  const quality = game.quality?.name || 'high';
  const density = quality === 'low' ? 0.55 : quality === 'medium' ? 0.78 : 1;

  const buildings = plan.buildings.filter((building) => building.keep <= density);
  const allBuildings = [...buildings, ...plan.landmarks];

  // Street plate.
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 360),
    new THREE.MeshBasicMaterial({ map: makeStreetTexture(game), fog: true }),
  );
  street.name = 'city-street';
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, plan.streetY - 0.35, -96);
  root.add(street);

  // One instanced body mesh for every block.
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.92,
    metalness: 0.03,
  });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, allBuildings.length);
  bodies.name = 'city-buildings';
  bodies.castShadow = false;
  bodies.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  allBuildings.forEach((building, index) => {
    position.set(building.x, plan.streetY + building.h / 2, building.z);
    scale.set(building.w, building.h, building.d);
    matrix.compose(position, quaternion, scale);
    bodies.setMatrixAt(index, matrix);
    color.setHex(BODY_COLORS[building.color % BODY_COLORS.length]);
    bodies.setColorAt(index, color);
  });
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  bodies.computeBoundingSphere();
  root.add(bodies);

  // Roof caps.
  const roofs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
    allBuildings.length,
  );
  roofs.name = 'city-roofs';
  allBuildings.forEach((building, index) => {
    position.set(building.x, building.top + 0.16, building.z);
    scale.set(building.w * 0.92, 0.32, building.d * 0.92);
    matrix.compose(position, quaternion, scale);
    roofs.setMatrixAt(index, matrix);
    color.setHex(ROOF_COLORS[building.roofColor % ROOF_COLORS.length]);
    roofs.setColorAt(index, color);
  });
  roofs.instanceMatrix.needsUpdate = true;
  if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
  roofs.computeBoundingSphere();
  root.add(roofs);

  // Cyan window bands on the faces that point toward the route.
  const windows = [];
  for (const building of allBuildings) {
    if (!building.windows) continue;
    const side = building.x > 0 ? -1 : 1;
    const faceX = building.x + side * (building.w / 2 + 0.025);
    for (let floor = 1; floor <= building.floors; floor += 1) {
      windows.push({
        x: faceX,
        y: plan.streetY + floor * 5,
        z: building.z,
        w: 0.04,
        h: 0.14,
        d: building.d * 0.66,
      });
    }
  }
  const windowMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xc8edf5,
      transparent: true,
      opacity: 0.46,
    }),
    windows.length,
  );
  windowMesh.name = 'city-windows';
  windows.forEach((window, index) => {
    position.set(window.x, window.y, window.z);
    scale.set(window.w, window.h, window.d);
    matrix.compose(position, quaternion, scale);
    windowMesh.setMatrixAt(index, matrix);
  });
  windowMesh.instanceMatrix.needsUpdate = true;
  windowMesh.computeBoundingSphere();
  root.add(windowMesh);

  // Rooftop planting on the green roofs.
  const trees = [];
  for (const building of allBuildings) {
    if (building.roofColor !== 3) continue;
    trees.push({
      x: building.x - building.w * 0.2,
      y: building.top + 1,
      z: building.z + building.d * 0.1,
    });
    trees.push({
      x: building.x + building.w * 0.24,
      y: building.top + 0.8,
      z: building.z - building.d * 0.18,
    });
  }
  const treeMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.42, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x5f8067, roughness: 1 }),
    trees.length,
  );
  treeMesh.name = 'city-roof-trees';
  trees.forEach((tree, index) => {
    position.set(tree.x, tree.y, tree.z);
    scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    treeMesh.setMatrixAt(index, matrix);
  });
  treeMesh.instanceMatrix.needsUpdate = true;
  treeMesh.computeBoundingSphere();
  root.add(treeMesh);

  // Elevated transit line crossing the grid diagonally.
  const segments = [];
  const supports = [];
  for (let i = 0; i < plan.transit.length - 1; i += 1) {
    const a = plan.transit[i];
    const b = plan.transit[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    segments.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
      length,
      yaw: Math.atan2(-dz, dx),
    });
    if (i % 2 === 0) {
      supports.push({
        x: a.x,
        z: a.z,
        y: (plan.streetY + a.y) / 2,
        height: a.y - plan.streetY,
      });
    }
  }
  const trackMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc8dadd, roughness: 0.55 }),
    segments.length,
  );
  trackMesh.name = 'city-transit-track';
  segments.forEach((segment, index) => {
    position.set(segment.x, segment.y, segment.z);
    scale.set(segment.length, 0.55, 1.1);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.yaw);
    matrix.compose(position, quaternion, scale);
    trackMesh.setMatrixAt(index, matrix);
  });
  trackMesh.instanceMatrix.needsUpdate = true;
  trackMesh.computeBoundingSphere();
  root.add(trackMesh);

  const supportMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.8 }),
    supports.length,
  );
  supportMesh.name = 'city-transit-supports';
  supports.forEach((support, index) => {
    position.set(support.x, support.y, support.z);
    scale.set(0.42, support.height, 0.42);
    matrix.compose(position, quaternion.identity(), scale);
    supportMesh.setMatrixAt(index, matrix);
  });
  supportMesh.instanceMatrix.needsUpdate = true;
  supportMesh.computeBoundingSphere();
  root.add(supportMesh);

  // Two original wayfinding signs facing the route.
  for (const sign of plan.signs) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(8, 14, 18, .88)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d23a39';
    context.fillRect(0, 0, 7, canvas.height);
    context.fillStyle = '#f2eee3';
    context.font = '700 48px "Big Shoulders Display", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(sign.text, 260, 62);
    context.fillStyle = '#8fa3a9';
    context.font = '500 17px "IBM Plex Mono", monospace';
    context.fillText('ROOFTOP TRANSIT AUTHORITY', 260, 108);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.w, sign.h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    board.name = 'city-sign';
    board.position.set(sign.x, sign.y, sign.z);
    root.add(board);
  }

  // Rooftop service units and city lights are each one draw call.
  const units = [];
  for (const building of allBuildings) {
    if (!building.roofUnit) continue;
    units.push({
      x: building.x + building.w * 0.18,
      y: building.top + 0.8,
      z: building.z - building.d * 0.16,
      w: 1.2,
      h: 1.2,
      d: 1.1,
    });
  }
  const unitMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x71858c, roughness: 0.8 }),
    units.length,
  );
  unitMesh.name = 'city-roof-units';
  units.forEach((unit, index) => {
    position.set(unit.x, unit.y, unit.z);
    scale.set(unit.w, unit.h, unit.d);
    matrix.compose(position, quaternion, scale);
    unitMesh.setMatrixAt(index, matrix);
  });
  unitMesh.instanceMatrix.needsUpdate = true;
  unitMesh.computeBoundingSphere();
  root.add(unitMesh);

  const lightMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 2.4, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffe2b8 }),
    plan.lights.length,
  );
  lightMesh.name = 'city-lights';
  plan.lights.forEach((light, index) => {
    position.set(light.x, light.y, light.z);
    scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    lightMesh.setMatrixAt(index, matrix);
  });
  lightMesh.instanceMatrix.needsUpdate = true;
  lightMesh.computeBoundingSphere();
  root.add(lightMesh);

  // Skybridges crossing the canyon above the route.
  const bridgeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc4d6da, roughness: 0.7 }),
    plan.bridges.length,
  );
  bridgeMesh.name = 'city-skybridges';
  plan.bridges.forEach((bridge, index) => {
    position.set(bridge.x, bridge.y, bridge.z);
    scale.set(bridge.w, 0.5, bridge.d);
    matrix.compose(position, quaternion, scale);
    bridgeMesh.setMatrixAt(index, matrix);
  });
  bridgeMesh.instanceMatrix.needsUpdate = true;
  bridgeMesh.computeBoundingSphere();
  root.add(bridgeMesh);

  // Red beacon lights on landmark towers.
  const beaconMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.34, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xd23a39 }),
    plan.landmarks.length,
  );
  beaconMesh.name = 'city-landmark-beacons';
  plan.landmarks.forEach((landmark, index) => {
    position.set(landmark.x, landmark.top + 1.2, landmark.z);
    scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    beaconMesh.setMatrixAt(index, matrix);
  });
  beaconMesh.instanceMatrix.needsUpdate = true;
  beaconMesh.computeBoundingSphere();
  root.add(beaconMesh);

  // Distant low-detail skyline; fades into fog.
  const distantMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x8fa9b2, fog: true }),
    plan.distant.length,
  );
  distantMesh.name = 'city-distant-skyline';
  plan.distant.forEach((building, index) => {
    position.set(building.x, plan.streetY + building.h / 2, building.z);
    scale.set(building.w, building.h, building.d);
    matrix.compose(position, quaternion, scale);
    distantMesh.setMatrixAt(index, matrix);
  });
  distantMesh.instanceMatrix.needsUpdate = true;
  distantMesh.computeBoundingSphere();
  root.add(distantMesh);

  return {
    root,
    stats: {
      buildings: allBuildings.length,
      windows: windows.length,
      bridges: plan.bridges.length,
      landmarks: plan.landmarks.length,
      lights: plan.lights.length,
      trees: trees.length,
      signs: plan.signs.length,
      transitSegments: segments.length,
      transitSupports: supports.length,
    },
  };
}
