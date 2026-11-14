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
