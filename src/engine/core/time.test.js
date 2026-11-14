import { describe, expect, it } from 'vitest';
import { advanceTime, createTime } from './time.js';

describe('time', () => {
  it('starts at zero', () => {
    expect(createTime()).toEqual({ t: 0, dt: 0, frame: 0, real: 0 });
  });

  it('clamps raw deltas and advances the clock', () => {
    const time = createTime();
    expect(advanceTime(time, 0.02, 1000)).toBe(0.02);
    expect(advanceTime(time, 0.1, 1100)).toBe(0.05);
    expect(time).toEqual({ t: 0.07, dt: 0.05, frame: 2, real: 1.1 });
  });

  it('honours a fixed timestep override', () => {
    const time = createTime();
    expect(advanceTime(time, 0.1, 1200, '0.2')).toBe(0.2);
    expect(time).toEqual({ t: 0.2, dt: 0.2, frame: 1, real: 1.2 });
  });
});
