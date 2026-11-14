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
      'finish',
    ]);
    const z = tutorialLevel.checkpoints.map((checkpoint) => checkpoint.pos[2]);
    expect(z).toEqual([...z].sort((a, b) => b - a));
    expect(tutorialLevel.platforms.some((platform) => platform.id === 'climb-landing')).toBe(true);
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
