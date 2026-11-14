// @ts-check
// Original procedural courier/mentor characters. No external skeletons or
// models: every limb is a capsule in a pivot group so joints rotate correctly.

const geometryCache = new Map();

function geometry(THREE, key, make) {
  if (!geometryCache.has(key)) geometryCache.set(key, make());
  return geometryCache.get(key);
}

function materials(game) {
  const { THREE } = game;
  return {
    suit: new THREE.MeshStandardMaterial({ color: 0x202830, roughness: 0.72 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.6 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.72 }),
    accent: new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0x571400,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
    mentorJacket: new THREE.MeshStandardMaterial({
      color: 0xe6b93c,
      roughness: 0.46,
    }),
    mentorDark: new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.78 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0xdfe8e6, roughness: 0.68 }),
  };
}

function createLimb(THREE, radius, length, material) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(
    geometry(
      THREE,
      `capsule:${radius}:${length}`,
      () => new THREE.CapsuleGeometry(radius, length, 4, 8),
    ),
    material,
  );
  mesh.position.y = -length / 2;
  mesh.castShadow = false;
  pivot.add(mesh);
  return pivot;
}

function markRigObject(root) {
  root.traverse((object) => {
    if (object.isMesh) {
      object.frustumCulled = false;
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
}

/**
 * @param {any} game
 */
export function createCourierRig(game) {
  const { THREE } = game;
  const mats = materials(game);
  const root = new THREE.Group();
  root.name = 'courier-rig';
  root.visible = false;

  const arms = new THREE.Group();
  arms.position.set(0, -0.36, -0.46);
  const legs = new THREE.Group();
  legs.position.set(0, -1.02, -0.12);

  const makeArm = (side) => {
    const shoulder = createLimb(THREE, 0.03, 0.17, mats.cloth);
    shoulder.position.set(side * 0.25, 0, 0);
    shoulder.rotation.x = 1.32;
    shoulder.rotation.z = side * 0.16;
    const elbow = new THREE.Group();
    elbow.position.y = -0.22;
    elbow.rotation.x = 0.38;
    const forearm = new THREE.Mesh(
      geometry(THREE, 'capsule:0.022:0.13', () => new THREE.CapsuleGeometry(0.022, 0.13, 4, 8)),
      mats.skin,
    );
    forearm.position.y = -0.07;
    elbow.add(forearm);
    const hand = new THREE.Mesh(
      geometry(THREE, 'sphere:0.038', () => new THREE.SphereGeometry(0.038, 8, 6)),
      mats.skin,
    );
    hand.position.y = -0.16;
    hand.scale.z = 1.25;
    elbow.add(hand);
    shoulder.add(elbow);
    arms.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const tracker = new THREE.Mesh(
    geometry(THREE, 'tracker', () => new THREE.CylinderGeometry(0.041, 0.041, 0.038, 12)),
    mats.accent,
  );
  tracker.name = 'courier-tracker';
  tracker.rotation.z = Math.PI / 2;
  tracker.position.set(0, -0.1, 0.02);
  leftArm.elbow.add(tracker);

  const makeLeg = (side) => {
    const hip = createLimb(THREE, 0.065, 0.36, mats.suit);
    hip.position.set(side * 0.12, 0, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.38;
    const shin = createLimb(THREE, 0.052, 0.32, mats.suit);
    shin.position.y = -0.02;
    knee.add(shin);
    const shoe = new THREE.Mesh(
      geometry(THREE, 'shoe:courier', () => new THREE.BoxGeometry(0.1, 0.075, 0.22)),
      mats.accent,
    );
    shoe.position.set(0, -0.36, -0.055);
    knee.add(shoe);
    hip.add(knee);
    legs.add(hip);
    return { hip, knee, shoe };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  root.add(arms, legs);
  markRigObject(root);
  game.scene.add(root);

  return {
    root,
    arms,
    legs,
    joints: {
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee,
    },
    setVisible(visible) {
      root.visible = !!visible;
    },
    update(camera, state, time, dt) {
      root.position.copy(camera.position);
      root.quaternion.copy(camera.quaternion);
      const target = 1 - Math.exp(-12 * Math.min(dt, 0.05));
      const speed = Math.max(0, state.speed || 0);
      const moving = speed > 0.5;
      const amp = moving ? Math.min(0.3, speed * 0.025) : 0.018;
      const cycle = time * (moving ? 7 + Math.min(5, speed) * 0.45 : 1.6);
      const swing = Math.sin(cycle);
      const side = Math.cos(cycle * 0.5) * 0.65;
      const j = this.joints;
      const ease = (object, axis, value) => {
        object.rotation[axis] += (value - object.rotation[axis]) * target;
      };

      if (state.sliding) {
        ease(j.leftShoulder, 'x', 0.55);
        ease(j.rightShoulder, 'x', 0.55);
        ease(j.leftElbow, 'x', 0.25);
        ease(j.rightElbow, 'x', 0.25);
        ease(j.leftHip, 'x', 1.08);
        ease(j.rightHip, 'x', 1.24);
        ease(j.leftKnee, 'x', -0.35);
        ease(j.rightKnee, 'x', -0.16);
        ease(arms, 'y', 0.03);
        ease(arms, 'z', 0.02);
      } else if (state.vaulting) {
        ease(j.leftShoulder, 'x', 1.4);
        ease(j.leftElbow, 'x', 0.2);
        ease(j.rightShoulder, 'x', 0.9);
        ease(j.rightElbow, 'x', 0.55);
        ease(j.leftHip, 'x', 0.75);
        ease(j.rightHip, 'x', 0.75);
        ease(j.leftKnee, 'x', -0.9);
        ease(j.rightKnee, 'x', -0.9);
      } else {
        const armSwing = swing * amp;
        ease(j.leftShoulder, 'x', 1.32 + armSwing * 0.55);
        ease(j.rightShoulder, 'x', 1.32 - armSwing * 0.55);
        ease(j.leftShoulder, 'z', -0.16 - (moving ? side * 0.04 : 0));
        ease(j.rightShoulder, 'z', 0.16 + (moving ? side * 0.04 : 0));
        ease(j.leftElbow, 'x', 0.38 + (moving ? Math.max(0, swing) * 0.12 : 0));
        ease(j.rightElbow, 'x', 0.38 + (moving ? Math.max(0, -swing) * 0.12 : 0));
        ease(j.leftHip, 'x', moving ? swing * amp * 0.9 : 0);
        ease(j.rightHip, 'x', moving ? -swing * amp * 0.9 : 0);
        ease(j.leftKnee, 'x', moving ? Math.max(0, -swing) * amp * 1.4 : 0);
        ease(j.rightKnee, 'x', moving ? Math.max(0, swing) * amp * 1.4 : 0);
        ease(arms, 'y', moving ? 0.02 + Math.abs(swing) * 0.012 : 0.02);
        ease(arms, 'z', moving ? side * 0.012 : 0);
      }
    },
  };
}

/**
 * @param {any} game
 */
export function createMentorCharacter(game) {
  const { THREE } = game;
  const mats = materials(game);
  const root = new THREE.Group();
  root.name = 'mentor-character';
  root.visible = false;

  const torso = new THREE.Mesh(
    geometry(THREE, 'mentor-torso', () => new THREE.CylinderGeometry(0.16, 0.14, 0.52, 10)),
    mats.mentorJacket,
  );
  torso.position.y = 1.18;
  const head = new THREE.Mesh(
    geometry(THREE, 'mentor-head', () => new THREE.SphereGeometry(0.11, 12, 10)),
    mats.skin,
  );
  head.position.y = 1.56;
  const hair = new THREE.Mesh(
    geometry(THREE, 'mentor-hair', () => new THREE.SphereGeometry(0.12, 12, 8)),
    mats.mentorDark,
  );
  hair.position.set(0, 1.58, 0.02);
  const pack = new THREE.Mesh(
    geometry(THREE, 'mentor-pack', () => new THREE.BoxGeometry(0.24, 0.3, 0.1)),
    mats.mentorDark,
  );
  pack.position.set(0, 1.22, 0.15);

  const leftShoulder = createLimb(THREE, 0.045, 0.24, mats.mentorJacket);
  leftShoulder.position.set(-0.21, 1.4, 0);
  const leftElbow = createLimb(THREE, 0.038, 0.22, mats.skin);
  leftElbow.position.y = -0.26;
  leftShoulder.add(leftElbow);
  const rightShoulder = createLimb(THREE, 0.045, 0.24, mats.mentorJacket);
  rightShoulder.position.set(0.21, 1.4, 0);
  const rightElbow = createLimb(THREE, 0.038, 0.22, mats.skin);
  rightElbow.position.y = -0.26;
  rightShoulder.add(rightElbow);

  const leftHip = createLimb(THREE, 0.07, 0.4, mats.mentorDark);
  leftHip.position.set(-0.1, 0.92, 0);
  const leftKnee = createLimb(THREE, 0.055, 0.4, mats.mentorDark);
  leftKnee.position.y = -0.42;
  leftHip.add(leftKnee);
  const rightHip = createLimb(THREE, 0.07, 0.4, mats.mentorDark);
  rightHip.position.set(0.1, 0.92, 0);
  const rightKnee = createLimb(THREE, 0.055, 0.4, mats.mentorDark);
  rightKnee.position.y = -0.42;
  rightHip.add(rightKnee);
  const leftShoe = new THREE.Mesh(
    geometry(THREE, 'shoe:mentor', () => new THREE.BoxGeometry(0.1, 0.08, 0.2)),
    mats.shoe,
  );
  leftShoe.position.set(0, -0.39, -0.05);
  leftKnee.add(leftShoe);
  const rightShoe = new THREE.Mesh(
    geometry(THREE, 'shoe:mentor', () => new THREE.BoxGeometry(0.1, 0.08, 0.2)),
    mats.shoe,
  );
  rightShoe.position.set(0, -0.39, -0.05);
  rightKnee.add(rightShoe);

  root.add(torso, head, hair, pack, leftShoulder, rightShoulder, leftHip, rightHip);
  markRigObject(root);

  const start = new THREE.Vector3(1.5, 0, 7.1);
  root.scale.set(0.94, 0.94, 0.94);
  root.position.copy(start);
  const character = {
    root,
    active: false,
    age: 0,
    start,
    begin() {
      this.active = true;
      this.age = 0;
      root.visible = true;
      root.position.copy(start);
    },
    hide() {
      this.active = false;
      root.visible = false;
    },
    update(dt, playerZ) {
      if (!this.active) return;
      this.age += dt;
      const runTime = this.age;
      root.position.z = start.z - Math.min(0.55, this.age * 0.3);
      root.position.y = Math.abs(Math.sin(runTime * 8)) * 0.025;
      const cycle = runTime * 8;
      const swing = Math.sin(cycle) * 0.45;
      const target = 1 - Math.exp(-10 * Math.min(dt, 0.05));
      const ease = (object, value) => {
        object.rotation.x += (value - object.rotation.x) * target;
      };
      ease(leftShoulder, -swing);
      ease(rightShoulder, swing);
      ease(leftHip, swing);
      ease(rightHip, -swing);
      ease(leftKnee, Math.max(0, -swing) * 0.8);
      ease(rightKnee, Math.max(0, swing) * 0.8);
      if (this.age > 7 || (playerZ != null && playerZ < root.position.z - 1)) {
        this.hide();
      }
    },
  };
  return character;
}

