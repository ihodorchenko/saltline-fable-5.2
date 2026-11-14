import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('generated city surrounds the route without blocking it', async ({ page }, testInfo) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  const city = await page.evaluate(() => {
    const group = window.__G.scene.getObjectByName('glassline-city');
    const byName = (name) => group?.getObjectByName(name);
    return {
      stats: window.__G.glassline.city,
      group: !!group,
      buildings: byName('city-buildings')?.count || 0,
      windows: byName('city-windows')?.count || 0,
      signs: group?.children.filter((child) => child.name === 'city-sign').length || 0,
      transit: byName('city-transit-track')?.count || 0,
      street: !!byName('city-street'),
      cityTexture: !!byName('city-buildings')?.material?.map,
      spire: !!window.__G.scene.getObjectByName('city-spire'),
      roofTexture: !!window.__G.glassline.root.getObjectByName('platform-start-roof')?.material?.[2]?.map,
      routeZ: window.__G.glassline.controller.getState().pos.z,
    };
  });
  expect(city.group).toBe(true);
  expect(city.street).toBe(true);
  expect(city.cityTexture).toBe(true);
  expect(city.spire).toBe(true);
  expect(city.roofTexture).toBe(true);
  expect(city.stats.buildings).toBeGreaterThan(50);
  expect(city.buildings).toBeGreaterThan(50);
  expect(city.windows).toBeGreaterThan(200);
  expect(city.signs).toBe(2);
  expect(city.transit).toBeGreaterThan(2);
  expect(city.routeZ).toBeCloseTo(10, 0);
  await page.screenshot({
    path: 'artifacts/glassline-city-generated.png',
    animations: 'disabled',
  });
  await testInfo.attach('generated-city', {
    path: 'artifacts/glassline-city-generated.png',
    contentType: 'image/png',
  });
});
