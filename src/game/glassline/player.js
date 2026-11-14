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
import { MANTLE_DURATION, canMantle } from './mantle.js';
import {
  WALLRUN_MAX_TIME,
  WALLRUN_ROLL,
  canWallrun,
} from './wallrun.js';
import {
  WALLCLIMB_MAX_TIME,
  WALLCLIMB_SPEED,
  canWallclimb,
} from './wallclimb.js';
import { ROLL_DURATION, ROLL_RETENTION, canRoll } from './roll.js';
import {
  BALANCE_LATERAL_SPEED,
  BALANCE_SPEED,
  balanceRoll,
  isBalanceSurface,
} from './balance.js';

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
    mantling: false,
    mantleTime: 0,
    mantles: 0,
    mantleFrom: new THREE.Vector3(),
    mantleTo: new THREE.Vector3(),
    wallrunning: false,
    wallTime: 0,
    wallruns: 0,
    wallSpeed: 0,
    wallNormal: new THREE.Vector3(),
    wallDir: new THREE.Vector3(),
    wallSide: null,
    roll: 0,
    rollTarget: 0,
    wallclimbing: false,
    wallclimbTime: 0,
    wallclimbs: 0,
    climbNormal: new THREE.Vector3(),
    rolling: false,
    rollTime: 0,
    rollSpeed: 0,
    rolls: 0,
    rollDir: new THREE.Vector3(),
    balancing: false,
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
    emit('slide');
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
    emit('vault');
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

  function findMantle() {
    if (!physics || !physics.raycast) return null;
    const dir = forwardVector();
    const origin = new THREE.Vector3(pos.x, pos.y + 0.55, pos.z);
    const wall = physics.raycast(origin, dir, 1.45);
    if (!wall) return null;
    const top = physics.raycast(
      new THREE.Vector3(wall.point.x, wall.point.y + 2, wall.point.z),
      new THREE.Vector3(0, -1, 0),
      3,
    );
    if (!top) return null;
    const height = top.point.y - pos.y;
    const distance = Math.hypot(
      wall.point.x - pos.x,
      wall.point.z - pos.z,
    );
    if (!canMantle({ height, distance, onGround: state.onGround })) {
      return null;
    }
    return { dir, height, distance, topY: top.point.y };
  }

  function startMantle(obstacle = null) {
    if (state.vaulting || state.mantling || state.sliding) return false;
    const found = obstacle || findMantle();
    if (!found) return false;
    state.mantleFrom.copy(pos);
    state.mantleTo
      .copy(pos)
      .addScaledVector(found.dir, found.distance + 0.45);
    state.mantleTo.y = found.topY + 0.02;
    emit('mantle');
    state.mantleTime = 0;
    state.mantling = true;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    vel.set(0, 0, 0);
    state.mantles += 1;
    return true;
  }

  function tryMantle() {
    return startMantle();
  }

  function findWall() {
    if (!physics || !physics.raycast) return null;
    const origin = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z);
    const right = new THREE.Vector3(
      Math.cos(state.yaw),
      0,
      -Math.sin(state.yaw),
    );
    const speed = Math.hypot(vel.x, vel.z);
    for (const side of ['right', 'left']) {
      const dir = side === 'right' ? right : right.clone().negate();
      const hit = physics.raycast(origin, dir, 0.8);
      if (!hit || Math.abs(hit.normal.y) >= 0.5) continue;
      if (
        !canWallrun({
          airborne: !state.onGround,
          speed,
          wallDistance: hit.dist,
          normalY: hit.normal.y,
        })
      ) {
        continue;
      }
      return { side, hit, speed };
    }
    return null;
  }

  function startWallrun(wall = null) {
    if (
      state.wallrunning ||
      state.vaulting ||
      state.mantling ||
      state.sliding
    ) {
      return false;
    }
    const found = wall || findWall();
    if (!found) return false;
    const forward = forwardVector();
    state.wallNormal.copy(found.hit.normal);
    const projection = forward
      .clone()
      .addScaledVector(
        state.wallNormal,
        -forward.dot(state.wallNormal),
      )
      .normalize();
    if (projection.lengthSq() < 0.1) return false;
    state.wallDir.copy(projection);
    state.wallSpeed = Math.max(5.4, found.speed);
    state.wallSide = found.side;
    state.wallTime = 0;
    state.wallrunning = true;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    state.onGround = false;
    state.rollTarget =
      found.side === 'right' ? -WALLRUN_ROLL : WALLRUN_ROLL;
    emit('wallrun');
    vel.set(0, 0, 0);
    state.wallruns += 1;
    return true;
  }

  function tryWallrun() {
    return startWallrun();
  }

  function endWallrun(jump = false) {
    if (!state.wallrunning) return;
    state.wallrunning = false;
    state.rollTarget = 0;
    state.onGround = false;
    vel.copy(state.wallDir).multiplyScalar(state.wallSpeed * 0.9);
    if (jump) {
      vel.addScaledVector(state.wallNormal, 3.8);
      vel.y = JUMP;
      emit('jump', { wall: true });
    } else {
      vel.y = 0;
    }
  }

  function startRoll(speed = Math.hypot(vel.x, vel.z)) {
    if (
      state.rolling ||
      state.wallclimbing ||
      state.wallrunning ||
      state.vaulting ||
      state.mantling
    ) {
      return false;
    }
    const current = Math.max(4, speed);
    if (current <= 0.001) return false;
    state.rollDir.set(vel.x, 0, vel.z);
    if (state.rollDir.lengthSq() < 0.001) {
      state.rollDir.copy(forwardVector());
    }
    state.rollDir.normalize();
    state.rollTime = 0;
    state.rollSpeed = current;
    state.rolling = true;
    state.crouched = true;
    emit('roll');
    state.bodyHeight = SLIDE_HEIGHT;
    state.onGround = true;
    vel.set(0, 0, 0);
    state.rolls += 1;
    return true;
  }

  function tryRoll() {
    return startRoll();
  }

  function endRoll() {
    state.rolling = false;
    state.rollTime = 0;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    vel.copy(state.rollDir).multiplyScalar(state.rollSpeed * ROLL_RETENTION);
  }

  function findClimbWall() {
    if (!physics || !physics.raycast) return null;
    const dir = forwardVector();
    const origin = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z);
    const wall = physics.raycast(origin, dir, 0.85);
    if (!wall || Math.abs(wall.normal.y) >= 0.5) return null;
    const top = physics.raycast(
      new THREE.Vector3(wall.point.x, wall.point.y + 6, wall.point.z),
      new THREE.Vector3(0, -1, 0),
      10,
    );
    const height = top ? top.point.y - pos.y : Infinity;
    const distance = Math.hypot(
      wall.point.x - pos.x,
      wall.point.z - pos.z,
    );
    if (!canWallclimb({ distance, normalY: wall.normal.y, height })) {
      return null;
    }
    return { wall, distance, height };
  }

  function startWallclimb(wall = null) {
    if (
      state.wallclimbing ||
      state.wallrunning ||
      state.vaulting ||
      state.mantling ||
      state.sliding
    ) {
      return false;
    }
    const found = wall || findClimbWall();
    if (!found) return false;
    state.climbNormal.copy(found.wall.normal);
    state.wallclimbTime = 0;
    state.wallclimbing = true;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    state.onGround = false;
    state.rollTarget = 0.08;
    emit('wallclimb');
    vel.set(0, 0, 0);
    state.wallclimbs += 1;
    return true;
  }

  function tryWallclimb() {
    return startWallclimb();
  }

  function endWallclimb(jump = false) {
    if (!state.wallclimbing) return;
    state.wallclimbing = false;
    state.rollTarget = 0;
    vel.set(0, 0, 0);
    if (jump) {
      vel.addScaledVector(state.climbNormal, 3.5);
      vel.y = JUMP;
      emit('jump', { wall: true });
    }
  }

  function teleport(x, z, yaw = 0, speed = 0, airborne = false, y = 0.05) {
    pos.set(x, y, z);
    vel.set(-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed);
    state.yaw = yaw;
    state.vaulting = false;
    state.mantling = false;
    state.wallrunning = false;
    state.wallclimbing = false;
    state.rolling = false;
    state.balancing = false;
    state.roll = 0;
    state.rollTarget = 0;
    state.sliding = false;
    state.crouched = false;
    state.bodyHeight = HEIGHT;
    state.eyeHeight = EYE;
    state.onGround = !airborne;
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
      state.rolling
    ) {
      endRoll();
      vel.y = JUMP;
      state.onGround = false;
      emit('jump', { roll: true });
      return;
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      state.wallrunning
    ) {
      endWallrun(true);
      return;
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
      state.onGround &&
      !state.sliding &&
      tryMantle()
    ) {
      return;
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      state.wallclimbing
    ) {
      endWallclimb(true);
      return;
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      state.onGround &&
      !state.sliding &&
      tryWallclimb()
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
      emit('jump', { air: true });
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

  let stepAccum = 0;

  function emit(name, payload = {}) {
    try {
      game.events?.emit(`glassline:${name}`, payload);
    } catch {
      /* audio/events are optional */
    }
  }

  let sensitivity = 0.0022;

  function setSensitivity(value) {
    sensitivity = Math.max(0.0005, Math.min(0.006, Number(value) || 0.0022));
    return sensitivity;
  }

  function onMouseMove(event) {
    if (!state.locked) return;
    state.yaw -= (event.movementX || 0) * sensitivity;
    state.pitch -= (event.movementY || 0) * sensitivity;
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
    const targetEye = state.sliding || state.rolling
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
    state.roll += (state.rollTarget - state.roll) * (1 - Math.exp(-10 * step));
    game.camera.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
  }

  /**
   * @param {number} dt
   */
  function update(dt) {
    const step = Math.min(Math.max(dt || 0, 0), MAX_DT);
    if (state.rolling) {
      state.rollTime += step;
      pos.addScaledVector(state.rollDir, state.rollSpeed * step);
      state.rollSpeed = Math.max(0, state.rollSpeed - 2.5 * step);
      if (state.rollTime >= ROLL_DURATION) endRoll();
      state.speed = state.rollSpeed;
      state.sprinting = false;
      applyCamera(step);
      return state;
    }
    if (state.wallclimbing) {
      state.wallclimbTime += step;
      pos.y += WALLCLIMB_SPEED * step;
      if (state.wallclimbTime >= WALLCLIMB_MAX_TIME) {
        endWallclimb(false);
      }
      state.speed = 0;
      state.sprinting = false;
      applyCamera(step);
      return state;
    }
    if (state.wallrunning) {
      state.wallTime += step;
      pos.addScaledVector(state.wallDir, state.wallSpeed * step);
      pos.y -= 0.35 * step;
      if (state.wallTime >= WALLRUN_MAX_TIME) endWallrun(false);
      state.speed = state.wallSpeed;
      state.sprinting = false;
      applyCamera(step);
      return state;
    }
    if (state.mantling) {
      state.mantleTime += step;
      const t = Math.min(1, state.mantleTime / MANTLE_DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      pos.lerpVectors(state.mantleFrom, state.mantleTo, eased);
      pos.y += Math.sin(Math.PI * t) * 0.08;
      if (t >= 1) {
        state.mantling = false;
        state.onGround = true;
        vel.set(0, 0, 0);
      }
      state.speed = 0;
      state.sprinting = false;
      applyCamera(step);
      return state;
    }
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
    } else if (state.balancing) {
      const balanceForward = forwardInput < 0 ? -BALANCE_SPEED : BALANCE_SPEED;
      vel.x =
        forwardX * balanceForward +
        rightX * rightInput * BALANCE_LATERAL_SPEED;
      vel.z =
        forwardZ * balanceForward +
        rightZ * rightInput * BALANCE_LATERAL_SPEED;
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
    const prevX = pos.x;
    const prevZ = pos.z;
    const wantsCrouch =
      keys.has('KeyC') ||
      keys.has('ControlLeft') ||
      keys.has('ControlRight');
    const result = physics.moveCapsule(
      pos,
      vel,
      step,
      RADIUS,
      state.bodyHeight,
      true,
    );
    if (result.onGround) {
      const justLanded = !state.onGround;
      if (justLanded && fallSpeed < -2) {
        state.landDip = Math.min(0.12, -fallSpeed * 0.012);
      }
      if (justLanded) {
        emit('land', {
          impact: -fallSpeed,
          speed: Math.hypot(vel.x, vel.z),
        });
      }
      if (
        justLanded &&
        wantsCrouch &&
        canRoll({
          speed: Math.hypot(vel.x, vel.z),
          fallingSpeed: fallSpeed,
        })
      ) {
        startRoll();
      }
      if (vel.y < 0) vel.y = 0;
      state.onGround = true;
      if (
        !state.sliding &&
        !state.rolling &&
        !state.wallrunning &&
        !state.wallclimbing
      ) {
        stepAccum += Math.hypot(pos.x - prevX, pos.z - prevZ);
        if (stepAccum >= (sprinting ? 1.75 : 1.35)) {
          stepAccum = 0;
          emit('step');
        }
      }
    } else {
      state.onGround = false;
      stepAccum = 0;
    }
    if (result.hitCeil && vel.y > 0) vel.y = 0;

    if (state.onGround) {
      state.airTime = 0;
      state.coyote = COYOTE_TIME;
    } else {
      state.airTime += step;
      state.coyote = Math.max(0, state.coyote - step);
    }
    if (!state.onGround) {
      startWallrun();
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
    const onBeam =
      !!state.onGround &&
      !!downHit &&
      !!downHit.box &&
      isBalanceSurface(downHit.box.tag);
    state.balancing = onBeam;
    state.rollTarget = onBeam ? balanceRoll(rightInput) : 0;
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

    state.sprinting = sprinting && length > 0 && !state.sliding && !state.balancing;
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
  return {
    update,
    getState,
    dispose,
    teleport,
    tryVault,
    tryMantle,
    tryWallrun,
    tryWallclimb,
    tryRoll,
    setSensitivity,
  };
}
