import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './events.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createEvents', () => {
  it('calls handlers in registration order and unsubscribes', () => {
    const events = createEvents();
    const calls = [];
    const off = events.on('x', (value) => calls.push(`a${value}`));
    events.on('x', (value) => calls.push(`b${value}`));
    events.emit('x', 1);
    off();
    events.emit('x', 2);
    expect(calls).toEqual(['a1', 'b1', 'b2']);
  });

  it('isolates a throwing handler', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events = createEvents();
    const calls = [];
    events.on('x', () => calls.push('a'));
    events.on('x', () => {
      throw new Error('boom');
    });
    events.on('x', () => calls.push('b'));
    expect(() => events.emit('x')).not.toThrow();
    expect(calls).toEqual(['a', 'b']);
    expect(error).toHaveBeenCalledOnce();
  });

  it('ignores unknown events and handlers', () => {
    const events = createEvents();
    expect(() => events.emit('missing', {})).not.toThrow();
    expect(() => events.off('missing', () => {})).not.toThrow();
  });
});
