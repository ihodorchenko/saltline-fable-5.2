// @ts-check
// Step 1 capsule controller for the GLASSLINE sandbox. It deliberately uses
// the engine's AABB capsule mover so the playground exercises the same physics
// contract the real player will use.

/**
 * @typedef {import('../../../types/engine').GameContext} GameContext
 * @typedef {{update: (dt: number) => void, getState: () => object, dispose: () => void}} PlayerController
 */

const EYE = 1.65;
const RADIUS = 0.35;
const HEIGHT = 1.8;
const GRAVITY = 18;
const RUN = 5.4;
const SPRINT = 7.2;
const ACCEL = 32;
const AIR_ACCEL = 8;
const JUMP = 6.2;
const MAX_DT = 0.05;
const SLIDE_HEIGHT = 1.15;
const SLIDE_EYE = 0.82;
const CROUCH_EYE = 1.02;
const BASE_FOV = 74;

import {
  COYOTE_TIME,
  coyoteActive,
  isWalkableGround,
  ledgeInfo,
} from './queries.js';
import {
  SLIDE_MAX_TIME,
  SLIDE_MIN_SPEED,
  canStartSlide,
  canStand,
  slideEntrySpeed,
  slideSpeed,
} from './slide.js';
import { VAULT_DURATION, VAULT_MAX_DISTANCE, canVault } from './vault.js';

/**
 * @param {GameContext} game
 * @returns {PlayerController}
 */
export function createPlayerController(game) {
  const { THREE } = game;
  const physics = game.physics;
  const canvas = game.renderer && game.renderer.domElement;
  const pos = new THREE.Vector3(0, 0.05, 4);
  const vel = new THREE.Vector3();
  const keys = new Set();
  const state = {
    yaw: 0,
    pitch: -0.04,
    onGround: false,
    sprinting: false,
    speed: 0,
    locked: false,
    jumps: 0,
    landDip: 0,
    airTime: 0,
    coyote: 0,
    walkable: true,
    ledge: null,
    sliding: false,
    crouched: false,
    slideTime: 0,
    slideBuffer: 0,
    bodyHeight: HEIGHT,
    eyeHeight: EYE,
    ceilingClearance: Infinity,
    vaulting: false,
    vaultTime: 0,
    vaults: 0,
    vaultFrom: new THREE.Vector3(),
    vaultTo: new THREE.Vector3(),
    vaultDir: new THREE.Vector3(),
    vaultArc: 0,
  };

  /** @type {any} */
  let hint = null;
  if (typeof document !== 'undefined') {
    hint = document.createElement('div');
    hint.id = 'glassline-hint';
    hint.textContent = 'Click to look  ·  WASD move  ·  Shift sprint  ·  Space jump';
    hint.style.cssText =
      'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:40;' +
      'padding:10px 14px;border:1px solid rgba(255,255,255,.5);border-radius:2px;' +
      'background:rgba(8,12,16,.72);color:#e9ecec;font:12px/1.4 "IBM Plex Mono",monospace;' +
      'letter-spacing:.06em;pointer-events:none;';
    document.body.appendChild(hint);
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function ceilingClearance() {
    if (!physics || !physics.raycast) return Infinity;
    const origin = new THREE.Vector3(pos.x, pos.y + SLIDE_HEIGHT, pos.z);
    const hit = physics.raycast(
      origin,
      new THREE.Vector3(0, 1, 0),
      HEIGHT - SLIDE_HEIGHT + 0.1,
    );
    return hit ? hit.dist : Infinity;
  }

  function tryStand() {
    const clearance = ceilingClearance();
    state.ceilingClearance = clearance;
    if (!canStand(clearance, HEIGHT, SLIDE_HEIGHT)) {
      state.crouched = true;
      state.bodyHeight = SLIDE_HEIGHT;
      return false;
    }
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    return true;
  }

  function startSlide() {
    if (state.sliding) return true;
    const speed = Math.hypot(vel.x, vel.z);
    if (!canStartSlide({ onGround: state.onGround, speed })) {
      state.crouched = true;
      state.bodyHeight = SLIDE_HEIGHT;
      return false;
    }
    const dirX = vel.x / speed;
    const dirZ = vel.z / speed;
    const entry = slideEntrySpeed(speed);
    vel.x = dirX * entry;
    vel.z = dirZ * entry;
    vel.y = 0;
    state.sliding = true;
    state.crouched = true;
    state.slideTime = 0;
    state.slideBuffer = 0;
    state.bodyHeight = SLIDE_HEIGHT;
    return true;
  }

  function endSlide() {
    state.sliding = false;
    state.slideTime = 0;
    tryStand();
  }

  function forwardVector() {
    return new THREE.Vector3(
      -Math.sin(state.yaw),
      0,
      -Math.cos(state.yaw),
    );
  }

  function findVault() {
    if (!physics || !physics.raycast) return null;
    const dir = forwardVector();
    const origin = new THREE.Vector3(pos.x, pos.y + 0.55, pos.z);
    const wall = physics.raycast(origin, dir, VAULT_MAX_DISTANCE);
    if (!wall) return null;
    const topOrigin = new THREE.Vector3(
      wall.point.x,
      wall.point.y + 2,
      wall.point.z,
    );
    const top = physics.raycast(
      topOrigin,
      new THREE.Vector3(0, -1, 0),
      3,
    );
    if (!top) return null;
    const height = top.point.y - pos.y;
    const distance = Math.hypot(
      wall.point.x - pos.x,
      wall.point.z - pos.z,
    );
    if (!canVault({ onGround: state.onGround, speed: Math.hypot(vel.x, vel.z), height, distance })) {
      return null;
    }
    return { dir, height, distance };
  }

  function startVault(obstacle = null) {
    if (state.vaulting || state.sliding) return false;
    const found = obstacle || findVault();
    if (!found) return false;
    state.vaultFrom.copy(pos);
    state.vaultTo
      .copy(pos)
      .addScaledVector(found.dir, found.distance + 1.0);
    state.vaultDir.copy(found.dir);
    state.vaultArc = Math.max(0.45, found.height + 0.2);
    state.vaultTime = 0;
    state.vaulting = true;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    vel.set(0, 0, 0);
    state.vaults += 1;
    return true;
  }

  function tryVault() {
    return startVault();
  }

  function teleport(x, z, yaw = 0, speed = 0) {
    pos.set(x, 0.05, z);
    vel.set(-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed);
    state.yaw = yaw;
    state.vaulting = false;
    state.sliding = false;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    state.eyeHeight = EYE;
    state.onGround = true;
    state.speed = speed;
    state.sprinting = false;
    applyCamera(0.016);
    return true;
  }

  function onKeyDown(event) {
    if (
      event.code === 'Space' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown'
    ) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (
      (event.code === 'KeyC' ||
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight') &&
      !event.repeat
    ) {
      state.slideBuffer = 0.15;
      if (state.onGround && !startSlide()) {
        state.crouched = true;
        state.bodyHeight = SLIDE_HEIGHT;
      }
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      state.onGround &&
      !state.sliding &&
      tryVault()
    ) {
      return;
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      (state.onGround || coyoteActive(state.coyote))
    ) {
      if (state.sliding) endSlide();
      vel.y = JUMP;
      state.onGround = false;
      state.coyote = 0;
      state.jumps += 1;
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    if (
      !state.sliding &&
      (event.code === 'KeyC' ||
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight') &&
      !keys.has('KeyC') &&
      !keys.has('ControlLeft') &&
      !keys.has('ControlRight')
    ) {
      tryStand();
    }
  }

  function onMouseMove(event) {
    if (!state.locked) return;
    state.yaw -= (event.movementX || 0) * 0.0022;
    state.pitch -= (event.movementY || 0) * 0.0022;
    state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch));
  }

  function onClick() {
    if (state.locked || !canvas || !canvas.requestPointerLock) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    } catch {
      /* pointer lock is optional */
    }
  }

  function onLockChange() {
    state.locked = document.pointerLockElement === canvas;
    if (state.locked) setHint('WASD move  ·  Shift sprint  ·  Space jump  ·  Esc release');
    else setHint('Click to look  ·  WASD move  ·  Shift sprint  ·  Space jump');
  }

  function onBlur() {
    keys.clear();
    state.locked = false;
  }

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('mousemove', onMouseMove);
  addEventListener('blur', onBlur);
  if (canvas) canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLockChange);

  /**
   * @param {number} step
   */
  function applyCamera(step) {
    state.landDip *= Math.exp(-8 * step);
    const targetEye = state.sliding
      ? SLIDE_EYE
      : state.crouched
        ? CROUCH_EYE
        : EYE;
    state.eyeHeight +=
      (targetEye - state.eyeHeight) * (1 - Math.exp(-14 * step));
    const targetFov =
      BASE_FOV + (state.sliding ? 4 : 0) + (state.sprinting ? 2 : 0);
    if (game.camera && typeof game.camera.fov === 'number') {
      game.camera.fov +=
        (targetFov - game.camera.fov) * (1 - Math.exp(-8 * step));
      if (Math.abs(game.camera.fov - targetFov) > 0.01) {
        game.camera.updateProjectionMatrix();
      }
    }
    game.camera.position.set(
      pos.x,
      pos.y + state.eyeHeight - state.landDip,
      pos.z,
    );
    game.camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  }

  /**
   * @param {number} dt
   */
  function update(dt) {
    const step = Math.min(Math.max(dt || 0, 0), MAX_DT);
    if (state.vaulting) {
      state.vaultTime += step;
      const t = Math.min(1, state.vaultTime / VAULT_DURATION);
      pos.lerpVectors(state.vaultFrom, state.vaultTo, t);
      pos.y += Math.sin(Math.PI * t) * state.vaultArc;
      if (t >= 1) {
        state.vaulting = false;
        state.onGround = false;
        vel.copy(state.vaultDir).multiplyScalar(RUN);
      }
      state.speed = Math.hypot(vel.x, vel.z);
      state.sprinting = false;
      applyCamera(step);
      return state;
    }
    const forwardInput =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const rightInput =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const length = Math.hypot(forwardInput, rightInput);
    const nx = length > 1 ? rightInput / length : rightInput;
    const nz = length > 1 ? forwardInput / length : forwardInput;
    const forwardX = -Math.sin(state.yaw);
    const forwardZ = -Math.cos(state.yaw);
    const rightX = Math.cos(state.yaw);
    const rightZ = -Math.sin(state.yaw);
    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    state.slideBuffer = Math.max(0, state.slideBuffer - step);

    if (!state.sliding && state.slideBuffer > 0) {
      const bufferedSpeed = Math.hypot(vel.x, vel.z);
      if (
        state.onGround &&
        canStartSlide({ onGround: true, speed: bufferedSpeed })
      ) {
        startSlide();
      }
    }

    if (state.sliding) {
      state.slideTime += step;
      const currentSpeed = Math.hypot(vel.x, vel.z);
      const nextSpeed = slideSpeed(currentSpeed, step);
      if (currentSpeed > 0.001) {
        const scale = nextSpeed / currentSpeed;
        vel.x *= scale;
        vel.z *= scale;
      }
      if (
        state.slideTime >= SLIDE_MAX_TIME ||
        nextSpeed < SLIDE_MIN_SPEED
      ) {
        endSlide();
      }
    } else {
      const maxSpeed = sprinting ? SPRINT : RUN;
      const wantX = (forwardX * nz + rightX * nx) * maxSpeed;
      const wantZ = (forwardZ * nz + rightZ * nx) * maxSpeed;
      const rate = state.onGround ? ACCEL : AIR_ACCEL;
      const blend = 1 - Math.exp(-rate * step);
      vel.x += (wantX - vel.x) * blend;
      vel.z += (wantZ - vel.z) * blend;
    }
    vel.y -= GRAVITY * step;

    const fallSpeed = vel.y;
    const result = physics.moveCapsule(
      pos,
      vel,
      step,
      RADIUS,
      state.bodyHeight,
      true,
    );
    if (result.onGround) {
      if (!state.onGround && fallSpeed < -2) {
        state.landDip = Math.min(0.12, -fallSpeed * 0.012);
      }
      if (vel.y < 0) vel.y = 0;
      state.onGround = true;
    } else {
      state.onGround = false;
    }
    if (result.hitCeil && vel.y > 0) vel.y = 0;

    if (state.onGround) {
      state.airTime = 0;
      state.coyote = COYOTE_TIME;
    } else {
      state.airTime += step;
      state.coyote = Math.max(0, state.coyote - step);
    }

    // Query the surface under the capsule and the wall/ledge in front. These
    // probes are state/debug inputs for Step 2's mantle and slope work; they do
    // not modify movement yet.
    const downOrigin = new THREE.Vector3(pos.x, pos.y + 0.5, pos.z);
    const downHit = physics.raycast(
      downOrigin,
      new THREE.Vector3(0, -1, 0),
      2.2,
    );
    state.walkable = downHit ? isWalkableGround(downHit.normal) : true;
    const eye = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
    const forward = new THREE.Vector3(
      -Math.sin(state.yaw),
      0,
      -Math.cos(state.yaw),
    );
    const wallHit = physics.raycast(eye, forward, 0.9);
    state.ledge = null;
    if (wallHit) {
      const topOrigin = new THREE.Vector3(
        wallHit.point.x,
        wallHit.point.y + 2,
        wallHit.point.z,
      );
      const topHit = physics.raycast(
        topOrigin,
        new THREE.Vector3(0, -1, 0),
        3,
      );
      state.ledge = topHit ? ledgeInfo(topHit, pos.y) : null;
    }

    state.sprinting = sprinting && length > 0 && !state.sliding;
    state.speed = Math.hypot(vel.x, vel.z);
    applyCamera(step);
    return state;
  }

  function getState() {
    return {
      ...state,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      vel: { x: vel.x, y: vel.y, z: vel.z },
    };
  }

  function dispose() {
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('mousemove', onMouseMove);
    removeEventListener('blur', onBlur);
    if (canvas) canvas.removeEventListener('click', onClick);
    document.removeEventListener('pointerlockchange', onLockChange);
    hint?.remove();
  }

  // Apply the initial camera pose once; the showcase must not return `cam`,
  // otherwise boot would override the controller every frame.
  game.camera.position.set(pos.x, pos.y + EYE, pos.z);
  game.camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  return { update, getState, dispose, teleport, tryVault };
}
