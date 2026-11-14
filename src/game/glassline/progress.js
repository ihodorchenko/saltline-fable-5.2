// @ts-check
// Pure pacing/fail-safe helpers for the tutorial.

export const STUCK_PROMPT_SECONDS = 6;
export const AUTO_RESPAWN_SECONDS = 15;

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(
    whole % 60,
  ).padStart(2, '0')}`;
}

/**
 * @param {number} idleSeconds
 * @returns {boolean}
 */
export function shouldPromptStuck(idleSeconds) {
  return idleSeconds >= STUCK_PROMPT_SECONDS;
}

/**
 * @param {number} idleSeconds
 * @returns {boolean}
 */
export function shouldAutoRespawn(idleSeconds) {
  return idleSeconds >= AUTO_RESPAWN_SECONDS;
}

/**
 * @param {number} previousTotal
 * @param {number} currentTotal
 * @returns {number}
 */
export function checkpointSplit(previousTotal, currentTotal) {
  return Math.max(0, currentTotal - previousTotal);
}
