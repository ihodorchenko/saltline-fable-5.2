/* eslint-disable no-undef */
// Measures the share of the screen covered by the persistent tutorial HUD.
// Used to keep the "near HUD-free while running" acceptance target honest:
// docs/VISUAL_GAP.md §7 asks for < 2 % of the frame.
//
// Usage: npm run dev, then `node tools/measure-hud-area.mjs`

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || 'msedge';
const OUT = process.env.SHOT || 'docs/visual-gap/shots/hud-01-start.png';

const browser = await chromium.launch({ channel: CHANNEL });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${BASE}/?show=glassline-tutorial&q=high&autostart=1&shot=1`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const vw = innerWidth;
  const vh = innerHeight;
  let area = 0;
  const visible = [];
  document.querySelectorAll('#glassline-tutorial *').forEach((el) => {
    const style = getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0 ||
      Number(style.opacity) < 0.06
    ) {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (style.position !== 'absolute' && style.position !== 'fixed') return;
    area += rect.width * rect.height;
    visible.push([el.className || el.id, Math.round(rect.width), Math.round(rect.height)]);
  });
  return {
    viewport: [vw, vh],
    areaPx: Math.round(area),
    areaPct: +((area / (vw * vh)) * 100).toFixed(2),
    elements: visible,
  };
});

await page.screenshot({ path: OUT, animations: 'disabled' });
await browser.close();
console.log(JSON.stringify(info, null, 1));
