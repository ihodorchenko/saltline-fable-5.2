import { expect } from '@playwright/test';

export async function boot(page, query = '?q=low') {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  const state = await page.evaluate(() => ({
    ready: window.__ready,
    fatal: window.__fatal,
    errors: window.__errors || [],
    showcase: window.__G?.showcase || null,
    gameState: window.__G?.game?.state || null,
  }));
  expect(state.fatal).toBeNull();
  expect(state.errors).toEqual([]);
  return state;
}

export async function attachScreenshot(page, testInfo, name) {
  const body = await page.screenshot();
  await testInfo.attach(name, { body, contentType: 'image/png' });
}
