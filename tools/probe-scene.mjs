/* eslint-disable no-undef */
// One-off inspection: what lights, sky meshes and materials exist at runtime.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://127.0.0.1:5173/?show=glassline-tutorial&q=high&autostart=1&shot=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
const info = await page.evaluate(() => {
  const game = window.__G;
  const scene = game.scene;
  const lights = [];
  const skies = [];
  let meshes = 0;
  const mats = new Set();
  let textured = 0;
  scene.traverse((o) => {
    if (o.isLight) {
      lights.push({
        type: o.type,
        name: o.name || null,
        intensity: o.intensity,
        color: o.color ? `#${o.color.getHexString()}` : null,
        castShadow: !!o.castShadow,
        pos: o.position ? o.position.toArray().map((v) => +v.toFixed(2)) : null,
      });
    }
    if (o.isMesh) {
      meshes += 1;
      const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of list) {
        if (!m) continue;
        mats.add(m.uuid);
        if (m.map) textured += 1;
      }
      if (/sky/i.test(String(o.name)) || o.material?.type === 'ShaderMaterial') {
        skies.push({
          name: o.name || null,
          mat: o.material?.type,
          uniforms: o.material?.uniforms ? Object.keys(o.material.uniforms) : [],
          renderOrder: o.renderOrder,
          visible: o.visible,
          scale: o.scale.toArray(),
        });
      }
    }
  });
  const tune = { ...(game.render?.tune || {}) };
  return {
    meshes,
    materials: mats.size,
    texturedMeshes: textured,
    lights,
    skies,
    tune,
    fog: scene.fog
      ? { type: scene.fog.type, density: scene.fog.density, color: `#${scene.fog.color.getHexString()}` }
      : null,
    envIntensity: scene.environmentIntensity,
    exposure: game.render?.exposure,
    sunDir: game.render?.sunDir?.toArray?.(),
    sunPos: game.render?.sun?.position?.toArray?.(),
    sunTarget: game.render?.sun?.target?.position?.toArray?.(),
    shadow: game.render?.sun?.shadow
      ? {
          mapSize: game.render.sun.shadow.mapSize.toArray(),
          camera: {
            left: game.render.sun.shadow.camera.left,
            right: game.render.sun.shadow.camera.right,
            top: game.render.sun.shadow.camera.top,
            bottom: game.render.sun.shadow.camera.bottom,
            near: game.render.sun.shadow.camera.near,
            far: game.render.sun.shadow.camera.far,
          },
          bias: game.render.sun.shadow.bias,
          normalBias: game.render.sun.shadow.normalBias,
        }
      : null,
    stats: game.render?.stats?.(),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
