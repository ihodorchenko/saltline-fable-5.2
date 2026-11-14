import { describe, expect, it, vi } from 'vitest';
import { createModes } from './index.js';

const moduleStub = () => ({ create: vi.fn(), showcase: vi.fn() });
const modules = {
  level: moduleStub(),
  backdrop: moduleStub(),
  ground: moduleStub(),
  fx: moduleStub(),
  weapon: moduleStub(),
  enemies: moduleStub(),
  props: moduleStub(),
  render: moduleStub(),
};

describe('modes', () => {
  it('resolves campaign, showcase and bench', () => {
    const modes = createModes(modules);
    expect(modes.resolve({}, '')).toEqual({
      kind: 'campaign',
      bench: false,
      showcase: null,
    });
    expect(modes.resolve({ show: 'level' }, '')).toEqual({
      kind: 'showcase',
      bench: false,
      showcase: 'level',
    });
    expect(modes.resolve({ show: 'missing' }, '').kind).toBe('campaign');
    expect(modes.resolve({ bench: '1' }, '').kind).toBe('bench');
    expect(modes.resolve({}, '#bench').kind).toBe('bench');
  });

  it('exposes the showcase registry', () => {
    const modes = createModes(modules);
    expect(Object.keys(modes.showcases)).toEqual([
      'mats',
      'level',
      'backdrop',
      'ground',
      'fx',
      'weapon',
      'enemies',
      'props',
      'render',
    ]);
    expect(modes.showcases.mats).toEqual({});
  });
});
