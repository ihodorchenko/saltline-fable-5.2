import { describe, expect, it } from 'vitest';
import { tutorialLevel } from './tutorial.js';
import { createCityPlan } from './city.js';

describe('GLASSLINE city plan', () => {
  it('is deterministic', () => {
    const a = createCityPlan(tutorialLevel);
    const b = createCityPlan(tutorialLevel);
    expect(a.buildings.length).toBe(b.buildings.length);
    expect(a.buildings[0]).toEqual(b.buildings[0]);
  });

  it('keeps the route corridor clear', () => {
    const plan = createCityPlan(tutorialLevel);
    for (const building of plan.buildings) {
      expect(Math.abs(building.x) - building.w / 2).toBeGreaterThanOrEqual(plan.corridor);
    }
    expect(plan.landmarks.length).toBeGreaterThan(0);
    expect(plan.bridges.length).toBeGreaterThan(0);
    expect(plan.spire).toBeTruthy();
    expect(plan.backdrop.length).toBeGreaterThan(100);
    const all = [...plan.buildings, ...plan.landmarks];
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
        const oz = (a.d + b.d) / 2 - Math.abs(a.z - b.z);
        expect(ox <= 0 || oz <= 0).toBe(true);
      }
    }
  });

  it('has enough mass for a city district', () => {
    const plan = createCityPlan(tutorialLevel);
    expect(plan.buildings.length).toBeGreaterThan(50);
    expect(plan.lights.length).toBeGreaterThan(20);
    expect(plan.distant.length).toBeGreaterThan(10);
  });
});
