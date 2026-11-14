import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('reproduces the legacy seed sequence', () => {
    const rng = createRng(4207);
    expect(Array.from({ length: 5 }, () => rng())).toEqual([
      0.13735605729743838, 0.29776155576109886, 0.4384602855425328, 0.8275199378840625, 0.3013846904505044,
    ]);
  });

  it('keeps range/int/pick/sign deterministic', () => {
    const rng = createRng(4207);
    for (let i = 0; i < 5; i++) rng();
    expect(rng.range(10, 20)).toBe(15.631244271062315);
    expect(rng.int(1, 6)).toBe(6);
    expect(rng.pick(['a', 'b', 'c'])).toBe('a');
    expect(rng.sign()).toBe(1);
  });

  it('forks into an independent deterministic stream', () => {
    const parent = createRng(4207);
    const child = parent.fork();
    expect([child(), child()]).toEqual([0.8138267344329506, 0.1089367545209825]);
    expect(parent()).toBe(0.29776155576109886);
  });
});
