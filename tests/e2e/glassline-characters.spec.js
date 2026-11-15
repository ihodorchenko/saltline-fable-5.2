import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('procedural courier and mentor rigs animate without external models', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  await page.waitForTimeout(250);
  const initial = await page.evaluate(() => {
    const game = window.__G;
    const characters = game.glassline.characters;
    const courier = game.scene.getObjectByName('courier-rig');
    const mentor = game.scene.getObjectByName('mentor-character');
    return {
      courier: !!courier,
      mentor: !!mentor,
      mentorVisible: mentor?.visible || false,
      hip: characters.courier.joints.leftHip.rotation.x,
      followsCamera: courier?.position.distanceTo(game.camera.position) < 0.001,
      noSkeleton:
        !courier?.getObjectByProperty?.('isSkinnedMesh', true) &&
        !mentor?.getObjectByProperty?.('isSkinnedMesh', true),
      errors: game.__errors || [],
    };
  });
  expect(initial.courier).toBe(true);
  expect(initial.mentor).toBe(true);
  expect(initial.mentorVisible).toBe(true);
  expect(initial.followsCamera).toBe(true);
  expect(initial.noSkeleton).toBe(true);
  expect(initial.errors).toEqual([]);

  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => {
    const characters = window.__G.glassline.characters;
    return {
      hip: characters.courier.joints.leftHip.rotation.x,
      mentorAge: characters.mentor.age,
      errors: window.__G.__errors || [],
    };
  });
  expect(Math.abs(after.hip - initial.hip)).toBeGreaterThan(0.001);
  expect(after.mentorAge).toBeGreaterThan(0);
  expect(after.errors).toEqual([]);
  await page.screenshot({
    path: 'artifacts/glassline-characters-start.png',
    animations: 'disabled',
  });
});

test('first-person hands render on the engine view-model layer', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const game = window.__G;
    const viewmodel = game.glassline.characters.viewmodel;
    const viewCamera = game.render.viewCamera;
    let meshes = 0;
    let onViewLayer = 0;
    let unculled = 0;
    viewmodel.root.traverse((object) => {
      if (!object.isMesh) return;
      meshes += 1;
      if (object.layers.mask === 1 << 1) onViewLayer += 1;
      if (object.frustumCulled === false) unculled += 1;
    });
    let mentorCasts = false;
    game.scene.getObjectByName('mentor-character')?.traverse((object) => {
      if (object.isMesh && object.castShadow) mentorCasts = true;
    });
    return {
      exists: !!viewmodel.root,
      visible: viewmodel.root.visible,
      parented: viewmodel.root.parent === viewCamera,
      cameraInScene: viewCamera.parent === game.scene,
      meshes,
      onViewLayer,
      unculled,
      mentorCasts,
      mentorFar: game.glassline.characters.mentor.start.z < 5,
      errors: game.__errors || [],
    };
  });
  expect(state.exists).toBe(true);
  expect(state.visible).toBe(true);
  expect(state.parented).toBe(true);
  expect(state.cameraInScene).toBe(true);
  expect(state.meshes).toBeGreaterThanOrEqual(10);
  expect(state.onViewLayer).toBe(state.meshes);
  expect(state.unculled).toBe(state.meshes);
  expect(state.mentorCasts).toBe(true);
  expect(state.mentorFar).toBe(true);
  expect(state.errors).toEqual([]);
  await page.screenshot({
    path: 'artifacts/glassline-viewmodel.png',
    animations: 'disabled',
  });
});
