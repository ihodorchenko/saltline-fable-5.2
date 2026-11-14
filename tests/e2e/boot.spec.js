import { expect, test } from '@playwright/test';
import { attachScreenshot, boot } from './helpers.js';

test('title boots without errors', async ({ page }, testInfo) => {
  const state = await boot(page, '?q=low');
  expect(state.showcase).toBeNull();
  expect(state.gameState).toBe('title');
  await expect(page.locator('.menu .m-title')).toBeVisible();
  await attachScreenshot(page, testInfo, 'title');
});
