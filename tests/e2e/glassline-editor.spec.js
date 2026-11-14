import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline level inspector boots and previews checkpoints', async ({ page }) => {
  const state = await boot(page, '?show=glassline-editor&q=low');
  expect(state.showcase).toBe('glassline-editor');
  await expect(page.locator('#glassline-editor')).toBeVisible();
  await expect(page.locator('#glassline-editor')).toContainText('LEVEL INSPECTOR');
  await expect(page.locator('#glassline-editor')).toContainText('format valid');
  await expect(page.locator('#glassline-editor')).toContainText('21 checkpoints');

  const before = await page.evaluate(() => ({
    camera: window.__G.camera.position.toArray(),
    target: window.__G.glassline.editor.view.target.toArray(),
    options: document.querySelectorAll('#ed-checkpoint option').length,
  }));
  expect(before.options).toBe(21);
  expect(before.camera[1]).toBeGreaterThan(10);

  await page.evaluate(() => {
    window.__G.glassline.editor.focusCheckpoint(9);
  });
  const after = await page.evaluate(() => ({
    target: window.__G.glassline.editor.view.target.toArray(),
    distance: window.__G.glassline.editor.view.distance,
    selected: window.__G.glassline.editor.view.selected,
  }));
  expect(after.selected).toBe(9);
  expect(after.distance).toBe(14);
  expect(after.target[2]).toBeLessThan(-50);

  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/glassline-editor.png' });
});
