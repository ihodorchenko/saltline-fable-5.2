import { describe, expect, it } from 'vitest';
import { SUN_DIRECTION } from './sun.js';

describe('SUN_DIRECTION', () => {
  it('points above the horizon and ahead along the route (-z)', () => {
    const [, y, z] = SUN_DIRECTION;
    expect(y).toBeGreaterThan(0);
    expect(z).toBeLessThan(0);
  });

  it('is a usable, non-zero vector', () => {
    expect(Math.hypot(...SUN_DIRECTION)).toBeGreaterThan(0.5);
  });
});
