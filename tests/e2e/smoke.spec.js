import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('smoke: title menu is visible after boot', async ({ page }, testInfo) => {
  await boot(page, '?q=low');
  await expect(page.locator('.menu .m-title')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);

  const png = await page.screenshot({ animations: 'disabled' });
  expect(png.byteLength).toBeGreaterThan(50_000);

  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/ci-smoke.png', png);
  await testInfo.attach('smoke', { body: png, contentType: 'image/png' });
});
