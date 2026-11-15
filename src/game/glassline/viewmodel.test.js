import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createViewmodel } from './viewmodel.js';

function makeGame() {
  const scene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera(60, 16 / 9, 0.01, 10);
  return { game: { THREE, scene, render: { viewCamera } }, scene, viewCamera };
}

const viewLayerMask = 1 << 1; // layer 1: the engine's view-model pass

describe('createViewmodel', () => {
  it('attaches the arms to the view camera on the view-model layer', () => {
    const { game, scene, viewCamera } = makeGame();
    const viewmodel = createViewmodel(game);

    expect(scene.children).toContain(viewCamera);
    expect(viewmodel.root.parent).toBe(viewCamera);
    expect(viewmodel.root.name).toBe('courier-viewmodel');
    expect(viewmodel.root.visible).toBe(false);

    const meshes = [];
    viewmodel.root.traverse((object) => {
      if (object.isMesh) meshes.push(object);
    });
    // Two arms with a sleeve, forearm, cuff, tracker, hand and thumb each.
    expect(meshes.length).toBeGreaterThanOrEqual(10);
    meshes.forEach((mesh) => {
      expect(mesh.layers.mask).toBe(viewLayerMask);
      expect(mesh.frustumCulled).toBe(false);
    });
  });

  it('shows and hides with the run', () => {
    const { game } = makeGame();
    const viewmodel = createViewmodel(game);
    viewmodel.setVisible(true);
    expect(viewmodel.root.visible).toBe(true);
    viewmodel.setVisible(false);
    expect(viewmodel.root.visible).toBe(false);
  });

  it('swings the arms while running and settles when idle', () => {
    const { game } = makeGame();
    const viewmodel = createViewmodel(game);
    viewmodel.setVisible(true);
    const [left, right] = viewmodel.root.children;

    for (let frame = 0; frame < 60; frame += 1) {
      viewmodel.update(1 / 60, { speed: 7, sprinting: true, onGround: true }, frame / 60);
    }
    const runRotation = { left: left.rotation.x, right: right.rotation.x };
    expect(runRotation.left).not.toBeCloseTo(runRotation.right, 3);
    expect(Math.abs(runRotation.left)).toBeGreaterThan(0.001);

    for (let frame = 0; frame < 240; frame += 1) {
      viewmodel.update(1 / 60, { speed: 0, onGround: true }, 10 + frame / 60);
    }
    expect(Math.abs(left.rotation.x)).toBeLessThan(0.05);
    expect(Math.abs(right.rotation.x)).toBeLessThan(0.05);
  });

  it('leans the arms back in a slide and reaches up on a wallrun', () => {
    const { game } = makeGame();
    const viewmodel = createViewmodel(game);
    viewmodel.setVisible(true);
    const [left, right] = viewmodel.root.children;

    for (let frame = 0; frame < 90; frame += 1) {
      viewmodel.update(1 / 60, { speed: 6, sliding: true, onGround: true }, frame / 60);
    }
    const slideRotation = left.rotation.x;

    for (let frame = 0; frame < 90; frame += 1) {
      viewmodel.update(1 / 60, { speed: 6, wallrunning: true, onGround: false }, 2 + frame / 60);
    }
    const wallrunRotation = right.rotation.x;
    expect(slideRotation).toBeLessThan(0);
    expect(wallrunRotation).toBeGreaterThan(slideRotation);
  });

  it('disposes cleanly', () => {
    const { game, viewCamera } = makeGame();
    const viewmodel = createViewmodel(game);
    viewmodel.setVisible(true);
    viewmodel.dispose();
    expect(viewCamera.children).toHaveLength(0);
  });
});
