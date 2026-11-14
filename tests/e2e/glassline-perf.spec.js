import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('glassline performance overlay reports a sane low-quality budget', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1&stats=1');
  const panel = page.locator('#glassline-perf');
  await expect(panel).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(panel).toContainText('GLASSLINE PERF');
  await expect(panel).toContainText('CALLS');
  await expect(panel).toContainText('QUALITY  LOW');
  // A shadow-map refresh lands on alternating frames; sample the cheapest
  // complete frame rather than treating shadow-pass calls as steady-state.
  const stats = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 15; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(window.__stats());
    }
    return samples.reduce((best, sample) => (sample.calls < best.calls ? sample : best), samples[0]);
  });
  expect(stats.calls).toBeLessThan(300);
  expect(stats.tris).toBeLessThan(20000);
  expect(stats.geos).toBeLessThan(150);
  expect(stats.fps).toBeGreaterThan(20);

  await page.keyboard.press('F3');
  await expect(panel).toBeHidden();
  await page.keyboard.press('F3');
  await expect(panel).toBeVisible();

  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => ({
    errors: window.__errors,
    fatal: window.__fatal,
    buffer: document.querySelector('#glassline-perf')?.textContent,
  }));
  expect(resized.errors).toEqual([]);
  expect(resized.fatal).toBeNull();
  expect(resized.buffer).toContain('BUFFER');
  await page.screenshot({ path: 'artifacts/glassline-perf.png' });
});

test('glassline reloads repeatedly without fatal errors', async ({ page }) => {
  for (let i = 0; i < 3; i += 1) {
    await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
    const state = await page.evaluate(() => ({
      fatal: window.__fatal,
      errors: window.__errors,
      checkpoint: window.__G?.glassline?.tutorial?.checkpoint,
    }));
    expect(state.fatal).toBeNull();
    expect(state.errors).toEqual([]);
    expect(state.checkpoint).toBe(0);
    await page.reload();
  }
});

test('glassline peak-load benchmark produces a result', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&peak=1&duration=1&q=low&dynres=0');
  await page.waitForFunction(() => window.__glasslineBench && window.__glasslineBench.done === true, null, {
    timeout: 20_000,
  });
  const result = await page.evaluate(() => window.__glasslineBench);
  expect(result.frames).toBeGreaterThan(10);
  expect(result.calls).toBeGreaterThan(0);
  expect(result.tris).toBeGreaterThan(0);
  expect(result.buffer.length).toBe(2);
  expect(typeof result.pass60).toBe('boolean');
  await expect(page.locator('#glassline-bench-result')).toBeVisible();
});
