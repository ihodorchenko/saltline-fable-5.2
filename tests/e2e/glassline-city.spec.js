import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('generated city surrounds the route without blocking it', async ({ page }, testInfo) => {
  await boot(page, '?show=glassline-tutorial&q=low&autostart=1');
  const city = await page.evaluate(() => {
    const group = window.__G.scene.getObjectByName('glassline-city');
    const byName = (name) => group?.getObjectByName(name);
    const bodies = byName('city-buildings');
    return {
      stats: window.__G.glassline.city,
      group: !!group,
      buildings: bodies?.children?.reduce((sum, child) => sum + (child.count || 0), 0) || 0,
      windows: byName('city-windows')?.count || 0,
      signs: group?.children.filter((child) => child.name === 'city-sign').length || 0,
      transit: byName('city-transit-track')?.count || 0,
      abyss: !!byName('city-abyss'),
      street: !!byName('city-street'),
      sky: !!window.__G.scene.getObjectByName('glassline-high-key-sky'),
      environment: !!window.__G.scene.environment,
      bloom: window.__G.render.tune?.bloom || 0,
      bloomThreshold: window.__G.render.tune?.bloomThreshold || 0,
      skyFollowsCamera:
        window.__G.scene
          .getObjectByName('glassline-high-key-sky')
          ?.position.distanceTo(window.__G.camera.position) < 1,
      cityTexture: !!bodies?.children?.some((child) => child.material?.map),
      spire: !!window.__G.scene.getObjectByName('city-spire'),
      backdrop: byName('city-backdrop')?.count || 0,
      roofTexture: !!window.__G.glassline.root.getObjectByName('platform-start-roof')?.material?.[2]?.map,
      routeZ: window.__G.glassline.controller.getState().pos.z,
    };
  });
  expect(city.group).toBe(true);
  expect(city.abyss).toBe(true);
  expect(city.street).toBe(false);
  expect(city.sky).toBe(true);
  expect(city.environment).toBe(true);
  expect(city.bloom).toBeGreaterThan(0);
  expect(city.bloomThreshold).toBeGreaterThan(1);
  expect(city.skyFollowsCamera).toBe(true);
  expect(city.cityTexture).toBe(true);
  expect(city.spire).toBe(true);
  expect(city.backdrop).toBeGreaterThan(100);
  expect(city.roofTexture).toBe(true);
  expect(city.stats.buildings).toBeGreaterThan(50);
  expect(city.buildings).toBeGreaterThan(50);
  expect(city.windows).toBeGreaterThan(200);
  expect(city.signs).toBe(3);
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
