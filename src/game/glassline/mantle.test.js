import { describe, expect, it } from 'vitest';
import {
  MANTLE_DURATION,
  MANTLE_MAX_HEIGHT,
  canMantle,
} from './mantle.js';

const base = { height: 1.6, distance: 1.1, onGround: true };

describe('mantle rules', () => {
  it('accepts a reachable high ledge', () => {
    expect(canMantle(base)).toBe(true);
  });

  it('rejects low, too-high, far and airborne cases', () => {
    expect(canMantle({ ...base, height: 0.8 })).toBe(false);
    expect(canMantle({ ...base, height: MANTLE_MAX_HEIGHT + 0.1 })).toBe(false);
    expect(canMantle({ ...base, distance: 2 })).toBe(false);
    expect(canMantle({ ...base, onGround: false })).toBe(false);
  });

  it('has a readable duration', () => {
    expect(MANTLE_DURATION).toBeGreaterThan(0.3);
    expect(MANTLE_DURATION).toBeLessThan(0.9);
  });
});
