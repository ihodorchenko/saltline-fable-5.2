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

import {
  COYOTE_TIME,
  coyoteActive,
  isWalkableGround,
  ledgeInfo,
} from './queries.js';

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
      event.code === 'Space' &&
      !event.repeat &&
      (state.onGround || coyoteActive(state.coyote))
    ) {
      vel.y = JUMP;
      state.onGround = false;
      state.coyote = 0;
      state.jumps += 1;
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
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
   * @param {number} dt
   */
  function update(dt) {
    const step = Math.min(Math.max(dt || 0, 0), MAX_DT);
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
    const maxSpeed = sprinting ? SPRINT : RUN;
    const wantX = (forwardX * nz + rightX * nx) * maxSpeed;
    const wantZ = (forwardZ * nz + rightZ * nx) * maxSpeed;
    const rate = state.onGround ? ACCEL : AIR_ACCEL;
    const blend = 1 - Math.exp(-rate * step);
    vel.x += (wantX - vel.x) * blend;
    vel.z += (wantZ - vel.z) * blend;
    vel.y -= GRAVITY * step;

    const fallSpeed = vel.y;
    const result = physics.moveCapsule(pos, vel, step, RADIUS, HEIGHT, true);
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

    state.landDip *= Math.exp(-8 * step);
    state.sprinting = sprinting && length > 0;
    state.speed = Math.hypot(vel.x, vel.z);
    game.camera.position.set(pos.x, pos.y + EYE - state.landDip, pos.z);
    game.camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
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
  return { update, getState, dispose };
}
