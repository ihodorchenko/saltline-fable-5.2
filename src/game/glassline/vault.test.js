import { describe, expect, it } from 'vitest';
import {
  VAULT_DURATION,
  VAULT_MAX_HEIGHT,
  canVault,
} from './vault.js';

const base = { onGround: true, speed: 5, height: 0.8, distance: 1.2 };

describe('vault rules', () => {
  it('accepts a waist-height obstacle at speed', () => {
    expect(canVault(base)).toBe(true);
  });

  it('rejects air, slow and too-tall cases', () => {
    expect(canVault({ ...base, onGround: false })).toBe(false);
    expect(canVault({ ...base, speed: 2 })).toBe(false);
    expect(canVault({ ...base, height: VAULT_MAX_HEIGHT + 0.1 })).toBe(false);
    expect(canVault({ ...base, distance: 2 })).toBe(false);
    expect(canVault({ ...base, height: 0.2 })).toBe(false);
  });

  it('has a short readable duration', () => {
    expect(VAULT_DURATION).toBeGreaterThan(0.2);
    expect(VAULT_DURATION).toBeLessThan(0.6);
  });
});
