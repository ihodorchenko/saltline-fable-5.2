import { describe, expect, it } from 'vitest';
import { STRIPE, edgeStripes } from './floor.js';

const slab = { minX: -6, maxX: 6, minZ: -9, maxZ: 9 };

describe('edgeStripes', () => {
  it('makes a four-sided frame inset from the edge', () => {
    const stripes = edgeStripes(slab);
    expect(stripes).toHaveLength(4);
    for (const s of stripes) {
      expect(s.x - s.w / 2).toBeGreaterThanOrEqual(slab.minX + STRIPE.inset - STRIPE.width);
      expect(s.x + s.w / 2).toBeLessThanOrEqual(slab.maxX - STRIPE.inset + STRIPE.width);
      expect(s.z - s.d / 2).toBeGreaterThanOrEqual(slab.minZ + STRIPE.inset - STRIPE.width);
      expect(s.z + s.d / 2).toBeLessThanOrEqual(slab.maxZ - STRIPE.inset + STRIPE.width);
    }
  });

  it('keeps stripes thin and clear of rooftop props', () => {
    // Props sit at least 0.4 m from the edge (hut), so the whole stripe stays outside them.
    expect(STRIPE.inset + STRIPE.width / 2).toBeLessThan(0.4);
    expect(STRIPE.width).toBeLessThanOrEqual(0.1);
  });

  it('does not overlap at the corners', () => {
    const [top, bottom, left, right] = edgeStripes(slab);
    const topEdgeZ = top.z + top.d / 2;
    const leftStartZ = left.z - left.d / 2;
    expect(leftStartZ).toBeGreaterThanOrEqual(topEdgeZ - 1e-9);
    expect(bottom.z - bottom.d / 2).toBeGreaterThanOrEqual(left.z + left.d / 2 - 1e-9);
    expect(right.d).toBeCloseTo(left.d);
  });

  it('returns nothing for slabs too small to hold a frame', () => {
    expect(edgeStripes({ minX: 0, maxX: 0.9, minZ: 0, maxZ: 5 })).toEqual([]);
  });
});
