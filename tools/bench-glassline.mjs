/* eslint-disable no-undef */
// Headed hardware benchmark for the GLASSLINE tutorial.
// Usage: BASE_URL=http://127.0.0.1:4173 DPR=2 QUALITY=high DURATION=8 node tools/bench-glassline.mjs
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const dpr = Number(process.env.DPR || 2);
const quality = process.env.QUALITY || 'high';
const duration = Number(process.env.DURATION || 8);
const headless = process.env.HEADLESS === '1';

const browser = await chromium.launch({ channel: 'msedge', headless });
const context = await browser.newContext({
  viewport: { width: Number(process.env.WIDTH || 1920), height: Number(process.env.HEIGHT || 1080) },
  deviceScaleFactor: dpr,
});
const page = await context.newPage();
await page.goto(`${base}/?show=glassline-tutorial&peak=1&q=${quality}&dynres=0&duration=${duration}`);
await page.waitForFunction(() => window.__glasslineBench && window.__glasslineBench.done === true, null, {
  timeout: 60_000,
});
const result = await page.evaluate(() => window.__glasslineBench);
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/glassline-hardware-bench.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
