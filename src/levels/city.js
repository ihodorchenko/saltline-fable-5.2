// @ts-check
// Deterministic procedural city district around the hand-authored route.
// The city is decorative: route collisions remain the authored level boxes.

import { SIGN, drawSignPlate } from './signs.js';

const BODY_COLORS = [0xffffff, 0xf7f4ea, 0xeaf3f4, 0xf1eee4, 0xe3eef0];
// Muted tints for the accent towers. Saturation is reserved for the red route
// and goals (see docs/DESIGN.md), so no accent may be vivid or red-hued.
export const ACCENT_COLORS = [0xb9c5ce, 0xbfcac2, 0xd9d3c8, 0xc2c5d2, 0xcbd4d9];

// Accent towers are far-field only: within this distance of the route centre line
// they fall back to plain white, so colour arrives as aerial perspective and the
// red route stays the loudest thing near the player.
export const ACCENT_MIN_DISTANCE = 38;

/**
 * @param {number} style building style (0 glass, 1 white, 2 accent)
 * @param {number} x building centre, lateral distance from the route line
 * @returns {number}
 */
export function resolveStyle(style, x) {
  return style === 2 && Math.abs(x) < ACCENT_MIN_DISTANCE ? 1 : style;
}
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
  const abyssY = Number(config.abyssY) || -150;
  const corridor = Number(config.corridor) || 15;
  const rng = makeRng(seed);
  const buildings = [];
  const landmarks = [
    { x: -34, z: -38, w: 14, d: 14, h: 58, color: 4, roofColor: 1 },
    { x: 35, z: -108, w: 12, d: 12, h: 74, color: 1, roofColor: 0 },
    { x: -36, z: -182, w: 15, d: 15, h: 64, color: 3, roofColor: 2 },
  ].map((landmark, index) => ({
    ...landmark,
    style: index % 3,
    streetY,
    top: streetY + landmark.h,
    keep: 0,
    floors: Math.max(4, Math.floor((landmark.h - 4) / 5)),
    windows: true,
    roofUnit: false,
    landmark: true,
  }));
  const edgeBuildings = [
    // Start: frame the spawn roof with near, mid-height blocks on both sides.
    { x: -24, z: 8, w: 9, d: 11, h: 26, color: 2, roofColor: 1, edge: 'start' },
    { x: 25, z: 4, w: 9, d: 10, h: 32, color: 1, roofColor: 0, edge: 'start' },
    { x: -27, z: -8, w: 11, d: 12, h: 24, color: 3, roofColor: 2, edge: 'start' },
    { x: 28, z: -15, w: 10, d: 13, h: 30, color: 4, roofColor: 1, edge: 'start' },
    // Finish: a taller ring framing the final roof and the spire behind it.
    { x: -27, z: -202, w: 12, d: 12, h: 44, color: 3, roofColor: 0, edge: 'finish' },
    { x: 30, z: -208, w: 11, d: 10, h: 38, color: 1, roofColor: 1, edge: 'finish' },
    { x: -32, z: -224, w: 14, d: 14, h: 56, color: 4, roofColor: 2, edge: 'finish' },
    { x: 36, z: -230, w: 12, d: 14, h: 48, color: 2, roofColor: 0, edge: 'finish' },
    { x: -20, z: -214, w: 8, d: 9, h: 18, color: 1, roofColor: 3, edge: 'finish' },
    { x: 23, z: -220, w: 8, d: 9, h: 20, color: 3, roofColor: 3, edge: 'finish' },
  ].map((building) => ({
    ...building,
    streetY,
    top: streetY + building.h,
    keep: 0,
    floors: Math.max(2, Math.floor((building.h - 4) / 5)),
    windows: true,
    roofUnit: building.h > 22,
    landmark: false,
    style: building.style ?? (building.edge === 'start' ? 1 : 2),
  }));
  const occupied = [...landmarks, ...edgeBuildings];
  const overlaps = (candidate) =>
    occupied.some((other) => {
      const ox = (candidate.w + other.w) / 2 - Math.abs(candidate.x - other.x);
      const oz = (candidate.d + other.d) / 2 - Math.abs(candidate.z - other.z);
      return ox > -1.2 && oz > -1.2;
    });

  // Canyon walls: a deterministic row of near facades whose inner face sits just
  // outside the route corridor. The reference is a corridor of close verticals
  // with the sky as a narrow band; the generic grid alone left the nearest facade
  // ~35 m away and the route read as slabs floating in an open field.
  for (let z = 16; z >= -224; z -= 13) {
    const row = Math.round((16 - z) / 13);
    for (const side of [-1, 1]) {
      const width = 8 + rng() * 6;
      const depth = 11 + rng() * 6;
      const inner = corridor + 0.6 + rng() * 2.2;
      const x = side * (inner + width / 2);
      const height = 26 + rng() * 32;
      const candidate = {
        x,
        z: z + (rng() - 0.5) * 3,
        w: width,
        d: depth,
        h: height,
        top: streetY + height,
        color: Math.floor(rng() * BODY_COLORS.length),
        roofColor: Math.floor(rng() * (ROOF_COLORS.length - 1)),
        keep: 0.9,
        floors: Math.max(4, Math.floor((height - 4) / 5)),
        windows: true,
        roofUnit: height > 34,
        landmark: false,
        nearFacade: true,
        // Anchor rows force a dark glass tower every few canyon bays, alternating
        // sides (the first one sits beside the spawn roof), so the route always
        // has near-black curtain wall in the frame. The rest of the row keeps the
        // random glass/concrete mix.
        style:
          (row % 4 === 1 && side === (Math.floor((row - 1) / 4) % 2 === 0 ? -1 : 1)) || rng() < 0.3 ? 0 : 1,
      };
      if (!overlaps(candidate)) {
        buildings.push(candidate);
        occupied.push(candidate);
      }
    }
  }

  // Spawn view: the start frame buildings pushed the first canyon rows out, so the
  // near-left wall would be the only concrete slab beside the route. Promote it to
  // the dark glass style: the reference always has one near-black reflective tower
  // next to the runner, and a flat concrete wall is exactly the "cardboard" read
  // the materials pass is fixing.
  const spawnFlank = buildings.find((building) => building.nearFacade && building.x < 0 && building.z > -30);
  if (spawnFlank) spawnFlank.style = 0;

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
      const height = (inner ? 16 : 22) + rng() * (inner ? 34 : 48);
      const top = streetY + height;
      const styleRoll = rng();
      const style = styleRoll < 0.55 ? 0 : styleRoll < 0.84 ? 1 : 2;
      const candidate = {
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
        style,
      };
      if (!overlaps(candidate)) {
        buildings.push(candidate);
        occupied.push(candidate);
      }
    }
  }

  // Smaller infill blocks break the checkerboard rhythm of the primary grid.
  let infill = 0;
  for (let attempt = 0; attempt < 180 && infill < 26; attempt += 1) {
    const bx = (rng() * 2 - 1) * 92;
    const bz = 18 - rng() * 238;
    if (Math.abs(bx) < corridor + 4) continue;
    const width = 4.5 + rng() * 4;
    const depth = 4.5 + rng() * 4;
    if (Math.abs(bx) - width / 2 < corridor) continue;
    const height = 10 + rng() * 30;
    const inner = Math.abs(bx) < 44;
    const candidate = {
      x: bx,
      z: bz,
      w: width,
      d: depth,
      h: height,
      top: streetY + height,
      color: Math.floor(rng() * BODY_COLORS.length),
      roofColor: inner && rng() < 0.4 ? 3 : Math.floor(rng() * (ROOF_COLORS.length - 1)),
      keep: 0,
      floors: Math.max(2, Math.floor((height - 4) / 5)),
      windows: rng() > 0.3,
      roofUnit: rng() > 0.6,
      landmark: false,
      infill: true,
      style: rng() < 0.55 ? 0 : rng() < 0.75 ? 1 : 2,
    };
    if (!overlaps(candidate)) {
      buildings.push(candidate);
      occupied.push(candidate);
      infill += 1;
    }
  }
  buildings.push(...edgeBuildings);

  const spire = {
    x: -76,
    z: -246,
    height: 132,
    baseY: streetY,
    radius: 7,
  };

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
    { x: -27, y: 9, z: -29, w: 11, h: 3.2, text: 'CITY OF LIGHT', sub: 'ROOFTOP TRANSIT AUTHORITY' },
    { x: 28, y: 13, z: -105, w: 11, h: 3.2, text: 'GLASSLINE / 04', sub: 'DISTRICT TRANSIT' },
    { x: 0, y: 5.6, z: -207, w: 10, h: 2.8, text: 'END OF LINE', sub: 'ROOFTOP INDUCTION / FINAL ROOF' },
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

  // Two overlapping horizon rings. They are deliberately outside the playable
  // district and tall enough to close every sightline from the route.
  const backdrop = [];
  const rings = [
    { radius: 210, count: 110, minHeight: 48, maxHeight: 92, xScale: 1.24 },
    { radius: 270, count: 132, minHeight: 54, maxHeight: 108, xScale: 1.3 },
    { radius: 330, count: 120, minHeight: 42, maxHeight: 96, xScale: 1.35 },
  ];
  for (const [ringIndex, ring] of rings.entries()) {
    const offset = ringIndex * 0.5;
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2 + offset;
      const radius = ring.radius + (rng() - 0.5) * 18;
      const width = 24 + rng() * 22;
      const depth = 20 + rng() * 18;
      const height = ring.minHeight + rng() * (ring.maxHeight - ring.minHeight);
      const x = Math.cos(angle) * radius * ring.xScale;
      const z = -96 + Math.sin(angle) * radius;
      // Leave a central canyon behind the finish; a far terminal tower closes
      // the view without flattening the whole horizon into one facade wall.
      if (Math.abs(x) < 58 && z < -255) continue;
      backdrop.push({
        x,
        z,
        w: width,
        d: depth,
        h: height,
        color: Math.floor(rng() * BODY_COLORS.length),
      });
    }
  }

  backdrop.push(
    { x: 0, z: -382, w: 58, d: 32, h: 78, color: 1 },
    { x: -112, z: -350, w: 62, d: 30, h: 88, color: 3 },
    { x: 114, z: -350, w: 62, d: 30, h: 84, color: 2 },
    // The same treatment behind the spawn, seen if the player turns around.
    { x: 0, z: 206, w: 58, d: 30, h: 74, color: 2 },
    { x: -94, z: 178, w: 58, d: 30, h: 78, color: 4 },
    { x: 94, z: 178, w: 58, d: 30, h: 82, color: 1 },
  );

  return {
    seed,
    streetY,
    abyssY,
    corridor,
    buildings,
    landmarks,
    bridges,
    lights,
    transit,
    signs,
    spire,
    distant,
    backdrop,
  };
}

/**
 * @param {any} game
 * @param {any} level
 * @param {ReturnType<typeof createCityPlan>} plan
 */
export function buildCity(game, level, plan, textures = null) {
  const { THREE } = game;
  const root = new THREE.Group();
  root.name = 'glassline-city';
  const quality = game.quality?.name || 'high';
  const density = quality === 'low' ? 0.55 : quality === 'medium' ? 0.78 : 1;

  const buildings = plan.buildings.filter((building) => building.keep <= density);
  const allBuildings = [...buildings, ...plan.landmarks];

  // Abyss: a luminous sky-lit plane below the towers instead of a street grid.
  const abyss = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 2200),
    new THREE.MeshBasicMaterial({ color: 0xeaf7ff, fog: true }),
  );
  abyss.name = 'city-abyss';
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.set(0, plan.abyssY - 18, -96);
  root.add(abyss);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const glassBundle = textures?.glassMaps ? textures.glassMaps({ repeat: [2, 3] }) : null;
  const bodyMaterials = [
    // Dark tinted curtain wall. Near-black navy bays with pale mullion frames and
    // a roughness map that keeps the panes almost mirror-smooth while the frames
    // stay rough: without that separation the facade mirrors as one flat sheet.
    // The real scene probe (reflections.js) replaces the sky-only envMap later.
    new THREE.MeshStandardMaterial({
      map: glassBundle ? glassBundle.map : null,
      normalMap: glassBundle ? glassBundle.normalMap : null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: glassBundle ? glassBundle.roughnessMap : null,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      envMap: game.scene?.environment || null,
      envMapIntensity: 2.3,
    }),
    (() => {
      const bundle = textures?.concreteMaps ? textures.concreteMaps(0xf2ece0, { repeat: [2.6, 4.2] }) : null;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0.03,
      });
      if (bundle) {
        material.map = bundle.map;
        material.normalMap = bundle.normalMap;
        material.normalScale = new THREE.Vector2(1, 1);
        material.roughnessMap = bundle.roughnessMap;
      }
      return material;
    })(),
    (() => {
      const bundle = textures?.concreteMaps ? textures.concreteMaps(0xe9e7dc, { repeat: [2.2, 3.6] }) : null;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0.04,
      });
      if (bundle) {
        material.map = bundle.map;
        material.normalMap = bundle.normalMap;
        material.normalScale = new THREE.Vector2(1, 1);
        material.roughnessMap = bundle.roughnessMap;
      }
      return material;
    })(),
  ];
  // The glass and metal materials are what the scene reflection probes are for.
  bodyMaterials[0].userData.reflections = 'glass';
  // Per-instance tone variation: whole towers differ in value the way the
  // reference skyline does, on top of the per-bay variation baked in the map.
  const GLASS_TINTS = [0xffffff, 0xdfe8ec, 0xb6c4cc, 0x8d9ba4, 0xeef2f3, 0x6f7d86];
  const BODY_TINTS = [0xffffff, 0xfaf6ec, 0xf3f5f1, 0xf7f0e6, 0xf1f3ee];
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'city-buildings';
  const styleCounts = [0, 0, 0];
  for (let style = 0; style < 3; style += 1) {
    const group = allBuildings.filter((building) => resolveStyle(building.style || 0, building.x) === style);
    styleCounts[style] = group.length;
    const mesh = new THREE.InstancedMesh(bodyGeometry, bodyMaterials[style], group.length);
    mesh.name = `city-buildings-${style}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.forEach((building, index) => {
      const height = building.top - plan.abyssY;
      position.set(building.x, plan.abyssY + height / 2, building.z);
      scale.set(building.w, height, building.d);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      if (style === 2) {
        color.setHex(ACCENT_COLORS[index % ACCENT_COLORS.length]);
        mesh.setColorAt(index, color);
      } else if (style === 0) {
        color.setHex(GLASS_TINTS[index % GLASS_TINTS.length]);
        mesh.setColorAt(index, color);
      } else {
        color.setHex(BODY_TINTS[index % BODY_TINTS.length]);
        mesh.setColorAt(index, color);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    bodyGroup.add(mesh);
  }
  root.add(bodyGroup);

  // Roof caps.
  const roofs = new THREE.InstancedMesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({
      map: textures?.roof ? textures.roof() : null,
      roughness: 0.9,
      metalness: 0.02,
    }),
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

  // Scale-correct window bands: inner faces plus the front faces visible from
  // the route. These are geometry, not stretched into the facade texture. The
  // dense canyon lattice is a high/ultra detail: low quality has a triangle
  // budget and keeps the old sparse rhythm.
  const detailCity = game?.quality?.name !== 'low';
  const bandSpacing = detailCity ? 2.8 : 4;
  const windows = [];
  for (const building of allBuildings) {
    if (!building.windows) continue;
    const side = building.x > 0 ? -1 : 1;
    const faceX = building.x + side * (building.w / 2 + 0.025);
    const faceZ = building.z + building.d / 2 + 0.025;
    // Fill the whole visible facade: the route is a canyon now, so these bands
    // are what gives the near walls their scale. 3.6 m storeys, not 5 m.
    for (let y = building.top - bandSpacing; y > building.streetY + 2; y -= bandSpacing) {
      windows.push({
        x: faceX,
        y,
        z: building.z,
        rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        width: building.d * 0.7,
        height: 0.2,
      });
      windows.push({
        x: building.x,
        y,
        z: faceZ,
        rotY: 0,
        width: building.w * 0.68,
        height: 0.2,
      });
    }
  }
  // White parapet caps on the near canyon facades. Horizontal white surfaces are
  // the cheapest way to raise near-white area in frame: their top faces catch the
  // high sun and read as the reference's white architecture, not grey card.
  const caps = [];
  for (const building of allBuildings) {
    if (!detailCity) break;
    const near = building.nearFacade || Math.abs(building.x) < 30;
    if (!near) continue;
    const side = building.x > 0 ? -1 : 1;
    caps.push({
      x: building.x + side * (building.w / 2 + 0.12),
      y: building.top + 0.24,
      z: building.z,
      w: 0.3,
      h: 0.48,
      d: building.d + 0.24,
    });
  }
  const capMesh = new THREE.InstancedMesh(
    bodyGeometry,
    // Shared pale concrete body material: parapets pick up the same joint/relief
    // maps as the walls they cap, so the whole white architecture reads as one
    // cast system instead of a stack of untextured white boxes.
    bodyMaterials[1],
    Math.max(1, caps.length),
  );
  capMesh.name = 'city-parapet-caps';
  caps.forEach((cap, index) => {
    position.set(cap.x, cap.y, cap.z);
    scale.set(cap.w, cap.h, cap.d);
    matrix.compose(position, quaternion.identity(), scale);
    capMesh.setMatrixAt(index, matrix);
  });
  capMesh.instanceMatrix.needsUpdate = true;
  capMesh.computeBoundingSphere();
  root.add(capMesh);

  // White setback terraces on the near canyon walls: two stepped slabs per facade.
  // Their top faces catch the high sun and give the canyon the reference's big
  // white horizontal planes instead of only vertical grey card.
  const terraces = [];
  for (const building of allBuildings) {
    if (!detailCity) break;
    const near = building.nearFacade || Math.abs(building.x) < 34;
    if (!near) continue;
    for (const level of [0.52, 0.8]) {
      terraces.push({
        x: building.x,
        y: building.streetY + building.h * level,
        z: building.z,
        w: building.w + 0.6,
        h: 0.26,
        d: building.d + 0.6,
      });
    }
  }
  const terraceMesh = new THREE.InstancedMesh(bodyGeometry, bodyMaterials[1], Math.max(1, terraces.length));
  terraceMesh.name = 'city-terraces';
  terraces.forEach((terrace, index) => {
    position.set(terrace.x, terrace.y, terrace.z);
    scale.set(terrace.w, terrace.h, terrace.d);
    matrix.compose(position, quaternion.identity(), scale);
    terraceMesh.setMatrixAt(index, matrix);
  });
  terraceMesh.instanceMatrix.needsUpdate = true;
  terraceMesh.computeBoundingSphere();
  root.add(terraceMesh);

  // Window bands are recessed dark glazing: on the white concrete bodies they read
  // as punched window strips, on the dark curtain walls as the dark floor line
  // between reflective bays. They used to be pale cyan lights, which is what made
  // every facade read as a flat glowing grid. At high/ultra they are shallow 6 cm
  // frames rather than coplanar decals, so a strip standing proud of the concrete
  // catches its own sun/shade line at close range (344 bands x 12 tris = ~3.4 k
  // triangles, one draw call, inside the +15 % budget; low quality keeps planes).
  const windowMesh = new THREE.InstancedMesh(
    detailCity ? new THREE.BoxGeometry(1, 1, 0.06) : new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.2 }),
    windows.length,
  );
  windowMesh.name = 'city-windows';
  const WINDOW_TINTS = [0x2b4050, 0x223440, 0x31495a, 0x1d2c36, 0x3a5666];
  const windowColor = new THREE.Color();
  windows.forEach((window, index) => {
    position.set(window.x, window.y, window.z);
    scale.set(window.width, window.height, 1);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.rotY);
    matrix.compose(position, quaternion, scale);
    windowMesh.setMatrixAt(index, matrix);
    windowColor.setHex(WINDOW_TINTS[index % WINDOW_TINTS.length]);
    windowMesh.setColorAt(index, windowColor);
  });
  if (windowMesh.instanceColor) windowMesh.instanceColor.needsUpdate = true;
  windowMesh.instanceMatrix.needsUpdate = true;
  windowMesh.computeBoundingSphere();
  root.add(windowMesh);

  // Vertical mullions on the near canyon facades: without them the canyon walls
  // are flat planes with a few horizontal bands, which reads as blank card.
  const mullions = [];
  for (const building of allBuildings) {
    if (!detailCity) break;
    if (!building.windows) continue;
    const near = building.nearFacade || Math.abs(building.x) < 30;
    if (!near) continue;
    const side = building.x > 0 ? -1 : 1;
    const faceX = building.x + side * (building.w / 2 + 0.035);
    const count = Math.max(4, Math.round(building.d / 1.55));
    const span = building.d * 0.86;
    for (let i = 0; i < count; i += 1) {
      const z = building.z - span / 2 + (count === 1 ? 0 : (span / (count - 1)) * i);
      mullions.push({ x: faceX, z, height: building.h, y: building.top - building.h / 2 });
    }
  }
  // Pale mullion frames against the dark glass: the bright vertical rhythm is
  // most of the curtain-wall read, so the frames are light painted metal with a
  // real environment reflection rather than mid-grey flat strips.
  const metalBundle = textures?.metalMaps ? textures.metalMaps() : null;
  const mullionMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9edee,
    map: metalBundle ? metalBundle.map : null,
    normalMap: metalBundle ? metalBundle.normalMap : null,
    roughnessMap: metalBundle ? metalBundle.roughnessMap : null,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.62,
    metalness: 0.32,
    envMap: game.scene?.environment || null,
    envMapIntensity: 1.6,
  });
  mullionMaterial.userData.reflections = 'metal';
  // One brushed-metal material for the whole transit/service kit: track, supports,
  // roof units and bridges keep their tonal separation through per-instance
  // colours instead of four near-identical materials.
  const cityMetal = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: metalBundle ? metalBundle.map : textures?.metal?.() || null,
    normalMap: metalBundle ? metalBundle.normalMap : null,
    roughnessMap: metalBundle ? metalBundle.roughnessMap : null,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.8,
    metalness: 0.62,
    envMap: game.scene?.environment || null,
    envMapIntensity: 1.4,
  });
  cityMetal.userData.reflections = 'metal';
  const setInstanceTones = (mesh, hexes) => {
    hexes.forEach((hex, index) => {
      color.setHex(hex);
      mesh.setColorAt(index, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const mullionMesh = new THREE.InstancedMesh(bodyGeometry, mullionMaterial, Math.max(1, mullions.length));
  mullionMesh.name = 'city-mullions';
  mullions.forEach((mullion, index) => {
    position.set(mullion.x, mullion.y, mullion.z);
    scale.set(0.13, mullion.height, 0.18);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    matrix.compose(position, quaternion, scale);
    mullionMesh.setMatrixAt(index, matrix);
  });
  mullionMesh.instanceMatrix.needsUpdate = true;
  mullionMesh.computeBoundingSphere();
  root.add(mullionMesh);

  // Balcony bands break up the flat instanced facades.
  const balconies = [];
  for (const building of allBuildings) {
    const side = building.x > 0 ? -1 : 1;
    const faceX = building.x + side * (building.w / 2 + 0.2);
    const near = building.nearFacade || Math.abs(building.x) < 30;
    for (let floor = 2; floor <= building.floors; floor += near ? 2 : 3) {
      balconies.push({
        x: faceX,
        y: building.top - floor * 5,
        z: building.z,
        w: 0.42,
        h: 0.14,
        d: building.d * 0.72,
      });
    }
  }
  const balconyMesh = new THREE.InstancedMesh(bodyGeometry, bodyMaterials[1], Math.max(1, balconies.length));
  balconyMesh.name = 'city-balconies';
  balconies.forEach((balcony, index) => {
    position.set(balcony.x, balcony.y, balcony.z);
    scale.set(balcony.w, balcony.h, balcony.d);
    matrix.compose(position, quaternion.identity(), scale);
    balconyMesh.setMatrixAt(index, matrix);
  });
  balconyMesh.instanceMatrix.needsUpdate = true;
  balconyMesh.computeBoundingSphere();
  root.add(balconyMesh);

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
        y: (plan.abyssY + a.y) / 2,
        height: a.y - plan.abyssY,
      });
    }
  }
  const trackMesh = new THREE.InstancedMesh(bodyGeometry, cityMetal, segments.length);
  trackMesh.name = 'city-transit-track';
  segments.forEach((segment, index) => {
    position.set(segment.x, segment.y, segment.z);
    scale.set(segment.length, 0.55, 1.1);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.yaw);
    matrix.compose(position, quaternion, scale);
    trackMesh.setMatrixAt(index, matrix);
  });
  setInstanceTones(
    trackMesh,
    segments.map(() => 0xc8dadd),
  );
  trackMesh.instanceMatrix.needsUpdate = true;
  trackMesh.computeBoundingSphere();
  root.add(trackMesh);

  const supportMesh = new THREE.InstancedMesh(bodyGeometry, cityMetal, supports.length);
  supportMesh.name = 'city-transit-supports';
  supports.forEach((support, index) => {
    position.set(support.x, support.y, support.z);
    scale.set(0.42, support.height, 0.42);
    matrix.compose(position, quaternion.identity(), scale);
    supportMesh.setMatrixAt(index, matrix);
  });
  setInstanceTones(
    supportMesh,
    supports.map(() => 0x9fb3b8),
  );
  supportMesh.instanceMatrix.needsUpdate = true;
  supportMesh.computeBoundingSphere();
  root.add(supportMesh);

  // Two original wayfinding signs facing the route.
  for (const sign of plan.signs) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    drawSignPlate(context, canvas.width, canvas.height);
    context.fillStyle = SIGN.ink;
    context.font = '700 48px "Big Shoulders Display", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(sign.text, canvas.width / 2, 68);
    context.fillStyle = SIGN.inkSoft;
    context.font = '500 17px "IBM Plex Mono", monospace';
    context.fillText(sign.sub || 'ROOFTOP TRANSIT AUTHORITY', canvas.width / 2, 110);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.w, sign.h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.FrontSide,
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
  const unitMesh = new THREE.InstancedMesh(bodyGeometry, cityMetal, units.length);
  unitMesh.name = 'city-roof-units';
  units.forEach((unit, index) => {
    position.set(unit.x, unit.y, unit.z);
    scale.set(unit.w, unit.h, unit.d);
    matrix.compose(position, quaternion, scale);
    unitMesh.setMatrixAt(index, matrix);
  });
  setInstanceTones(
    unitMesh,
    units.map((unit, index) => (index % 3 === 0 ? 0xf2f4f3 : 0xd6dfe0)),
  );
  unitMesh.instanceMatrix.needsUpdate = true;
  unitMesh.computeBoundingSphere();
  root.add(unitMesh);

  // Skybridges crossing the canyon above the route.
  const bridgeMesh = new THREE.InstancedMesh(bodyGeometry, cityMetal, plan.bridges.length);
  bridgeMesh.name = 'city-skybridges';
  plan.bridges.forEach((bridge, index) => {
    position.set(bridge.x, bridge.y, bridge.z);
    scale.set(bridge.w, 0.5, bridge.d);
    matrix.compose(position, quaternion, scale);
    bridgeMesh.setMatrixAt(index, matrix);
  });
  setInstanceTones(
    bridgeMesh,
    plan.bridges.map((bridge) => bridge.color || 0xc4d6da),
  );
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

  // Central spire: the skyline landmark that resolves the route's vanishing point.
  if (plan.spire) {
    const spire = new THREE.Group();
    spire.name = 'city-spire';
    spire.position.set(plan.spire.x, plan.spire.baseY, plan.spire.z);
    const baseHeight = plan.spire.height * 0.78;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 10.5, baseHeight, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf4f1e8,
        roughness: 0.34,
        metalness: 0.45,
      }),
    );
    base.position.y = baseHeight / 2;
    spire.add(base);
    const crownHeight = plan.spire.height * 0.28;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 3.4, crownHeight, 8),
      new THREE.MeshStandardMaterial({
        color: 0xd8ecee,
        emissive: 0x0c4f5c,
        emissiveIntensity: 0.4,
        roughness: 0.28,
        metalness: 0.55,
      }),
    );
    crown.position.y = baseHeight + crownHeight / 2;
    spire.add(crown);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x9fe3e8 });
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2 - i * 1.2, 0.12, 6, 32), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = baseHeight * 0.32 + i * 18;
      spire.add(ring);
    }
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.55, 24, 8),
      new THREE.MeshStandardMaterial({ color: 0x6c7e83, metalness: 0.7, roughness: 0.3 }),
    );
    antenna.position.y = plan.spire.height + 10;
    spire.add(antenna);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xd23a39 }),
    );
    beacon.position.y = plan.spire.height + 22;
    spire.add(beacon);
    root.add(spire);
  }

  // Outer horizon rings: overlapping towers that close every sightline.
  const facadeBundle = textures?.facadeMaps ? textures.facadeMaps() : null;
  const backdropMesh = new THREE.InstancedMesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({
      map: facadeBundle ? facadeBundle.map : null,
      normalMap: facadeBundle ? facadeBundle.normalMap : null,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap: facadeBundle ? facadeBundle.roughnessMap : null,
      roughness: 1,
      metalness: 0.03,
    }),
    plan.backdrop.length,
  );
  backdropMesh.name = 'city-backdrop';
  plan.backdrop.forEach((building, index) => {
    const top = plan.streetY + building.h;
    const height = top - plan.abyssY;
    position.set(building.x, plan.abyssY + height / 2, building.z);
    scale.set(building.w, height, building.d);
    matrix.compose(position, quaternion.identity(), scale);
    backdropMesh.setMatrixAt(index, matrix);
    color.setHex(BODY_COLORS[building.color % BODY_COLORS.length]);
    backdropMesh.setColorAt(index, color);
  });
  backdropMesh.instanceMatrix.needsUpdate = true;
  if (backdropMesh.instanceColor) backdropMesh.instanceColor.needsUpdate = true;
  backdropMesh.computeBoundingSphere();
  root.add(backdropMesh);

  // Distant low-detail skyline; fades into fog.
  const distantMesh = new THREE.InstancedMesh(
    bodyGeometry,
    new THREE.MeshBasicMaterial({ color: 0x8fa9b2, fog: true }),
    plan.distant.length,
  );
  distantMesh.name = 'city-distant-skyline';
  plan.distant.forEach((building, index) => {
    const top = plan.streetY + building.h;
    const height = top - plan.abyssY;
    position.set(building.x, plan.abyssY + height / 2, building.z);
    scale.set(building.w, height, building.d);
    matrix.compose(position, quaternion.identity(), scale);
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
      lights: 0,
      trees: trees.length,
      signs: plan.signs.length,
      transitSegments: segments.length,
      transitSupports: supports.length,
      balconies: balconies.length,
      spire: !!plan.spire,
      backdrop: plan.backdrop.length,
      styles: styleCounts,
    },
  };
}
