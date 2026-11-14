import { describe, expect, it } from 'vitest';
import { GRAIN } from './textures.js';

describe('texture grain', () => {
  it('stays low so surfaces read as clean ceramic, not fabric', () => {
    for (const [name, amount] of Object.entries(GRAIN)) {
      expect(amount, `${name} grain`).toBeLessThanOrEqual(12);
      expect(amount, `${name} grain`).toBeGreaterThan(0);
    }
  });
});
