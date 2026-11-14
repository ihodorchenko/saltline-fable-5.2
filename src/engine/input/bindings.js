// KeyboardEvent.code -> action. Defaults for the Saltline game mode.
// Phase 1: extracted from the single-file build; values are unchanged.

export const keyBindings = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  KeyX: 'sprint',
  KeyC: 'crouch',
  ControlLeft: 'crouch',
  ControlRight: 'crouch',
  KeyR: 'reload',
  KeyE: 'ads',
  KeyF: 'interact',
  KeyQ: 'melee',
  Escape: 'pause',
  KeyP: 'pause',
  ShiftLeft: 'fire',
  ShiftRight: 'fire',
  ArrowLeft: 'turnL',
  ArrowRight: 'turnR',
  ArrowUp: 'turnU',
  ArrowDown: 'turnD',
  KeyJ: 'turnL',
  KeyL: 'turnR',
  KeyI: 'turnU',
  KeyK: 'turnD',
};

// Display metadata for HUD hints and the controls legend. Keyboard codes stay
// in keyBindings above; these values are labels only and never input handling.
export const actionMeta = {
  forward: { label: 'Move forward', key: 'W', display: ['W'] },
  back: { label: 'Move back', key: 'S', display: ['S'] },
  left: { label: 'Move left', key: 'A', display: ['A'] },
  right: { label: 'Move right', key: 'D', display: ['D'] },
  jump: { label: 'Jump', key: 'Space', display: ['Space'] },
  sprint: { label: 'Sprint', key: 'X', display: ['X'] },
  crouch: { label: 'Crouch', key: 'C', display: ['C'] },
  reload: { label: 'Reload', key: 'R', display: ['R'] },
  fire: { label: 'Fire', key: null, display: ['LMB', 'Shift'] },
  ads: { label: 'Aim', key: null, display: ['RMB', 'E'] },
  interact: { label: 'Cut relay', key: 'F', display: ['F'] },
  melee: { label: 'Melee', key: 'Q', display: ['Q'] },
  pause: { label: 'Pause', key: 'Esc', display: ['Esc'] },
  turnL: { label: 'Turn left', key: 'Left', display: ['Left'] },
  turnR: { label: 'Turn right', key: 'Right', display: ['Right'] },
  turnU: { label: 'Turn up', key: 'Up', display: ['Up'] },
  turnD: { label: 'Turn down', key: 'Down', display: ['Down'] },
};

/** @param {string} action */
export function actionKey(action) {
  return actionMeta[action]?.key || action;
}

/** @param {string} action */
export function actionLegend(action) {
  return actionMeta[action]?.display || [action];
}
