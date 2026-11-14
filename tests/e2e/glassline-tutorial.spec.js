import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline tutorial boots with checkpoints', async ({ page }) => {
  const state = await boot(page, '?show=glassline-tutorial&q=low');
  expect(state.showcase).toBe('glassline-tutorial');
  const scene = await page.evaluate(() => {
    const game = window.__G;
    const tutorial = game.glassline.tutorial;
    const root = game.glassline.root;
    return {
      level: game.glassline.level.id,
      checkpoint: tutorial.checkpoint,
      finished: tutorial.finished,
      rings: root.children.filter((child) => String(child.name).startsWith('checkpoint-')).length,
      signs: root.children.filter((child) => String(child.name).startsWith('sign-')).length,
      finish: !!root.getObjectByName('glassline-finish'),
      finishGate: !!root.getObjectByName('finish-gate'),
    };
  });
  expect(scene.level).toBe('tutorial');
  expect(scene.checkpoint).toBe(0);
  expect(scene.rings).toBe(21);
  expect(scene.signs).toBe(3);
  expect(scene.finish).toBe(true);
  expect(scene.finishGate).toBe(true);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/glassline-tutorial.png' });
});

test('glassline tutorial advances checkpoints, respawns and finishes', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
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

  const beforeRespawn = await page.evaluate(() => {
    const game = window.__G;
    const checkpoint = game.glassline.tutorial.checkpoint;
    game.glassline.controller.teleport(0, -5, 0, 0, true, -10);
    return { checkpoint, respawns: game.glassline.tutorial.respawns };
  });
  await page.waitForFunction(
    (respawns) => window.__G.glassline.tutorial.respawns > respawns,
    beforeRespawn.respawns,
    { timeout: 3_000 },
  );
  const afterRespawn = await page.evaluate(() => ({
    checkpoint: window.__G.glassline.tutorial.checkpoint,
    respawns: window.__G.glassline.tutorial.respawns,
    pos: window.__G.glassline.controller.getState().pos,
  }));
  expect(afterRespawn.checkpoint).toBe(beforeRespawn.checkpoint);
  expect(afterRespawn.pos.y).toBeGreaterThan(-1);

  await page.evaluate(() => {
    const game = window.__G;
    const finish = game.glassline.level.finish;
    game.glassline.controller.teleport(finish.pos[0], finish.pos[2], 0, 0, false, finish.pos[1] + 0.05);
  });
  await page.waitForFunction(() => window.__G.glassline.tutorial.finished === true, null, { timeout: 3_000 });
});

test('glassline tutorial advances every checkpoint in route order', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  const count = await page.evaluate(() => window.__G.glassline.level.checkpoints.length);
  for (let index = 1; index < count; index += 1) {
    await page.evaluate((i) => {
      const game = window.__G;
      const checkpoint = game.glassline.level.checkpoints[i];
      game.glassline.controller.teleport(
        checkpoint.pos[0],
        checkpoint.pos[2],
        checkpoint.yaw,
        0,
        false,
        checkpoint.pos[1] + 0.05,
      );
    }, index);
    await page.waitForFunction((i) => window.__G.glassline.tutorial.checkpoint >= i, index, {
      timeout: 3_000,
    });
  }
  const last = await page.evaluate(() => ({
    checkpoint: window.__G.glassline.tutorial.checkpoint,
    total: window.__G.glassline.level.checkpoints.length,
    splits: window.__G.glassline.tutorial.splits.length,
  }));
  expect(last.checkpoint).toBe(last.total - 1);
  expect(last.splits).toBe(last.total - 1);
});

test('glassline tutorial fail-safe prompts and auto-respawns when stuck', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  await page.waitForFunction(() => window.__G.glassline.tutorial.message.includes('Stuck'), null, {
    timeout: 10_000,
  });
  const before = await page.evaluate(() => window.__G.glassline.tutorial.respawns);
  await page.waitForFunction((respawns) => window.__G.glassline.tutorial.respawns > respawns, before, {
    timeout: 15_000,
  });
  const after = await page.evaluate(() => ({
    autoRespawns: window.__G.glassline.tutorial.autoRespawns,
    message: window.__G.glassline.tutorial.message,
  }));
  expect(after.autoRespawns).toBeGreaterThan(0);
  expect(after.message).toContain('Auto-respawn');
});

test('glassline tutorial restores the last checkpoint after reload', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    const game = window.__G;
    const checkpoint = game.glassline.level.checkpoints.find((item) => item.id === 'mantle');
    game.glassline.controller.teleport(
      checkpoint.pos[0],
      checkpoint.pos[2],
      checkpoint.yaw,
      0,
      false,
      checkpoint.pos[1] + 0.05,
    );
  });
  await page.waitForFunction(() => window.__G.glassline.tutorial.checkpoint >= 4, null, { timeout: 3_000 });
  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  const restored = await page.evaluate(() => ({
    checkpoint: window.__G.glassline.tutorial.checkpoint,
    saved: JSON.parse(localStorage.getItem(window.__G.glassline.storageKey)),
  }));
  expect(restored.checkpoint).toBeGreaterThanOrEqual(4);
  expect(restored.saved.checkpoint).toBe(restored.checkpoint);
  await page.evaluate(() => localStorage.clear());
});
