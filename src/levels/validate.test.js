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
