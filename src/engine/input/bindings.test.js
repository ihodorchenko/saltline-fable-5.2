import { describe, expect, it } from 'vitest';
import { actionKey, actionLegend, actionMeta, keyBindings } from './bindings.js';

describe('bindings', () => {
  it('keeps the default control remaps', () => {
    expect(keyBindings.KeyX).toBe('sprint');
    expect(keyBindings.ShiftLeft).toBe('fire');
    expect(keyBindings.KeyE).toBe('ads');
    expect(keyBindings.KeyF).toBe('interact');
    expect(keyBindings.KeyQ).toBe('melee');
    expect(keyBindings.Space).toBe('jump');
  });

  it('has display metadata for every action', () => {
    for (const action of new Set(Object.values(keyBindings))) {
      expect(actionMeta[action], action).toBeDefined();
    }
  });

  it('derives HUD labels from one table', () => {
    expect(actionKey('interact')).toBe('F');
    expect(actionKey('reload')).toBe('R');
    expect(actionLegend('fire')).toEqual(['LMB', 'Shift']);
    expect(actionLegend('ads')).toEqual(['RMB', 'E']);
  });
});
