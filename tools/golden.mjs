/* eslint-disable no-undef */
// Golden screenshots for look-dev regression checks.
//
// Captures one frame per route viewpoint at a fixed quality and resolution, and
// writes a manifest with image metrics next to the PNGs. `artifacts/` is
// git-ignored, so the manifest travels with the build, not the history: the point
// is to answer "did this commit change the look, and by how much" without brittle
// pixel diffs (film grain and cloud drift are time-dependent by design).
//
// Usage:
//   npm run dev                                   # in another shell (port 5173)
//   npm run golden                                # writes artifacts/golden/
//   npm run golden -- --url http://127.0.0.1:4173 # e.g. against `npm run preview`

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const BASE = flag('url', 'http://127.0.0.1:5173');
const OUT = resolve(flag('out', 'artifacts/golden'));
const QUALITY = flag('quality', 'high');
const WIDTH = Number(flag('width', 1920));
const HEIGHT = Number(flag('height', 1080));
const CHANNEL = flag('channel', process.env.PLAYWRIGHT_CHANNEL || 'msedge');

const POSES = [
  { name: '01-start', checkpoint: 'start' },
  { name: '02-jump', checkpoint: 'jump' },
  { name: '03-slide', checkpoint: 'slide' },
  { name: '04-mantle', checkpoint: 'mantle' },
  { name: '05-wallrun', checkpoint: 'wallrun' },
  { name: '06-balance', checkpoint: 'balance' },
  { name: '07-act1-end', checkpoint: 'act1-end' },
  { name: '08-act2', checkpoint: 'act2' },
  { name: '09-act3', checkpoint: 'final-b' },
  { name: '10-finish', checkpoint: 'finish' },
];

/** Luma/saturation summary of a PNG buffer: enough to spot a look regression. */
function imageMetrics(buffer) {
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  let sum = 0;
  let sumSq = 0;
  let satSum = 0;
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[p] = l;
    sum += l;
    sumSq += l * l;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    satSum += max > 0 ? (max - min) / max : 0;
  }
  const count = luma.length;
  const sorted = Float32Array.from(luma).sort();
  const percentile = (q) => sorted[Math.min(count - 1, Math.max(0, Math.round(q * (count - 1))))];
  return {
    lumaMean: +(sum / count).toFixed(4),
    lumaStd: +Math.sqrt(Math.max(0, sumSq / count - (sum / count) ** 2)).toFixed(4),
    lumaP5: +percentile(0.05).toFixed(4),
    lumaP95: +percentile(0.95).toFixed(4),
    saturationMean: +(satSum / count).toFixed(4),
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: CHANNEL,
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${BASE}/?show=glassline-tutorial&q=${QUALITY}&autostart=1&shot=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const hud = document.getElementById('glassline-tutorial');
    if (hud) hud.style.display = 'none';
    document.querySelectorAll('.gl-control-hint').forEach((node) => {
      node.style.display = 'none';
    });
  });

  const frames = [];
  for (const pose of POSES) {
    const applied = await page.evaluate((checkpointId) => {
      const game = window.__G;
      const checkpoint = game.glassline.level.checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint) return null;
      const [x, y, z] = checkpoint.pos;
      game.glassline.controller.teleport(x, z, checkpoint.yaw, 0, false, y + 0.05);
      return { x, y, z, yaw: checkpoint.yaw };
    }, pose.checkpoint);
    if (!applied) {
      console.warn(`[golden] missing checkpoint ${pose.checkpoint}`);
      continue;
    }
    await page.waitForTimeout(700);
    const file = resolve(OUT, `${pose.name}.png`);
    const buffer = await page.screenshot({ path: file, animations: 'disabled' });
    frames.push({ ...pose, ...applied, file, metrics: imageMetrics(buffer) });
    console.log(
      `[golden] ${pose.name} mean=${frames.at(-1).metrics.lumaMean} p95=${frames.at(-1).metrics.lumaP95}`,
    );
  }

  const manifest = {
    query: `?show=glassline-tutorial&q=${QUALITY}&autostart=1&shot=1`,
    viewport: [WIDTH, HEIGHT],
    poses: POSES.length,
    frames,
    errors,
  };
  await writeFile(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[golden] wrote ${frames.length} frames + manifest to ${OUT}`);
  if (errors.length) {
    console.error('[golden] page errors:', errors);
    process.exitCode = 1;
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
