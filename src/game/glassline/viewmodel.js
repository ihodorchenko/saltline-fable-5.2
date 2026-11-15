// @ts-check
// First-person view model: the runner's forearms and hands.
//
// The reference shows hands at the bottom of the screen in essentially every
// frame; that continuous "you are a body" cue is one of the strongest reads a
// first-person parkour game has. The engine already owns a dedicated view-model
// pass (a layer-1 camera at a narrower FOV with the depth range compressed), so
// the arms live on layer 1 and are drawn after the world without z-fighting.
//
// Everything here is procedural: capsules and spheres, the courier's red wrist
// tracker, dark sleeves and skin. No external models.

const LAYER_VIEWMODEL = 1;

/**
 * A capsule stretched between two points in the local space of its parent.
 * @param {any} THREE
 * @param {[number, number, number]} from
 * @param {[number, number, number]} to
 * @param {number} radius
 * @param {any} material
 */
function limb(THREE, from, to, radius, material) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 6, 10),
    material,
  );
  // CapsuleGeometry points along +Y; rotate it onto the a→b axis and centre it.
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.position.copy(a).add(direction.multiplyScalar(length * 0.5));
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * @param {any} game
 */
export function createViewmodel(game) {
  const { THREE } = game;
  const viewCamera = game.render?.viewCamera;
  const scene = game.scene;
  if (!viewCamera || !scene) {
    return {
      root: null,
      setVisible() {},
      update() {},
      dispose() {},
    };
  }

  // A view model sits in the body's shadow, so it carries a little emissive lift
  // to stay readable against white roofs without looking unlit.
  const materials = {
    suit: new THREE.MeshStandardMaterial({
      color: 0x36424d,
      emissive: 0x222d36,
      emissiveIntensity: 1.0,
      roughness: 0.66,
    }),
    cuff: new THREE.MeshStandardMaterial({
      color: 0xe8ece8,
      emissive: 0x2a2e31,
      emissiveIntensity: 0.6,
      roughness: 0.52,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: 0xe0b083,
      emissive: 0x6b5236,
      emissiveIntensity: 0.95,
      roughness: 0.6,
    }),
    shoe: new THREE.MeshStandardMaterial({
      color: 0xdfe8e6,
      emissive: 0x2c3134,
      emissiveIntensity: 0.5,
      roughness: 0.6,
    }),
    tracker: new THREE.MeshStandardMaterial({
      color: 0xd23a39,
      emissive: 0x6d1012,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
  };

  const root = new THREE.Group();
  root.name = 'courier-viewmodel';

  /**
   * One arm in camera space: +X right, +Y up, -Z forward. The shoulder sits just
   * below the frame; the hand rests in the lower third of the view.
   * @param {number} side -1 left, +1 right
   */
  function makeArm(side) {
    const arm = new THREE.Group();
    // Shoulder below and behind the frame; the forearm reaches forward-inward so
    // the hands rest in the lower third of the view, like the reference.
    const shoulder = [side * 0.38, -0.38, -0.12];
    const elbow = [side * 0.42, -0.42, -0.4];
    const wrist = [side * 0.3, -0.34, -0.8];
    arm.position.set(...shoulder);
    // Rebase the joint positions onto the shoulder pivot.
    const local = (point) => point.map((value, index) => value - shoulder[index]);
    arm.add(
      limb(THREE, [0, 0, 0], local(elbow), 0.038, materials.suit),
      limb(THREE, local(elbow), local(wrist), 0.026, materials.skin),
    );
    // Sleeve cuff and the red wrist tracker.
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 12), materials.cuff);
    cuff.position.set(...local(elbow)).lerp(new THREE.Vector3(...local(wrist)), 0.12);
    cuff.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(...local(wrist)).sub(new THREE.Vector3(...local(elbow))).normalize(),
    );
    const tracker = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.022, 12), materials.tracker);
    tracker.position.set(...local(elbow)).lerp(new THREE.Vector3(...local(wrist)), 0.66);
    tracker.quaternion.copy(cuff.quaternion);
    // Hand: a squashed sphere past the wrist.
    // Palm: a flattened box, elongated along the forearm, plus a thumb. A sphere
    // here reads as a mitten, which is the one shape that makes a view model look
    // like a programmer placeholder.
    const forearmDir = new THREE.Vector3(...local(wrist))
      .sub(new THREE.Vector3(...local(elbow)))
      .normalize();
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.128, 0.05), materials.skin);
    hand.position.set(...local(wrist)).addScaledVector(forearmDir, 0.052);
    hand.quaternion.copy(cuff.quaternion);
    hand.rotateY(side * 0.22);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.05, 4, 8), materials.skin);
    thumb.position
      .set(...local(wrist))
      .addScaledVector(forearmDir, 0.03)
      .add(new THREE.Vector3(-side * 0.045, -0.012, 0));
    thumb.quaternion.copy(cuff.quaternion);
    thumb.rotateZ(side * 0.55);
    arm.add(cuff, tracker, hand, thumb);
    root.add(arm);
    return arm;
  }

  const left = makeArm(-1);
  const right = makeArm(1);

  /**
   * One leg hanging from the camera. Standing, it sits below the frame (looking
   * down shows your feet, which is correct); a slide swings it forward into view.
   * @param {number} side -1 left, +1 right
   */
  function makeLeg(side) {
    const leg = new THREE.Group();
    const hip = [side * 0.13, -0.34, -0.04];
    leg.position.set(...hip);
    const knee = [0, -0.44, -0.02];
    const ankle = [0, -0.86, -0.03];
    leg.add(
      limb(THREE, [0, 0, 0], knee, 0.062, materials.suit),
      limb(THREE, knee, ankle, 0.048, materials.suit),
    );
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.27), materials.shoe);
    shoe.position.set(0, ankle[1] - 0.03, ankle[2] - 0.09);
    leg.add(shoe);
    root.add(leg);
    return leg;
  }

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Layer 1 only: the engine's view-model pass draws this with the narrow-FOV
  // view camera after the world, so it never intersects the scene.
  root.traverse((object) => {
    object.layers.set(LAYER_VIEWMODEL);
    if (object.isMesh) object.frustumCulled = false;
  });
  root.visible = false;

  // The view camera is not in the scene by default; attaching it lets the arms
  // inherit the camera transform every frame (the renderer copies the world
  // camera matrix into it before rendering).
  if (!viewCamera.parent) scene.add(viewCamera);
  viewCamera.add(root);

  let phase = 0;
  let lean = 0;
  let lift = 0;
  let slideLegs = 0;
  const target = { lean: 0, lift: 0 };

  /**
   * @param {number} dt
   * @param {any} state controller state
   * @param {number} time seconds
   */
  function update(dt, state, time) {
    if (!root.visible) return;
    const speed = Math.max(0, state?.speed || 0);
    const moving = speed > 0.6;
    const sprint = !!state?.sprinting;
    phase += dt * (moving ? 6.5 + Math.min(7, speed) * 0.55 : 1.4);
    const swing = Math.sin(phase);
    const bounce = Math.sin(phase * 2);
    const sway = Math.cos(phase * 0.5) * 0.5;
    const speedK = Math.min(1, speed / 7);
    const bob = (moving ? 1 : 0.25) * speedK;

    // Pose targets: lean the arms back when sliding, reach up on a wallrun,
    // float them when airborne.
    const sliding = !!state?.sliding;
    const wallrun = !!state?.wallrunning || !!state?.wallclimbing;
    const airborne = state ? state.onGround === false : false;
    target.lean = sliding ? -0.45 : wallrun ? 0.12 : 0;
    target.lift = sliding ? 0.06 : airborne ? 0.02 : 0;
    const ease = 1 - Math.exp(-9 * Math.min(dt, 0.05));
    lean += (target.lean - lean) * ease;
    lift += (target.lift - lift) * ease;

    // Sliding kicks the legs forward into the lower frame; running keeps them
    // under the camera (visible when the player looks down) with a small stride.
    const legTarget = sliding ? 1 : state?.rolling ? 0.7 : 0;
    slideLegs += (legTarget - slideLegs) * (1 - Math.exp(-8 * Math.min(dt, 0.05)));
    const stride = (moving ? 0.34 : 0.04) * Math.sin(phase);
    leftLeg.rotation.set(1.22 * slideLegs + stride * (1 - slideLegs), 0, 0.04);
    rightLeg.rotation.set(1.22 * slideLegs - stride * (1 - slideLegs), 0, -0.04);
    const tuck = state?.rolling ? 0.55 : 0;
    leftLeg.rotation.x += tuck * 0.6;
    rightLeg.rotation.x += tuck * 0.6;

    root.position.set(
      bounce * 0.004 * bob + sway * 0.004 * bob,
      Math.sin(time * 1.7) * 0.003 + lift + bounce * 0.004 * bob,
      0,
    );
    root.rotation.set(lean * 0.35, sway * 0.02 * bob, (sliding ? 0.12 : 0) + sway * 0.01 * bob);

    // The two arms swing out of phase, a little wider when sprinting.
    const amp = (sprint ? 0.1 : 0.065) * (moving ? 1 : 0.15);
    left.rotation.set(lean + swing * amp, sway * 0.03, -0.02 + sway * 0.02);
    right.rotation.set(lean - swing * amp, -sway * 0.03, 0.02 - sway * 0.02);
    if (wallrun) {
      right.rotation.x = lean + 0.34 + swing * 0.02;
      right.rotation.z = 0.16;
      left.rotation.x = lean - 0.18;
    }
    if (sliding) {
      left.rotation.x = lean + swing * 0.02;
      right.rotation.x = lean - swing * 0.02;
    }
  }

  return {
    root,
    setVisible(visible) {
      root.visible = !!visible;
    },
    update,
    dispose() {
      viewCamera.remove(root);
      root.traverse((object) => {
        if (object.isMesh) object.geometry.dispose();
      });
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
