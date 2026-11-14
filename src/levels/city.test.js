import { describe, expect, it } from 'vitest';
import { tutorialLevel } from './tutorial.js';
import { ACCENT_COLORS, createCityPlan } from './city.js';

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
    expect(plan.abyssY).toBeLessThan(-100);
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

/** @param {number} hex @returns {{h: number, s: number, l: number}} */
function hsl(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

describe('GLASSLINE city palette', () => {
  it('keeps accent towers muted so red stays the route colour', () => {
    for (const hex of ACCENT_COLORS) {
      const { h, s, l } = hsl(hex);
      expect(s, `0x${hex.toString(16)} saturation`).toBeLessThanOrEqual(0.3);
      expect(l, `0x${hex.toString(16)} lightness`).toBeGreaterThanOrEqual(0.45);
      const redHued = h <= 20 || h >= 340;
      expect(redHued && s > 0.15, `0x${hex.toString(16)} red-hued`).toBe(false);
    }
  });
});
