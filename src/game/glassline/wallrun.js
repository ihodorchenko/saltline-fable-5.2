// @ts-check
// Pure wall-run eligibility/rules. The controller owns wall probes and motion.

export const WALLRUN_MIN_SPEED = 4.2;
export const WALLRUN_MAX_TIME = 1.4;
export const WALLRUN_MAX_DISTANCE = 0.8;
export const WALLRUN_ROLL = 0.35; // ~20°

/**
 * @param {{airborne: boolean, speed: number, wallDistance: number, normalY: number}} input
 * @returns {boolean}
 */
export function canWallrun({ airborne, speed, wallDistance, normalY }) {
  return (
    !!airborne &&
    Number.isFinite(speed) &&
    speed >= WALLRUN_MIN_SPEED &&
    Number.isFinite(wallDistance) &&
    wallDistance > 0 &&
    wallDistance <= WALLRUN_MAX_DISTANCE &&
    Math.abs(normalY) < 0.5
  );
}
