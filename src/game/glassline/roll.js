// @ts-check
// Pure landing-roll rules: landing speed, short duration and momentum retention.

export const ROLL_MIN_SPEED = 4;
export const ROLL_MIN_FALL = 2;
export const ROLL_DURATION = 0.45;
export const ROLL_RETENTION = 0.85;

/**
 * @param {{speed: number, fallingSpeed: number}} input
 * @returns {boolean}
 */
export function canRoll({ speed, fallingSpeed }) {
  return (
    Number.isFinite(speed) &&
    speed >= ROLL_MIN_SPEED &&
    Number.isFinite(fallingSpeed) &&
    fallingSpeed <= -ROLL_MIN_FALL
  );
}
