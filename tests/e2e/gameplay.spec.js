import { expect, test } from '@playwright/test';
import { attachScreenshot, boot } from './helpers.js';

test('autostart reaches the playing state', async ({ page }, testInfo) => {
  await boot(page, '?autostart=1&q=low');
  await page.waitForFunction(() => window.__G?.game?.state === 'playing', null, {
    timeout: 30_000,
  });
  await expect(page.locator('.hud.on')).toBeVisible();
  await attachScreenshot(page, testInfo, 'gameplay');
});
