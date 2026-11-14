import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline start and pause overlays gate the run', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  await expect(page).toHaveTitle('GLASSLINE — Rooftop Induction');
  await expect(page.locator('.boot-mark')).toHaveText('GLASSLINE');
  const menu = page.locator('#glassline-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('GLASSLINE');
  await expect(menu).toContainText('START RUN');
  await expect(menu).toContainText('SETTINGS');
  await expect(menu).toContainText('CONTROLS');
  await page.locator('[data-action="settings"]').click();
  await expect(menu).toContainText('SOUND ON');
  await page.locator('[data-action="mute"]').click();
  await expect(menu).toContainText('SOUND OFF');
  const audioStored = await page.evaluate(() => JSON.parse(localStorage.getItem('glassline.audio.v1')));
  expect(audioStored.muted).toBe(true);
  await page.locator('[data-action="mute"]').click();
  await page.locator('[data-action="back"]').click();
  await expect(menu).toContainText('START RUN');
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
  await page.locator('[data-action="controls"]').click();
  await expect(page.locator('#glassline-menu')).toContainText('CONTROLS');
  const forward = page.locator('[data-action="bind"][data-binding="forward"]');
  await forward.click();
  await expect(forward).toHaveText('PRESS KEY');
  await page.keyboard.press('i');
  await expect(forward).toHaveText('I');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('glassline.bindings.v1')));
  expect(stored.forward).toEqual(['KeyI']);

  await page.locator('[data-action="back"]').click();
  await page.locator('[data-action="start"]').click();
  const before = await page.evaluate(() => window.__G.glassline.controller.getState());
  await page.keyboard.down('i');
  await page.waitForTimeout(500);
  await page.keyboard.up('i');
  const after = await page.evaluate(() => window.__G.glassline.controller.getState());
  expect(after.pos.z).toBeLessThan(before.pos.z - 0.2);
});

test('a saved completed run opens the completion menu and can restart', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  await page.evaluate(() => {
    const game = window.__G;
    const finish = game.glassline.level.finish;
    game.glassline.controller.teleport(finish.pos[0], finish.pos[2], 0, 0, false, finish.pos[1] + 0.05);
  });
  await expect(page.locator('#glassline-menu')).toContainText('RUN COMPLETE');

  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator('#glassline-menu')).toContainText('RUN COMPLETE');
  await page.locator('[data-action="restart"]').click();
  await expect(page.locator('#glassline-menu')).toBeHidden();
  const state = await page.evaluate(() => ({
    finished: window.__G.glassline.tutorial.finished,
    checkpoint: window.__G.glassline.tutorial.checkpoint,
  }));
  expect(state.finished).toBe(false);
  expect(state.checkpoint).toBe(0);
});

test('an in-progress run offers continue and start-over', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  await page.evaluate(() => {
    const game = window.__G;
    const checkpoint = game.glassline.level.checkpoints.find((item) => item.id === 'slide');
    game.glassline.controller.teleport(
      checkpoint.pos[0],
      checkpoint.pos[2],
      checkpoint.yaw,
      0,
      false,
      checkpoint.pos[1] + 0.05,
    );
  });
  await page.waitForFunction(() => window.__G.glassline.tutorial.checkpoint >= 2, null, { timeout: 3_000 });

  await boot(page, '?show=glassline-tutorial&q=low');
  const menu = page.locator('#glassline-menu');
  await expect(menu).toContainText('CONTINUE');
  await expect(menu).toContainText('START OVER');
  await page.locator('[data-action="start"]').click();
  await expect(menu).toBeHidden();
  const continued = await page.evaluate(() => window.__G.glassline.tutorial.checkpoint);
  expect(continued).toBeGreaterThanOrEqual(2);

  await boot(page, '?show=glassline-tutorial&q=low');
  await expect(page.locator('#glassline-menu')).toContainText('START OVER');
  await page.locator('[data-action="start-over"]').click();
  await expect(page.locator('#glassline-menu')).toBeHidden();
  const fresh = await page.evaluate(() => ({
    checkpoint: window.__G.glassline.tutorial.checkpoint,
    finished: window.__G.glassline.tutorial.finished,
  }));
  expect(fresh.checkpoint).toBe(0);
  expect(fresh.finished).toBe(false);
});

test('starting and reloading at checkpoint zero still offers continue', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('#glassline-menu')).toBeHidden();
  await page.waitForTimeout(300);

  await boot(page, '?show=glassline-tutorial&q=low');
  await expect(page.locator('#glassline-menu')).toContainText('CONTINUE');
  await expect(page.locator('#glassline-menu')).toContainText('START OVER');
  await page.locator('[data-action="start-over"]').click();
  const state = await page.evaluate(() => ({
    checkpoint: window.__G.glassline.tutorial.checkpoint,
    started: window.__G.glassline.tutorial.started,
  }));
  expect(state.checkpoint).toBe(0);
  expect(state.started).toBe(true);
});
