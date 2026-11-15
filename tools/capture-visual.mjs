/* eslint-disable no-undef */
// Visual capture harness for look-dev comparison.
//
// Boots the tutorial in Chromium at a fixed resolution/quality, teleports to a
// list of named viewpoints, hides the DOM HUD (unless `--hud`) and writes PNGs.
// Deterministic seed, fixed viewport, paused audio: screenshots are meant to be
// diffed between commits.
//
// Usage:
//   npm run dev                                   # in another shell (port 5173)
//   node tools/capture-visual.mjs --out docs/visual-gap/shots --prefix current
//
// Flags:
//   --url   base URL (default http://127.0.0.1:5173)
//   --out   output dir (default docs/visual-gap/shots)
//   --prefix  file prefix (default current)
//   --quality low|medium|high|ultra (default high)
//   --width / --height (default 1920x1080)
//   --hud   keep the DOM HUD visible
//   --only  comma list of viewpoint names
//   --channel  Playwright browser channel (default PLAYWRIGHT_CHANNEL or msedge)

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const BASE = flag('url', 'http://127.0.0.1:5173');
const OUT = resolve(flag('out', 'docs/visual-gap/shots'));
const PREFIX = flag('prefix', 'current');
const QUALITY = flag('quality', 'high');
const WIDTH = Number(flag('width', 1920));
const HEIGHT = Number(flag('height', 1080));
const KEEP_HUD = has('hud');
const ONLY = (flag('only', '') || '').split(',').filter(Boolean);
const CHANNEL = flag('channel', process.env.PLAYWRIGHT_CHANNEL || '');

// Checkpoint ids in src/levels/tutorial.js. Each pose is teleported to the
// checkpoint position and yaw, so the shot frames what a runner sees there.
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(CHANNEL ? { channel: CHANNEL } : {}),
    args: [
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  const query = `/?show=glassline-tutorial&q=${QUALITY}&autostart=1&shot=1`;
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 120_000,
  });
  // Let auto-exposure settle and the first frames stabilise.
  await page.waitForTimeout(2500);

  await page.evaluate((keepHud) => {
    const hud = document.getElementById('glassline-tutorial');
    if (hud && !keepHud) hud.style.display = 'none';
    const hint = document.querySelector('.gl-control-hint');
    if (hint) hint.style.display = 'none';
    if (window.__G?.glassline?.audio?.setMuted) window.__G.glassline.audio.setMuted(true);
    document.querySelectorAll('canvas').forEach((canvas) => {
      canvas.style.cursor = 'none';
    });
  }, KEEP_HUD);

  const shots = [];
  for (const pose of POSES) {
    if (ONLY.length && !ONLY.some((name) => pose.name.includes(name))) continue;
    const applied = await page.evaluate((checkpointId) => {
      const game = window.__G;
      const checkpoint = game.glassline.level.checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint) return null;
      const [x, y, z] = checkpoint.pos;
      game.glassline.controller.teleport(x, z, checkpoint.yaw, 0, false, y + 0.05);
      return { x, y, z, yaw: checkpoint.yaw };
    }, pose.checkpoint);
    if (!applied) {
      console.warn(`[capture] missing checkpoint ${pose.checkpoint}`);
      continue;
    }
    await page.waitForTimeout(700);
    const file = resolve(OUT, `${PREFIX}-${pose.name}.png`);
    await page.screenshot({ path: file, animations: 'disabled' });
    shots.push({ ...pose, ...applied, file });
    console.log(`[capture] ${pose.name} -> ${file}`);
  }

  // A sky/canyon frame from the spawn roof: pitch the view up by faking pointer
  // lock, which is the only public path into the controller's look state.
  await page.evaluate(() => {
    const game = window.__G;
    const canvas = game.renderer.domElement;
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => canvas,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
    const look = (movementX, movementY) =>
      document.dispatchEvent(new MouseEvent('mousemove', { movementX, movementY }));
    look(0, -520); // look up at the canyon/sky
  });
  const checkpoint = await page.evaluate(() => {
    const game = window.__G;
    const start = game.glassline.level.checkpoints.find((item) => item.id === 'start');
    game.glassline.controller.teleport(start.pos[0], start.pos[2], 0, 0, false, start.pos[1] + 0.05);
    return true;
  });
  if (checkpoint) {
    await page.waitForTimeout(900);
    const file = resolve(OUT, `${PREFIX}-11-sky.png`);
    await page.screenshot({ path: file, animations: 'disabled' });
    shots.push({ name: '11-sky', file });
    console.log(`[capture] 11-sky -> ${file}`);
  }

  // Report what the frame actually cost, for the audit notes.
  const info = await page.evaluate(() => {
    const game = window.__G;
    return {
      quality: game.quality?.name || null,
      renderer: game.renderer?.info?.render || null,
      memory: game.renderer?.info?.memory || null,
      tune: { ...(game.render?.tune || {}) },
      pixelRatio: game.renderer?.getPixelRatio?.() || null,
    };
  });
  await writeFile(
    resolve(OUT, `${PREFIX}-capture.json`),
    JSON.stringify({ query, viewport: [WIDTH, HEIGHT], info, shots, errors }, null, 2),
  );
  console.log('[capture] errors:', errors.length ? errors : 'none');
  console.log('[capture] renderer:', JSON.stringify(info.renderer));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Keep `dirname` imported for future per-pose subdirectories.
void dirname;
