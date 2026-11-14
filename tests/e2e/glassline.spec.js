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
