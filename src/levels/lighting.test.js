import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHTING, SUN_DIRECTION, createLighting, snapToTexel } from './lighting.js';

const sunVector = () => new THREE.Vector3(...SUN_DIRECTION).normalize();

// The engine fits these bounds from the level volume at renderer start-up and
// bakes them into the soft-shadow shader, so the real values must survive.
const ENGINE_FRUSTUM = {
  left: -48.43,
  right: 48.43,
  top: 34.68,
  bottom: -34.68,
  near: 111.83,
  far: 249.8,
};

function makeGame({ withEngineSun = true, mapSize = 2048 } = {}) {
  const scene = new THREE.Scene();
  const render = { exposure: 1 };
  let sun = null;
  if (withEngineSun) {
    sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mapSize, mapSize);
    Object.assign(sun.shadow.camera, ENGINE_FRUSTUM);
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.copy(sunVector()).multiplyScalar(200);
    scene.add(sun, sun.target);
    render.sun = sun;
  }
  return { game: { THREE, scene, render, quality: { shadow: mapSize } }, scene, sun };
}

function directionOf(light) {
  const position = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
  const target = new THREE.Vector3().setFromMatrixPosition(light.target.matrixWorld);
  return position.sub(target).normalize();
}

describe('snapToTexel', () => {
  it('rounds to the nearest texel multiple', () => {
    expect(snapToTexel(1.04, 0.1)).toBeCloseTo(1.0);
    expect(snapToTexel(1.06, 0.1)).toBeCloseTo(1.1);
    expect(snapToTexel(-0.26, 0.1)).toBeCloseTo(-0.3);
  });

  it('is stable for sub-texel movement', () => {
    expect(snapToTexel(5.001, 0.05)).toBe(snapToTexel(5.004, 0.05));
  });

  it('passes through invalid input', () => {
    expect(snapToTexel(2, 0)).toBe(2);
    expect(snapToTexel(NaN, 0.1)).toBeNaN();
  });
});

describe('LIGHTING', () => {
  it('keeps the shadow frustum sensible', () => {
    expect(LIGHTING.shadow.far).toBeGreaterThan(LIGHTING.shadow.near);
    expect(LIGHTING.shadow.half).toBeGreaterThan(10);
  });
});

describe('SUN_DIRECTION', () => {
  it('points above the horizon and ahead along the route (-z)', () => {
    const [, y, z] = SUN_DIRECTION;
    expect(y).toBeGreaterThan(0);
    expect(z).toBeLessThan(0);
  });

  it('is a usable, non-zero vector', () => {
    expect(Math.hypot(...SUN_DIRECTION)).toBeGreaterThan(0.5);
  });
});

describe('createLighting', () => {
  it('follows the player without touching the engine shadow camera', () => {
    const { game, scene, sun } = makeGame();
    const rig = createLighting(game);
    rig.update({ x: 3, y: 1.7, z: -120 });
    scene.updateMatrixWorld(true);

    expect(sun.shadow.camera).toMatchObject(ENGINE_FRUSTUM);
    expect(directionOf(sun).angleTo(sunVector())).toBeLessThan(1e-6);
    const lightPosition = new THREE.Vector3().setFromMatrixPosition(sun.matrixWorld);
    const targetPosition = new THREE.Vector3().setFromMatrixPosition(sun.target.matrixWorld);
    expect(lightPosition.distanceTo(targetPosition)).toBeCloseTo(200, 4);
  });

  it('keeps the fill lights pointing the same way along the route', () => {
    const { game, scene, sun } = makeGame();
    const rig = createLighting(game);
    const fills = scene.children.filter((object) => object.isDirectionalLight && object !== sun);
    expect(fills).toHaveLength(2);

    rig.update({ x: 0, y: 1.7, z: 10 });
    scene.updateMatrixWorld(true);
    const start = fills.map(directionOf);

    rig.update({ x: 0, y: 1.7, z: -195 });
    scene.updateMatrixWorld(true);
    fills.forEach((light, index) => {
      expect(directionOf(light).dot(start[index])).toBeGreaterThan(0.9999);
    });
  });

  it('snaps the sun target to the shadow texel grid', () => {
    const { game, sun } = makeGame();
    const rig = createLighting(game);
    rig.update({ x: 0.137, y: 1.7, z: -42.31 });

    const right = new THREE.Vector3().crossVectors(sunVector(), new THREE.Vector3(0, 1, 0)).normalize();
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
    const steps = sun.target.position.dot(right) / texel;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
  });

  it('rebuilds the snapping grid after a shadow-map quality change', () => {
    const { game, sun } = makeGame({ mapSize: 2048 });
    const rig = createLighting(game);
    const right = new THREE.Vector3().crossVectors(sunVector(), new THREE.Vector3(0, 1, 0)).normalize();
    const snapped = () => sun.target.position.dot(right);

    rig.update({ x: 0.03, y: 0, z: 0 });
    const before = snapped();
    sun.shadow.mapSize.set(1024, 1024);
    rig.update({ x: 0.03, y: 0, z: 0 });

    expect(before).toBeCloseTo((sun.shadow.camera.right - sun.shadow.camera.left) / 2048, 6);
    expect(snapped()).toBeCloseTo(0, 6);
  });

  it('builds a private fallback light when the engine sun is missing', () => {
    const { game, scene } = makeGame({ withEngineSun: false });
    const rig = createLighting(game);
    rig.update({ x: 0, y: 0, z: 0 });
    scene.updateMatrixWorld(true);

    expect(scene.children).toContain(rig.key);
    expect(rig.key.shadow.camera.left).toBe(-LIGHTING.shadow.half);
    expect(rig.key.shadow.camera.near).toBe(LIGHTING.shadow.near);
    expect(directionOf(rig.key).angleTo(sunVector())).toBeLessThan(1e-6);
  });
});
