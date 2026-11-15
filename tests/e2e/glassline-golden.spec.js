import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { boot } from './helpers.js';

/** Luma/saturation summary of a screenshot, used as a tolerant golden check. */
function imageMetrics(buffer) {
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  let sum = 0;
  let satSum = 0;
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[p] = l;
    sum += l;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    satSum += max > 0 ? (max - min) / max : 0;
  }
  const sorted = Float32Array.from(luma).sort();
  const percentile = (q) => sorted[Math.round(q * (sorted.length - 1))];
  return {
    lumaMean: sum / luma.length,
    lumaP5: percentile(0.05),
    lumaP95: percentile(0.95),
    saturationMean: satSum / luma.length,
  };
}

// Tolerant bands around the measured Tier-4 look (docs/VISUAL_GAP.md §5.5). The
// point is to catch a regression to the washed-out / flat look, not to lock
// individual pixels: film grain and cloud drift are time-dependent by design.
// Recalibrated after the materials/content pass (dark reflective glass, more
// shaded courtyard): these are regression guards around the shipped look, not a
// reference match. `npm run golden` prints the manifest the values came from.
const LOOK_BANDS = {
  start: { lumaMean: [0.35, 0.6], lumaP95: [0.84, 1.0], saturationMean: [0.22, 0.5] },
  balance: { lumaMean: [0.45, 0.66], lumaP95: [0.84, 1.0], saturationMean: [0.22, 0.5] },
};

test('the tutorial look stays in its calibrated band', async ({ page }) => {
  await boot(page, '?show=glassline-tutorial&q=high&autostart=1&shot=1');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const hud = document.getElementById('glassline-tutorial');
    if (hud) hud.style.display = 'none';
  });

  for (const [name, checkpointId] of [
    ['start', 'start'],
    ['balance', 'balance'],
  ]) {
    const applied = await page.evaluate((id) => {
      const game = window.__G;
      const checkpoint = game.glassline.level.checkpoints.find((item) => item.id === id);
      if (!checkpoint) return false;
      const [x, y, z] = checkpoint.pos;
      game.glassline.controller.teleport(x, z, checkpoint.yaw, 0, false, y + 0.05);
      return true;
    }, checkpointId);
    expect(applied).toBe(true);
    await page.waitForTimeout(900);
    const buffer = await page.screenshot({ animations: 'disabled' });
    const metrics = imageMetrics(buffer);
    const band = LOOK_BANDS[name];
    expect(metrics.lumaMean, `${name} mean luma`).toBeGreaterThanOrEqual(band.lumaMean[0]);
    expect(metrics.lumaMean, `${name} mean luma`).toBeLessThanOrEqual(band.lumaMean[1]);
    expect(metrics.lumaP95, `${name} highlight roll`).toBeGreaterThanOrEqual(band.lumaP95[0]);
    expect(metrics.lumaP95, `${name} highlight roll`).toBeLessThanOrEqual(band.lumaP95[1]);
    expect(metrics.saturationMean, `${name} saturation`).toBeGreaterThanOrEqual(band.saturationMean[0]);
    expect(metrics.saturationMean, `${name} saturation`).toBeLessThanOrEqual(band.saturationMean[1]);
  }

  const state = await page.evaluate(() => ({
    fatal: window.__G.__fatal ?? null,
    errors: window.__G.__errors || [],
  }));
  expect(state.fatal).toBeNull();
  expect(state.errors).toEqual([]);
});
