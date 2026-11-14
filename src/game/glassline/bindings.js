// @ts-check
// Keyboard bindings for GLASSLINE. Pure data + small lookup helpers, persisted
// separately from the player controller so rebinding never touches movement code.

export const BINDINGS_KEY = 'glassline.bindings.v1';

export const BINDING_ACTIONS = [
  'forward',
  'back',
  'left',
  'right',
  'sprint',
  'jump',
  'slide',
  'retry',
  'restart',
];

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  slide: ['KeyC', 'ControlLeft', 'ControlRight'],
  retry: ['KeyR'],
  restart: ['Backspace'],
};

const KEY_LABELS = {
  Space: 'SPACE',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'R-CTRL',
  Backspace: 'BACKSPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Tab: 'TAB',
};

/**
 * @param {string} code
 * @returns {string}
 */
export function formatKey(code) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

/**
 * @param {any} stored
 * @returns {Record<string, string[]>}
 */
export function normalizeBindings(stored) {
  const result = {};
  for (const action of BINDING_ACTIONS) {
    const fallback = DEFAULT_BINDINGS[action];
    const value = stored && stored[action];
    result[action] =
      Array.isArray(value) && value.length
        ? value.filter((code) => typeof code === 'string')
        : [...fallback];
  }
  return result;
}

/**
 * @param {Record<string, string[]>} [overrides]
 */
export function createBindings(overrides = {}) {
  const map = normalizeBindings(overrides);

  return {
    /** @param {string} action */
    codes(action) {
      return map[action] || [];
    },
    /** @param {string} code @param {string} action */
    matches(code, action) {
      return (map[action] || []).includes(code);
    },
    /** @param {string} action @param {Set<string>} down */
    isDown(action, down) {
      return (map[action] || []).some((code) => down.has(code));
    },
    /** @param {string} action */
    label(action) {
      return (map[action] || []).map(formatKey).join(' / ');
    },
    /**
     * @param {string} action
     * @param {string} code
     * @returns {{ok: boolean, conflict?: string}}
     */
    set(action, code) {
      if (!BINDING_ACTIONS.includes(action) || typeof code !== 'string') {
        return { ok: false };
      }
      const conflict = BINDING_ACTIONS.find(
        (other) => other !== action && (map[other] || []).includes(code),
      );
      if (conflict) return { ok: false, conflict };
      map[action] = [code];
      return { ok: true };
    },
    reset() {
      for (const action of BINDING_ACTIONS) {
        map[action] = [...DEFAULT_BINDINGS[action]];
      }
    },
    toJSON() {
      return Object.fromEntries(
        BINDING_ACTIONS.map((action) => [action, [...map[action]]]),
      );
    },
  };
}

/**
 * @param {Storage} [storage]
 */
export function loadBindings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(BINDINGS_KEY);
    return createBindings(raw ? JSON.parse(raw) : {});
  } catch {
    return createBindings();
  }
}

/**
 * @param {ReturnType<typeof createBindings>} bindings
 * @param {Storage} [storage]
 */
export function saveBindings(bindings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(BINDINGS_KEY, JSON.stringify(bindings.toJSON()));
  } catch {
    /* storage is optional */
  }
}
