import { describe, expect, it } from 'vitest';
import { tutorialLevel } from './tutorial.js';
import { validateLevel } from './validate.js';

describe('tutorial level data', () => {
  it('is valid', () => {
    expect(validateLevel(tutorialLevel)).toEqual([]);
  });

  it('has a finish and ordered checkpoints', () => {
    expect(tutorialLevel.finish.pos).toHaveLength(3);
    expect(tutorialLevel.checkpoints.length).toBeGreaterThan(3);
    expect(tutorialLevel.checkpoints[0].id).toBe('start');
  });

  it('covers every mechanic in route order', () => {
    const ids = tutorialLevel.checkpoints.map((checkpoint) => checkpoint.id);
    expect(ids).toEqual([
      'start',
      'jump',
      'slide',
      'vault',
      'mantle',
      'wallrun',
      'wallclimb',
      'balance',
      'drop',
      'act1-end',
      'act2',
      'slide2',
      'vault2',
      'mantle2',
      'wallrun2',
      'balance2',
      'drop2',
      'final-a',
      'final-b',
      'final-c',
      'finish',
    ]);
    const z = tutorialLevel.checkpoints.map((checkpoint) => checkpoint.pos[2]);
    expect(z).toEqual([...z].sort((a, b) => b - a));
    const platformIds = tutorialLevel.platforms.map((platform) => platform.id);
    expect(platformIds).toContain('summit-roof');
    expect(platformIds).toContain('courtyard-floor');
    expect(platformIds).toContain('branch-high-walk');
  });

  it('is a full-length multi-level tutorial route', () => {
    const meters = tutorialLevel.checkpoints.reduce((sum, checkpoint, index) => {
      if (index === 0) return sum;
      const previous = tutorialLevel.checkpoints[index - 1];
      return sum + Math.hypot(checkpoint.pos[0] - previous.pos[0], checkpoint.pos[2] - previous.pos[2]);
    }, 0);
    expect(meters).toBeGreaterThan(180);
    const surfaces = tutorialLevel.platforms.map((platform) => platform.pos[1] + platform.size[1] / 2);
    expect(Math.min(...surfaces)).toBeLessThan(-5);
    expect(Math.max(...surfaces)).toBeGreaterThan(11);
    expect(Math.max(...surfaces) - Math.min(...surfaces)).toBeGreaterThan(15);
  });

  it('keeps the HUD act boundaries on checkpoint indexes 10 and 17', () => {
    // hud/game code hardcodes the act switch at those indexes; the 3 in-world
    // act signs therefore have to line up with them.
    expect(tutorialLevel.checkpoints[10].id).toBe('act2');
    expect(tutorialLevel.checkpoints[17].id).toBe('final-a');
    expect(tutorialLevel.acts).toHaveLength(3);
  });

  it('rejects malformed levels', () => {
    expect(validateLevel(null)).toHaveLength(1);
    expect(validateLevel({ spawn: {}, platforms: [], checkpoints: [] })).not.toEqual([]);
    expect(
      validateLevel({
        ...tutorialLevel,
        checkpoints: [...tutorialLevel.checkpoints, tutorialLevel.checkpoints[0]],
      }),
    ).toContain('duplicate id: start');
  });
});
