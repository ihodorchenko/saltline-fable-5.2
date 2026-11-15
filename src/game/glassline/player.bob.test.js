import { describe, expect, it } from 'vitest';
import { bobOffset } from './player.js';

describe('GLASSLINE head bob', () => {
  it('is zero when the player is not moving', () => {
    for (const state of [{ bobPhase: 2.7, bobAmount: 0 }, {}]) {
      const bob = bobOffset(state);
      expect(bob.x).toBeCloseTo(0, 6);
      expect(bob.y).toBeCloseTo(0, 6);
      expect(bob.roll).toBeCloseTo(0, 6);
    }
  });

  it('stays subtle even at full sprint amplitude', () => {
    let maxY = 0;
    let maxX = 0;
    let maxRoll = 0;
    for (let i = 0; i < 360; i += 1) {
      const bob = bobOffset({ bobPhase: i * 0.1, bobAmount: 1 });
      maxY = Math.max(maxY, Math.abs(bob.y));
      maxX = Math.max(maxX, Math.abs(bob.x));
      maxRoll = Math.max(maxRoll, Math.abs(bob.roll));
    }
    // About one centimetre of vertical travel and a third of a degree of roll:
    // enough to feel the body, not enough to obscure the route.
    expect(maxY).toBeLessThanOrEqual(0.013);
    expect(maxX).toBeLessThanOrEqual(0.008);
    expect(maxRoll).toBeLessThanOrEqual(0.004);
  });

  it('moves through a full cycle', () => {
    const samples = [];
    for (let i = 0; i <= 40; i += 1) {
      samples.push(bobOffset({ bobPhase: i * 0.08, bobAmount: 1 }).y);
    }
    expect(Math.max(...samples)).toBeGreaterThan(0.009);
    expect(Math.min(...samples)).toBeLessThan(-0.009);
  });

  it('clamps the amount so a state bug cannot shake the camera', () => {
    const bob = bobOffset({ bobPhase: 1, bobAmount: 12 });
    expect(Math.abs(bob.y)).toBeLessThanOrEqual(0.013);
    const negative = bobOffset({ bobPhase: 1, bobAmount: -3 });
    expect(negative).toEqual({ x: 0, y: 0, roll: 0 });
  });
});
