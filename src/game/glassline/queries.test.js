import { describe, expect, it } from 'vitest';
import {
  COYOTE_TIME,
  MAX_SLOPE,
  coyoteActive,
  isWalkableGround,
  ledgeInfo,
} from './queries.js';

describe('glassline queries', () => {
  it('accepts floors up to the slope limit', () => {
    expect(isWalkableGround({ x: 0, y: 1, z: 0 })).toBe(true);
    expect(
      isWalkableGround({ x: 0, y: Math.cos(MAX_SLOPE), z: 0 }),
    ).toBe(true);
    expect(isWalkableGround({ x: 0, y: 0.3, z: 0 })).toBe(false);
    expect(isWalkableGround(null)).toBe(false);
  });

  it('classifies reachable ledges', () => {
    expect(
      ledgeInfo({ point: { y: 1.4 }, normal: { y: 1 } }, 0),
    ).toEqual({ height: 1.4, walkable: true });
    expect(
      ledgeInfo({ point: { y: 3.5 }, normal: { y: 1 } }, 0),
    ).toBeNull();
    expect(ledgeInfo(null, 0)).toBeNull();
  });

  it('keeps coyote time bounded', () => {
    expect(coyoteActive(0)).toBe(true);
    expect(coyoteActive(COYOTE_TIME)).toBe(true);
    expect(coyoteActive(COYOTE_TIME + 0.01)).toBe(false);
    expect(coyoteActive(-1)).toBe(false);
  });
});
