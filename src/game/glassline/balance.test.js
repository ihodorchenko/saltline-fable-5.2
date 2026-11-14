import { describe, expect, it } from 'vitest';
import {
  BALANCE_LATERAL_SPEED,
  BALANCE_ROLL,
  balanceRoll,
  isBalanceSurface,
} from './balance.js';

describe('balance rules', () => {
  it('recognises balance-tagged surfaces', () => {
    expect(isBalanceSurface('balance')).toBe(true);
    expect(isBalanceSurface('concrete')).toBe(false);
    expect(isBalanceSurface('')).toBe(false);
  });

  it('maps lateral input to a small camera lean', () => {
    expect(balanceRoll(1)).toBe(BALANCE_ROLL);
    expect(balanceRoll(-1)).toBe(-BALANCE_ROLL);
    expect(balanceRoll(4)).toBe(BALANCE_ROLL);
    expect(balanceRoll(0)).toBe(0);
  });

  it('keeps lateral correction modest', () => {
    expect(BALANCE_LATERAL_SPEED).toBeGreaterThan(1);
    expect(BALANCE_LATERAL_SPEED).toBeLessThan(3);
  });
});
