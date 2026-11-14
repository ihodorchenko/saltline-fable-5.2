// @ts-check
// Pure mantle eligibility/rules. The controller owns raycasts and motion.

export const MANTLE_MIN_HEIGHT = 1.0;
export const MANTLE_MAX_HEIGHT = 2.2;
export const MANTLE_MAX_DISTANCE = 1.45;
export const MANTLE_DURATION = 0.55;

/**
 * @param {{height: number, distance: number, onGround: boolean}} input
 * @returns {boolean}
 */
export function canMantle({ height, distance, onGround }) {
  return (
    !!onGround &&
    Number.isFinite(height) &&
    height >= MANTLE_MIN_HEIGHT &&
    height <= MANTLE_MAX_HEIGHT &&
    Number.isFinite(distance) &&
    distance > 0 &&
    distance <= MANTLE_MAX_DISTANCE
  );
}
