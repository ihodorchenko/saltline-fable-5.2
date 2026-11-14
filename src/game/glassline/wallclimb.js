// @ts-check
// Pure wall-climb rules: a short, stamina-limited vertical ascent distinct from
// wall-run. The controller owns the wall probe and motion.

export const WALLCLIMB_MAX_TIME = 0.9;
export const WALLCLIMB_MAX_DISTANCE = 0.85;
export const WALLCLIMB_SPEED = 2.1;

/**
 * @param {{distance: number, normalY: number, height: number}} input
 * @returns {boolean}
 */
export function canWallclimb({ distance, normalY, height }) {
  return (
    Number.isFinite(distance) &&
    distance > 0 &&
    distance <= WALLCLIMB_MAX_DISTANCE &&
    Math.abs(normalY) < 0.5 &&
    (!Number.isFinite(height) || height > 2.2)
  );
}
