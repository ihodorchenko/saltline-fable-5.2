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
      ramp: !!root?.getObjectByName('glassline-ramp'),
      platform: !!root?.getObjectByName('glassline-moving-platform'),
      ceiling: !!root?.getObjectByName('glassline-low-ceiling'),
      vaultLedge: !!root?.getObjectByName('glassline-vault-ledge'),
      mantleLedge: !!root?.getObjectByName('glassline-mantle-ledge'),
    };
  });
  expect(scene).toEqual({
    root: true,
    player: true,
    ground: true,
    beam: true,
    ramp: true,
    platform: true,
    ceiling: true,
    vaultLedge: true,
    mantleLedge: true,
  });
  const platformY = await page.evaluate(() => window.__G.glassline.platform.position.y);
  await page.waitForTimeout(600);
  const platformYLater = await page.evaluate(() => window.__G.glassline.platform.position.y);
  expect(platformYLater).not.toBeCloseTo(platformY, 3);
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
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.up('w');
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

test('glassline slide starts from a run and recovers', async ({ page }) => {
  await boot(page, '?show=glassline&q=low');
  await page.keyboard.down('w');
  await page.waitForTimeout(650);
  await page.keyboard.press('c');
  await page.waitForFunction(
    () => {
      const state = window.__G.glassline.controller.getState();
      return state.sliding === true && state.eyeHeight < 1.2;
    },
    null,
    { timeout: 3_000 },
  );
  const sliding = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(sliding.sliding).toBe(true);
  expect(sliding.eyeHeight).toBeLessThan(1.2);
  await page.waitForFunction(
    () => {
      const state = window.__G.glassline.controller.getState();
      return state.sliding === false && state.eyeHeight > 1.3;
    },
    null,
    { timeout: 5_000 },
  );
  const recovered = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.up('w');
  expect(recovered.sliding).toBe(false);
  expect(recovered.eyeHeight).toBeGreaterThan(1.3);
});

test('glassline vault crosses the low ledge', async ({ page }) => {
  await boot(page, '?show=glassline&q=low');
  const before = await page.evaluate(() => {
    window.__G.glassline.controller.teleport(3, 4.2, 0, 5.4);
    return window.__G.glassline.controller.getState();
  });
  const started = await page.evaluate(() => window.__G.glassline.controller.tryVault());
  expect(started).toBe(true);
  await page.waitForFunction(() => window.__G.glassline.controller.getState().vaulting === false, null, {
    timeout: 5_000,
  });
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.vaults).toBeGreaterThan(before.vaults);
  expect(after.pos.z).toBeLessThan(before.pos.z - 1);
});

test('glassline mantle climbs the high ledge', async ({ page }) => {
  await boot(page, '?show=glassline&q=low');
  const before = await page.evaluate(() => {
    window.__G.glassline.controller.teleport(-3, 2.2, 0, 0);
    return window.__G.glassline.controller.getState();
  });
  const started = await page.evaluate(() => window.__G.glassline.controller.tryMantle());
  expect(started).toBe(true);
  await page.waitForFunction(() => window.__G.glassline.controller.getState().mantling === false, null, {
    timeout: 5_000,
  });
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.mantles).toBeGreaterThan(before.mantles);
  expect(after.pos.y).toBeGreaterThan(1.4);
  expect(after.pos.z).toBeLessThan(1.5);
});
