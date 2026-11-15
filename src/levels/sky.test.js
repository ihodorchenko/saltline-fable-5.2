import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHighKeySky } from './sky.js';

function makeGame() {
  const scene = new THREE.Scene();
  return { game: { THREE, scene }, scene };
}

describe('createHighKeySky', () => {
  it('builds the day sky dome with the cloud uniforms wired', () => {
    const { game } = makeGame();
    const sky = createHighKeySky(game, new THREE.Vector3(-0.52, 0.93, -0.42));

    expect(sky.mesh.name).toBe('glassline-high-key-sky');
    expect(sky.mesh.material.uniforms.uNoise.value).toBeTruthy();
    expect(sky.mesh.material.uniforms.uCloudCover.value).toBeGreaterThan(0);
    const keys = Object.keys(sky.mesh.material.uniforms);
    for (const key of ['uTop', 'uHorizon', 'uSunDir', 'uSunColor', 'uTime']) {
      expect(keys).toContain(key);
    }
    // The dome is a back-side sphere that follows the camera.
    expect(sky.mesh.material.side).toBe(THREE.BackSide);
    expect(sky.mesh.frustumCulled).toBe(false);
  });

  it('points the visible sun at the scene light direction', () => {
    const { game } = makeGame();
    const sunDirection = new THREE.Vector3(-0.52, 0.93, -0.42);
    const sky = createHighKeySky(game, sunDirection);
    const uniform = sky.mesh.material.uniforms.uSunDir.value;
    expect(uniform.distanceTo(sunDirection.clone().normalize())).toBeLessThan(1e-6);
    expect(uniform.length()).toBeCloseTo(1, 6);
  });

  it('animates the cloud drift through update()', () => {
    const { game } = makeGame();
    const sky = createHighKeySky(game);
    sky.update(12.5);
    expect(sky.mesh.material.uniforms.uTime.value).toBeCloseTo(12.5);
    // The mesh exposes the same hook so scene code can just call it.
    sky.mesh.userData.update(3);
    expect(sky.mesh.material.uniforms.uTime.value).toBeCloseTo(3);
    // Defensive: non-finite times must not poison the uniform.
    sky.update(undefined);
    expect(sky.mesh.material.uniforms.uTime.value).toBe(0);
  });

  it('skips the PMREM environment when there is no renderer', () => {
    const { game } = makeGame();
    const sky = createHighKeySky(game);
    expect(sky.environment).toBeNull();
  });
});
