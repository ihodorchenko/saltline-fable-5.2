import { describe, expect, it } from 'vitest';
import {
  createBindings,
  formatKey,
  normalizeBindings,
} from './bindings.js';

describe('glassline bindings', () => {
  it('has usable defaults', () => {
    const bindings = createBindings();
    expect(bindings.matches('KeyW', 'forward')).toBe(true);
    expect(bindings.matches('ArrowUp', 'forward')).toBe(true);
    expect(bindings.isDown('sprint', new Set(['ShiftLeft']))).toBe(true);
    expect(bindings.matches('Space', 'jump')).toBe(true);
  });

  it('rebinds and rejects conflicts', () => {
    const bindings = createBindings();
    expect(bindings.set('forward', 'KeyI')).toEqual({ ok: true });
    expect(bindings.matches('KeyW', 'forward')).toBe(false);
    expect(bindings.matches('KeyI', 'forward')).toBe(true);
    expect(bindings.set('jump', 'KeyI')).toEqual({
      ok: false,
      conflict: 'forward',
    });
  });

  it('formats key labels and normalizes stored data', () => {
    expect(formatKey('KeyW')).toBe('W');
    expect(formatKey('ShiftLeft')).toBe('SHIFT');
    expect(formatKey('ArrowUp')).toBe('↑');
    const normalized = normalizeBindings({ forward: ['KeyI'] });
    expect(normalized.forward).toEqual(['KeyI']);
    expect(normalized.jump).toEqual(['Space']);
  });
});
