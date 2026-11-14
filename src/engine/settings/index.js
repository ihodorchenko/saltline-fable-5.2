// Versioned player settings: defaults, validation, migration and persistence.
// The storage key stays compatible with the original v1 payload; new writes add
// a version marker and old unversioned payloads migrate through v0 -> v1.

export const SETTINGS_KEY = 'saltline.settings.v1';
export const SETTINGS_VERSION = 1;
export const QUALITY_LEVELS = Object.freeze(['low', 'medium', 'high', 'ultra']);
export const DEFAULT_SETTINGS = Object.freeze({
  quality: 'auto',
  sens: 1,
  invertY: false,
  volume: 0.8,
  fov: 74,
});

// Each entry migrates a payload from that version to the next. v0 is the
// original unversioned JSON (no version field); v1 only adds the marker.
const MIGRATIONS = {
  0: (data) => ({ ...data }),
};

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  let data = { ...raw };
  let version = Number.isInteger(data.version) ? data.version : 0;
  while (version < SETTINGS_VERSION) {
    const step = MIGRATIONS[version];
    if (step) data = step(data);
    version++;
  }
  return data;
}

function normalize(raw, defaultFov) {
  const defaults = { ...DEFAULT_SETTINGS };
  if (defaultFov != null) defaults.fov = defaultFov;
  if (!raw || typeof raw !== 'object') return defaults;

  const settings = { ...defaults };
  if (raw.quality === 'auto' || QUALITY_LEVELS.includes(raw.quality)) settings.quality = raw.quality;
  if (Number.isFinite(raw.sens)) settings.sens = Math.min(3, Math.max(0.2, raw.sens));
  settings.invertY = !!raw.invertY;
  if (Number.isFinite(raw.volume)) settings.volume = Math.min(1, Math.max(0, raw.volume));
  if (Number.isFinite(raw.fov)) settings.fov = Math.min(95, Math.max(60, raw.fov));
  return settings;
}

/**
 * @param {number} [defaultFov]
 * @param {Storage} [storage]
 * @returns {{quality: string, sens: number, invertY: boolean, volume: number, fov: number}}
 */
export function loadSettings(defaultFov, storage) {
  const target = getStorage(storage);
  if (!target) return normalize(null, defaultFov);
  try {
    const raw = JSON.parse(target.getItem(SETTINGS_KEY) || 'null');
    return normalize(migrate(raw), defaultFov);
  } catch {
    return normalize(null, defaultFov);
  }
}

/**
 * @param {object} settings
 * @param {Storage} [storage]
 * @returns {boolean} whether the write succeeded
 */
export function saveSettings(settings, storage) {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
    return true;
  } catch {
    return false;
  }
}
