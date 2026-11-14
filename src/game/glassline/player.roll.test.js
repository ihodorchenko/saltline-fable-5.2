import { describe, expect, it } from 'vitest';
import { cameraRollTarget } from './player.js';

describe('GLASSLINE camera roll', () => {
  it('leans into strafe input', () => {
    expect(cameraRollTarget({ tiltInput: 0.045 })).toBeCloseTo(0.045);
    expect(cameraRollTarget({ tiltInput: -0.045 })).toBeCloseTo(-0.045);
  });

  it('uses stronger weight transfer for vault, slide and wallrun', () => {
    expect(cameraRollTarget({ vaulting: true, tiltInput: 0 })).toBe(-0.14);
    expect(cameraRollTarget({ sliding: true, tiltInput: 0 })).toBe(0.08);
    expect(
      cameraRollTarget({ wallrunning: true, rollTarget: 0.08 }),
    ).toBe(0.08);
  });

  it('adds a small running sway only on the ground', () => {
    const grounded = cameraRollTarget(
      { onGround: true, speed: 7, tiltInput: 0 },
      0,
    );
    expect(Math.abs(grounded)).toBeGreaterThan(0.01);
    expect(cameraRollTarget({ onGround: false, speed: 7 }, 0)).toBe(0);
  });
});
