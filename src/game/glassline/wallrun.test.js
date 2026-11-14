import { describe, expect, it } from 'vitest';
import {
  WALLRUN_MAX_TIME,
  WALLRUN_MIN_SPEED,
  WALLRUN_ROLL,
  canWallrun,
} from './wallrun.js';

const base = { airborne: true, speed: 5.4, wallDistance: 0.4, normalY: 0 };

describe('wallrun rules', () => {
  it('accepts a fast airborne player beside a wall', () => {
    expect(canWallrun(base)).toBe(true);
  });

  it('rejects ground, slow, far and floor/ceiling normals', () => {
    expect(canWallrun({ ...base, airborne: false })).toBe(false);
    expect(canWallrun({ ...base, speed: WALLRUN_MIN_SPEED - 0.1 })).toBe(false);
    expect(canWallrun({ ...base, wallDistance: 1.2 })).toBe(false);
    expect(canWallrun({ ...base, normalY: 1 })).toBe(false);
  });

  it('keeps a bounded duration and readable roll', () => {
    expect(WALLRUN_MAX_TIME).toBeLessThan(2);
    expect(WALLRUN_ROLL).toBeGreaterThan(0.2);
    expect(WALLRUN_ROLL).toBeLessThan(0.45);
  });
});
