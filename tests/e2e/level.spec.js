import { expect, test } from '@playwright/test';
import { attachScreenshot, boot } from './helpers.js';

test('level showcase boots without errors', async ({ page }, testInfo) => {
  const state = await boot(page, '?show=level&q=low');
  expect(state.showcase).toBe('level');
  expect(state.gameState).toBe('showcase');
  await expect(page.locator('canvas')).toBeVisible();
  await attachScreenshot(page, testInfo, 'level');
});
