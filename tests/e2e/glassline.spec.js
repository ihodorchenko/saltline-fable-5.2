import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline step 0 prototype boots', async ({ page }) => {
  const state = await boot(page, '?show=glassline&q=low');
  expect(state.showcase).toBe('glassline');
  expect(state.gameState).toBe('showcase');

  const scene = await page.evaluate(() => {
    const game = window.__G;
    const root = game.scene.getObjectByName('glassline-prototype');
    return {
      root: !!root,
      player: !!root?.getObjectByName('glassline-player'),
      ground: !!root?.getObjectByName('glassline-ground'),
      beam: !!root?.getObjectByName('glassline-route-beam'),
    };
  });
  expect(scene).toEqual({
    root: true,
    player: true,
    ground: true,
    beam: true,
  });
  await expect(page.locator('canvas')).toBeVisible();
  const png = await page.screenshot({ animations: 'disabled' });
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/glassline-step0.png', png);
});

test('glassline capsule moves with WASD', async ({ page }) => {
  await boot(page, '?show=glassline&q=low');
  const before = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.pos.z).toBeLessThan(before.pos.z - 0.2);
  expect(after.pos.y).toBeGreaterThan(-0.5);
  expect(after.speed).toBeGreaterThan(0.2);
});

test('glassline capsule jumps from the ground', async ({ page }) => {
  await boot(page, '?show=glassline&q=low');
  const before = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.jumps).toBeGreaterThan(before.jumps);
  expect(after.pos.y).toBeGreaterThan(before.pos.y + 0.1);
});
