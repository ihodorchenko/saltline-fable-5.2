import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const LEVEL_QUERY = '?show=level&q=low&seed=4207&efreeze=1&cam=-32,1.7,6,0,2.4,6.4';
const LEGACY_URL = 'http://127.0.0.1:4174/index.html' + LEVEL_QUERY;

async function capture(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  // Let the boot overlay finish fading and the showcase settle.
  await page.waitForTimeout(1_200);
  return page.screenshot({ animations: 'disabled' });
}

test('level showcase matches the legacy golden image', async ({ page }, testInfo) => {
  const sourcePng = await capture(page, '/' + LEVEL_QUERY);
  const legacyPng = await capture(page, LEGACY_URL);

  const source = PNG.sync.read(sourcePng);
  const legacy = PNG.sync.read(legacyPng);
  expect(source.width).toBe(legacy.width);
  expect(source.height).toBe(legacy.height);

  const diff = new PNG({ width: source.width, height: source.height });
  const changed = pixelmatch(source.data, legacy.data, diff.data, source.width, source.height, {
    threshold: 0.12,
    includeAA: false,
  });
  const diffRatio = changed / (source.width * source.height);

  await testInfo.attach('level-source', {
    body: sourcePng,
    contentType: 'image/png',
  });
  await testInfo.attach('level-legacy', {
    body: legacyPng,
    contentType: 'image/png',
  });
  await testInfo.attach('level-diff', {
    body: PNG.sync.write(diff),
    contentType: 'image/png',
  });

  expect(diffRatio).toBeLessThan(0.02);
});
