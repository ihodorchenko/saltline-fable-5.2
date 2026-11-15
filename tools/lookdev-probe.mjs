/* eslint-disable no-undef */
// Live look-dev probe: boots the tutorial and applies look presets at runtime
// (no source changes), then captures the same viewpoints for each preset.
//
// It exists to measure how much of the visual gap is *tuning* rather than new
// content. Every preset below only touches values that already exist in the
// engine/atmosphere/sky modules; nothing here is a permanent fix.
//
// Usage: npm run dev   (port 5173)
//        node tools/lookdev-probe.mjs [--only B,C] [--out docs/visual-gap/shots]

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const BASE = flag('url', 'http://127.0.0.1:5173');
const OUT = resolve(flag('out', 'docs/visual-gap/shots'));
const ONLY = (flag('only', '') || '').split(',').filter(Boolean);
const CHANNEL = flag('channel', process.env.PLAYWRIGHT_CHANNEL || 'msedge');

// One wide route view and two closer beats.
const POSES = [
  { name: 'start', checkpoint: 'start' },
  { name: 'wallrun', checkpoint: 'wallrun' },
  { name: 'act2', checkpoint: 'act2' },
];

/** Shared body: expose the engine cumulus sky with a saturated blue zenith. */
const SHOW_CLOUD_SKY = `
  const engineSky = scene.getObjectByName('sky');
  const gradientSky = scene.getObjectByName('glassline-high-key-sky');
  const sprite = scene.getObjectByName('glassline-sun');
  if (gradientSky) gradientSky.visible = false;
  if (sprite) sprite.visible = false;
  if (engineSky) {
    engineSky.visible = true;
    const uniforms = engineSky.material.uniforms;
    uniforms.uZen.value.setHex(0x1c66c8);
    uniforms.uHor.value.setHex(0xd8ecff);
    uniforms.uHorAway.value.setHex(0x8fb6d8);
    uniforms.uFlash.value = 0;
    uniforms.uEnv.value = 0;
    uniforms.uSunCol.value.setHex(0xfff4e2);
  }
  return !!engineSky;
`;

const PRESETS = {
  // A: what the build ships today (control shot).
  A: `() => true`,

  // B: kill the auto-exposure only. The engine meters luminance from the bloom
  // chain, which is thresholded at 1.8 in HDR, so it reads ~0.002 and pegs
  // exposure at maxExposure (2x). Disabling it shows the scene at 1x.
  B: `() => {
    const game = window.__G;
    game.render.autoExposure = false;
    game.render.exposure = 1.0;
    return true;
  }`,

  // C: exposure + a sane light rig: one strong sun, little fill, deeper
  // shadow-side blue, thinner air, harder grade.
  C: `() => {
    const game = window.__G;
    const scene = game.scene;
    game.render.autoExposure = false;
    game.render.exposure = 1.0;
    for (const light of scene.children) {
      if (light.isHemisphereLight) light.intensity = 0.22;
      else if (light.isDirectionalLight && light.name !== 'sun') light.intensity *= 0.25;
    }
    scene.environmentIntensity = 0.12;
    scene.fog.density = 0.00055;
    Object.assign(game.render.tune, {
      volSigma: 0.0006,
      volFarHaze: 0.08,
      volAmbient: 0.04,
      lookPower: 1.42,
      lookSat: 1.34,
      agxMix: 0.0,
      bloom: 0.05,
      bloomThreshold: 2.4,
      vignette: 0.42,
      grain: 0.012,
      flare: 0.1,
      key: 0.16,
    });
    return true;
  }`,

  // D: the engine already ships a procedural cumulus sky; GLASSLINE hides it
  // (build.js:559) in favour of a flat gradient dome. Re-show it blue.
  D: `() => {
    const game = window.__G;
    const scene = game.scene;
    ${SHOW_CLOUD_SKY}
  }`,

  // E: everything at once.
  E: `() => {
    const game = window.__G;
    const scene = game.scene;
    game.render.autoExposure = false;
    game.render.exposure = 1.0;
    for (const light of scene.children) {
      if (light.isHemisphereLight) light.intensity = 0.22;
      else if (light.isDirectionalLight && light.name !== 'sun') light.intensity *= 0.25;
    }
    scene.environmentIntensity = 0.12;
    scene.fog.density = 0.00055;
    Object.assign(game.render.tune, {
      volSigma: 0.0006,
      volFarHaze: 0.08,
      volAmbient: 0.04,
      lookPower: 1.42,
      lookSat: 1.34,
      agxMix: 0.0,
      bloom: 0.05,
      bloomThreshold: 2.4,
      vignette: 0.42,
      grain: 0.012,
      flare: 0.1,
      key: 0.16,
    });
    ${SHOW_CLOUD_SKY}
  }`,
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: CHANNEL,
  args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

// One fresh boot per preset so presets never stack.
for (const [preset, source] of Object.entries(PRESETS)) {
  if (ONLY.length && !ONLY.includes(preset)) continue;
  await page.goto(`${BASE}/?show=glassline-tutorial&q=high&autostart=1&shot=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(2500);
  const applied = await page.evaluate((presetSource) => {
    const hud = document.getElementById('glassline-tutorial');
    if (hud) hud.style.display = 'none';
    const run = new Function(`return (${presetSource})`)();
    return run();
  }, source);
  if (applied === false) console.warn(`[lookdev] preset ${preset} reported no change`);
  for (const pose of POSES) {
    await page.evaluate((checkpointId) => {
      const game = window.__G;
      const item = game.glassline.level.checkpoints.find((entry) => entry.id === checkpointId);
      if (!item) return;
      game.glassline.controller.teleport(item.pos[0], item.pos[2], item.yaw, 0, false, item.pos[1] + 0.05);
    }, pose.checkpoint);
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(OUT, `lookdev-${preset}-${pose.name}.png`) });
    console.log(`[lookdev] ${preset}-${pose.name}`);
  }
}
console.log('[lookdev] errors:', errors.length ? errors : 'none');
await browser.close();
