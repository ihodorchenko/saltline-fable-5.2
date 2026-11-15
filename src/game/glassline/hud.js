// @ts-check
// Pure HUD text helpers: HTML escaping and keycap markup. Prompts come from level
// data and rebindable labels, so everything is escaped before it reaches innerHTML.

/**
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KEY_WORDS = /\b(WASD|Shift|Space|Ctrl|Backspace|Esc|Enter|Tab)\b/g;
// A single letter is a key only after an imperative ("press C", "hold C").
const KEY_LETTER = /\b(hold|Hold|press|Press|tap|Tap) ([A-Z])\b/g;
const KEY_PAIR = /\bA\/D\b/g;

/**
 * Escape prompt copy and wrap key names in <kbd> keycaps.
 * @param {unknown} text
 * @returns {string}
 */
export function keycapHtml(text) {
  return escapeHtml(text)
    .replace(KEY_LETTER, '$1 <kbd>$2</kbd>')
    .replace(KEY_PAIR, '<kbd>A</kbd>/<kbd>D</kbd>')
    .replace(KEY_WORDS, '<kbd>$1</kbd>');
}

/**
 * One "[KEY] action" hint for the help line.
 * @param {string} label
 * @param {string} action
 * @returns {string}
 */
export function keyHint(label, action) {
  return `<kbd>${escapeHtml(label)}</kbd> ${escapeHtml(action)}`;
}
