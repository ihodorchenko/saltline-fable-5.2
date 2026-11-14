import { describe, expect, it } from 'vitest';
import { targetFov } from './player.js';

describe('GLASSLINE camera FOV', () => {
  it('uses a calm base FOV while idle and normal running', () => {
    expect(targetFov({ sliding: false, sprinting: false, speed: 0 })).toBe(75);
    expect(targetFov({ sliding: false, sprinting: false, speed: 5 })).toBe(75);
  });

  it('widens for sprint and slide', () => {
    expect(targetFov({ sprinting: true, speed: 5.4 })).toBe(75);
    expect(targetFov({ sprinting: true, speed: 7.2 })).toBe(84);
    expect(targetFov({ sliding: true, sprinting: true, speed: 7.2 })).toBe(88);
  });
});
