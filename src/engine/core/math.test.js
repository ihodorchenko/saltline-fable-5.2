import { describe, expect, it } from 'vitest';
import { clamp, clamp01, damp, lerp, smoothstep } from './math.js';

describe('math', () => {
  it('clamps to a range', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-2, 1, 3)).toBe(1);
    expect(clamp(2, 1, 3)).toBe(2);
  });

  it('interpolates', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('clamps to unit range and smoothsteps', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(smoothstep(0, 10, -1)).toBe(0);
    expect(smoothstep(0, 10, 11)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBe(0.5);
  });

  it('damps toward the target', () => {
    expect(damp(10, 0, 6, 0)).toBe(10);
    expect(damp(10, 0, 6, 1)).toBeCloseTo(10 * Math.exp(-6), 12);
    expect(damp(10, 0, 6, 100)).toBeCloseTo(0, 10);
  });
});
