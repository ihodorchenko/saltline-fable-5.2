// @ts-check
// Pure balance rules for narrow beams.

export const BALANCE_SPEED = 3;
export const BALANCE_LATERAL_SPEED = 1.8;
export const BALANCE_ROLL = 0.06;

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isBalanceSurface(tag) {
  return tag === 'balance';
}

/**
 * @param {number} lateralInput -1..1
 * @returns {number}
 */
export function balanceRoll(lateralInput) {
  return Math.max(-1, Math.min(1, lateralInput)) * BALANCE_ROLL;
}
