// @ts-check
// Pure movement-query helpers. Physics itself lives in the engine; these
// functions decide what a hit means for parkour and are deterministic/testable.

export const MAX_SLOPE = Math.PI / 4;
export const COYOTE_TIME = 0.1;

/**
 * @param {{x?: number, y?: number, z?: number}|null|undefined} normal
 * @param {number} [maxSlope]
 * @returns {boolean}
 */
export function isWalkableGround(normal, maxSlope = MAX_SLOPE) {
  if (!normal) return false;
  return normal.y >= Math.cos(maxSlope);
}

/**
 * @param {{point?: {y?: number}, normal?: {y?: number}}|null|undefined} hit
 * @param {number} [baseY=0] player feet Y
 * @param {number} [maxLedge=2.2]
 * @returns {{height: number, walkable: boolean}|null}
 */
export function ledgeInfo(hit, baseY = 0, maxLedge = 2.2) {
  if (!hit || !hit.point || typeof hit.point.y !== 'number') return null;
  const height = hit.point.y - baseY;
  if (height < 0.3 || height > maxLedge) return null;
  return {
    height,
    walkable: isWalkableGround(hit.normal),
  };
}

/**
 * @param {number} airTime
 * @param {number} [window]
 * @returns {boolean}
 */
export function coyoteActive(airTime, window = COYOTE_TIME) {
  return Number.isFinite(airTime) && airTime >= 0 && airTime <= window;
}
