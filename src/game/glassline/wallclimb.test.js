import { describe, expect, it } from 'vitest';
import {
  WALLCLIMB_MAX_TIME,
  WALLCLIMB_SPEED,
  canWallclimb,
} from './wallclimb.js';

const base = { distance: 0.5, normalY: 0, height: Infinity };

describe('wallclimb rules', () => {
  it('accepts a close tall wall', () => {
    expect(canWallclimb(base)).toBe(true);
    expect(canWallclimb({ ...base, height: 3 })).toBe(true);
  });

  it('rejects far walls, floor normals and low ledges', () => {
    expect(canWallclimb({ ...base, distance: 1.2 })).toBe(false);
    expect(canWallclimb({ ...base, normalY: 1 })).toBe(false);
    expect(canWallclimb({ ...base, height: 1.6 })).toBe(false);
  });

  it('keeps the climb short and slow', () => {
    expect(WALLCLIMB_MAX_TIME).toBeLessThan(1.2);
    expect(WALLCLIMB_SPEED).toBeGreaterThan(1);
    expect(WALLCLIMB_SPEED).toBeLessThan(3);
  });
});
