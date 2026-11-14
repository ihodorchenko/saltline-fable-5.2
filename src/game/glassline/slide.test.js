import { describe, expect, it } from 'vitest';
import {
  SLIDE_MAX_TIME,
  canStand,
  canStartSlide,
  slideEntrySpeed,
  slideSpeed,
} from './slide.js';

describe('slide rules', () => {
  it('requires ground and minimum speed', () => {
    expect(canStartSlide({ onGround: true, speed: 5 })).toBe(true);
    expect(canStartSlide({ onGround: false, speed: 5 })).toBe(false);
    expect(canStartSlide({ onGround: true, speed: 2.9 })).toBe(false);
    expect(canStartSlide({ onGround: true, speed: Infinity })).toBe(false);
  });

  it('boosts entry speed and decays with friction', () => {
    expect(slideEntrySpeed(0)).toBe(7.5);
    expect(slideEntrySpeed(6)).toBe(7.5);
    expect(slideSpeed(8, 0.1)).toBeCloseTo(7.3);
    expect(slideSpeed(1, 1)).toBe(0);
  });

  it('only stands when the ceiling clears the stand height', () => {
    expect(canStand(0.75, 1.8, 1.15)).toBe(true);
    expect(canStand(0.2, 1.8, 1.15)).toBe(false);
  });

  it('keeps a bounded slide duration', () => {
    expect(SLIDE_MAX_TIME).toBeLessThan(1);
  });
});
