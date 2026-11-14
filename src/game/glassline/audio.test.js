import { describe, expect, it } from 'vitest';
import { audioMotion, clampVolume, landingPower } from './audio.js';

describe('glassline audio settings', () => {
  it('clamps volume to a safe range', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0.55)).toBe(0.55);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume('nope')).toBe(0);
  });

  it('maps landing impact to a bounded intensity', () => {
    expect(landingPower(-2)).toBe(0.3);
    expect(landingPower(-14)).toBe(1);
    expect(landingPower(-7)).toBeCloseTo(0.5);
    expect(landingPower('bad')).toBe(0.3);
  });

  it('opens the wind and synth with speed and finale', () => {
    const idle = audioMotion(0);
    const sprint = audioMotion(12);
    const finale = audioMotion(0, true);
    expect(sprint.windGain).toBeGreaterThan(idle.windGain);
    expect(sprint.windFrequency).toBeGreaterThan(idle.windFrequency);
    expect(sprint.musicCutoff).toBeGreaterThan(idle.musicCutoff);
    expect(finale.windGain).toBeGreaterThan(0.04);
    expect(finale.musicCutoff).toBeLessThan(sprint.musicCutoff);
  });
});
