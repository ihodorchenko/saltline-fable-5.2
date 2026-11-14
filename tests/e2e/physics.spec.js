import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

test('physics raycast and line-of-sight hit an added AABB', async ({ page }) => {
  await boot(page, '?autostart=1&q=low');

  const result = await page.evaluate(() => {
    const game = window.__G;
    const { Vector3 } = game.THREE;
    const box = game.physics.addBox([1000, 5, 1000], [1002, 7, 1002], {
      surface: 'probe',
    });
    try {
      const origin = new Vector3(1001, 10, 1001);
      const direction = new Vector3(0, -1, 0);
      const hit = game.physics.raycast(origin, direction, 40);
      const clear = game.physics.lineOfSight(origin, new Vector3(1001, 0, 1001));
      return {
        hit: hit
          ? {
              dist: hit.dist,
              surface: hit.surface,
              normal: [hit.normal.x, hit.normal.y, hit.normal.z],
              point: [hit.point.x, hit.point.y, hit.point.z],
            }
          : null,
        clear,
      };
    } finally {
      game.physics.removeBox(box);
    }
  });

  expect(result.hit).not.toBeNull();
  expect(result.hit.surface).toBe('probe');
  expect(result.hit.dist).toBeCloseTo(3, 5);
  expect(result.hit.normal).toEqual([0, 1, 0]);
  expect(result.hit.point[1]).toBeCloseTo(7, 5);
  expect(result.clear).toBe(false);
});
