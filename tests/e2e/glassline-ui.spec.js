import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline start and pause overlays gate the run', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  const menu = page.locator('#glassline-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('GLASSLINE');
  await expect(menu).toContainText('START RUN');
  await expect(menu).toContainText('SOUND ON');
  await page.locator('[data-action="mute"]').click();
  await expect(menu).toContainText('SOUND OFF');
  const audioStored = await page.evaluate(() => JSON.parse(localStorage.getItem('glassline.audio.v1')));
  expect(audioStored.muted).toBe(true);
  await page.locator('[data-action="mute"]').click();
  await expect(page.locator('#gl-time')).toHaveText('TIME 00:00');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/glassline-menu.png' });

  await page.locator('[data-action="start"]').click();
  await expect(menu).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__G.glassline.audio.started)).toBe(true);
  await page.waitForTimeout(1300);
  await expect(page.locator('#gl-time')).not.toHaveText('TIME 00:00');

  await page.evaluate(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    else document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('PAUSED');
  await page.locator('[data-action="resume"]').click();
  await expect(menu).toBeHidden();
});

test('glassline completion overlay shows run stats', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  await page.evaluate(() => {
    const game = window.__G;
    const finish = game.glassline.level.finish;
    game.glassline.controller.teleport(finish.pos[0], finish.pos[2], 0, 0, false, finish.pos[1] + 0.05);
  });
  await expect(page.locator('#glassline-menu')).toBeVisible();
  await expect(page.locator('#glassline-menu')).toContainText('RUN COMPLETE');
  await expect(page.locator('#glassline-menu')).toContainText('TIME');
  await expect(page.locator('#glassline-menu')).toContainText('RESPAWNS');
});

test('glassline settings rebinds forward and persists', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator('#glassline-menu')).toContainText('CONTROLS');
  const forward = page.locator('[data-action="bind"][data-binding="forward"]');
  await forward.click();
  await expect(forward).toHaveText('PRESS KEY');
  await page.keyboard.press('i');
  await expect(forward).toHaveText('I');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('glassline.bindings.v1')));
  expect(stored.forward).toEqual(['KeyI']);

  await page.locator('[data-action="back-settings"]').click();
  await page.locator('[data-action="start"]').click();
  const before = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.down('i');
  await page.waitForTimeout(500);
  await page.keyboard.up('i');
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.pos.z).toBeLessThan(before.pos.z - 0.2);
});
