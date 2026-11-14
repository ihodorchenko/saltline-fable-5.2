import { describe, expect, it } from 'vitest';
import { CONTACT, contactFootprint } from './contact.js';

const slab = { minX: -5, maxX: 5, minZ: -3, maxZ: 3 };

describe('contactFootprint', () => {
  it('grows by the full margin when there is room', () => {
    const f = contactFootprint({ x: 0, z: 0, w: 1, d: 1 }, slab);
    expect(f.w).toBeCloseTo(1 + CONTACT.margin * 2);
    expect(f.d).toBeCloseTo(1 + CONTACT.margin * 2);
  });

  it('never reaches past the slab edge and stays centred on the prop', () => {
    const prop = { x: 4.1, z: 0, w: 1.6, d: 1 };
    const f = contactFootprint(prop, slab);
    expect(f.x).toBe(prop.x);
    expect(f.x + f.w / 2).toBeLessThanOrEqual(slab.maxX + 1e-9);
    expect(f.x - f.w / 2).toBeGreaterThanOrEqual(slab.minX - 1e-9);
  });

  it('degrades to the bare footprint for props flush with the edge', () => {
    const f = contactFootprint({ x: 4.2, z: 0, w: 1.6, d: 1 }, slab);
    expect(f.w).toBeCloseTo(1.6);
  });
});
