import { describe, expect, it } from 'vitest';
import { GRAIN, TONE } from './textures.js';

describe('texture grain', () => {
  it('stays low so surfaces read as clean ceramic, not fabric', () => {
    for (const [name, amount] of Object.entries(GRAIN)) {
      expect(amount, `${name} grain`).toBeLessThanOrEqual(12);
      expect(amount, `${name} grain`).toBeGreaterThan(0);
    }
  });
});

describe('panel tone', () => {
  it('stays subtle so floors vary without turning blotchy', () => {
    expect(TONE.panel).toBeGreaterThan(0);
    expect(TONE.panel).toBeLessThanOrEqual(0.06);
  });
});
