import { describe, expect, it } from 'vitest';
import { clampVolume } from './audio.js';

describe('glassline audio settings', () => {
  it('clamps volume to a safe range', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0.55)).toBe(0.55);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume('nope')).toBe(0);
  });
});
