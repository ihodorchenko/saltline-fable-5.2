import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  QUALITY_LEVELS,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  loadSettings,
  saveSettings,
} from './index.js';

function createStorage(initial) {
  const values = new Map(initial ? [[SETTINGS_KEY, initial]] : []);
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    raw: () => values.get(SETTINGS_KEY),
  };
}

describe('settings', () => {
  it('returns defaults with an optional FOV override', () => {
    expect(loadSettings(undefined, createStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(70, createStorage())).toEqual({
      ...DEFAULT_SETTINGS,
      fov: 70,
    });
  });

  it('migrates an unversioned legacy payload', () => {
    const storage = createStorage(
      JSON.stringify({ quality: 'high', sens: 9, invertY: 1, volume: -1, fov: 200 }),
    );
    expect(loadSettings(70, storage)).toEqual({
      quality: 'high',
      sens: 3,
      invertY: true,
      volume: 0,
      fov: 95,
    });
  });

  it('writes a versioned payload and reads it back', () => {
    const storage = createStorage();
    const settings = {
      quality: 'low',
      sens: 0.5,
      invertY: false,
      volume: 0.25,
      fov: 80,
    };
    expect(saveSettings(settings, storage)).toBe(true);
    expect(JSON.parse(storage.raw())).toEqual({
      ...settings,
      version: SETTINGS_VERSION,
    });
    expect(loadSettings(74, storage)).toEqual(settings);
  });

  it('falls back on corrupt JSON and accepts only known quality values', () => {
    expect(loadSettings(74, createStorage('{bad'))).toEqual(DEFAULT_SETTINGS);
    const storage = createStorage(JSON.stringify({ quality: 'potato' }));
    expect(loadSettings(74, storage).quality).toBe('auto');
    expect(QUALITY_LEVELS).toContain('ultra');
  });

  it('does not throw without storage', () => {
    expect(loadSettings(74, null)).toEqual({ ...DEFAULT_SETTINGS, fov: 74 });
    expect(saveSettings(DEFAULT_SETTINGS, null)).toBe(false);
  });
});
