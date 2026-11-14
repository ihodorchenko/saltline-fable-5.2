import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('captures a stable performance baseline', async ({ page }, testInfo) => {
  await boot(page, '?autostart=1&q=low');
  await page.waitForFunction(() => window.__G?.game?.state === 'playing', null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(600);

  const metrics = await page.evaluate(async () => {
    const game = window.__G;
    const stats = typeof game.render.stats === 'function' ? game.render.stats() : {};
    const samples = [];
    await new Promise((resolve) => {
      let last = performance.now();
      let count = 0;
      const tick = (now) => {
        samples.push(now - last);
        last = now;
        count += 1;
        if (count >= 30) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return {
      measuredAt: new Date().toISOString(),
      quality: game.quality?.name || null,
      stats,
      frameMs: {
        samples: samples.length,
        avg,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        min: sorted[0],
        max: sorted[sorted.length - 1],
      },
    };
  });

  const output = path.resolve('artifacts/perf-baseline.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(metrics, null, 2));
  await testInfo.attach('perf-baseline', {
    path: output,
    contentType: 'application/json',
  });

  expect(metrics.stats).toBeTruthy();
  expect(metrics.frameMs.samples).toBe(30);
  expect(metrics.frameMs.avg).toBeGreaterThan(0);
  expect(metrics.frameMs.avg).toBeLessThan(500);
});
