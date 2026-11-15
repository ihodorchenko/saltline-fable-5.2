import { describe, expect, it } from 'vitest';
import { SIGN, drawSignPlate } from './signs.js';

function recorder() {
  const calls = [];
  const context = {
    fillRect: (...a) => calls.push(['fillRect', context.fillStyle, ...a]),
    strokeRect: (...a) => calls.push(['strokeRect', context.strokeStyle, ...a]),
  };
  return { context, calls };
}

describe('drawSignPlate', () => {
  it('paints an ivory plate first, never dark glass', () => {
    const { context, calls } = recorder();
    drawSignPlate(context, 512, 144);
    expect(calls[0]).toEqual(['fillRect', SIGN.plate, 0, 0, 512, 144]);
  });

  it('adds a red rule across the top', () => {
    const { context, calls } = recorder();
    drawSignPlate(context, 1024, 160);
    const rule = calls.find((c) => c[0] === 'fillRect' && c[1] === SIGN.rule);
    expect(rule).toBeTruthy();
    expect(rule[2]).toBe(0);
    expect(rule[3]).toBe(0);
    expect(rule[4]).toBe(1024);
    expect(rule[5]).toBeGreaterThanOrEqual(4);
  });

  it('keeps ink dark enough to read on the plate', () => {
    expect(SIGN.ink).toBe('#0b0f12');
    expect(SIGN.plate.toLowerCase()).toBe('#f2eee3');
  });
});
