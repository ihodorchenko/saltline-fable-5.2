import { describe, expect, it } from 'vitest';
import {
  ROLL_DURATION,
  ROLL_RETENTION,
  canRoll,
} from './roll.js';

describe('roll rules', () => {
  it('requires speed and a real fall', () => {
    expect(canRoll({ speed: 5, fallingSpeed: -4 })).toBe(true);
    expect(canRoll({ speed: 3, fallingSpeed: -4 })).toBe(false);
    expect(canRoll({ speed: 5, fallingSpeed: -1 })).toBe(false);
  });

  it('keeps most horizontal momentum', () => {
    expect(ROLL_RETENTION).toBeGreaterThan(0.7);
    expect(ROLL_RETENTION).toBeLessThan(1);
  });

  it('is a short action', () => {
    expect(ROLL_DURATION).toBeGreaterThan(0.25);
    expect(ROLL_DURATION).toBeLessThan(0.8);
  });
});
