// @ts-check
// Pure slide rules. The controller supplies speed/ground/ceiling data; these
// functions are deterministic and unit-tested without a browser.

export const SLIDE_MIN_SPEED = 3;
export const SLIDE_MAX_TIME = 0.65;
export const SLIDE_FRICTION = 7;
export const SLIDE_BOOST = 1.15;

/**
 * @param {{onGround: boolean, speed: number}} input
 * @returns {boolean}
 */
export function canStartSlide({ onGround, speed }) {
  return !!onGround && Number.isFinite(speed) && speed >= SLIDE_MIN_SPEED;
}

/**
 * @param {number} speed
 * @param {number} dt
 * @param {number} [friction]
 * @returns {number}
 */
export function slideSpeed(speed, dt, friction = SLIDE_FRICTION) {
  return Math.max(0, speed - friction * Math.max(0, dt));
}

/**
 * @param {number} clearance
 * @param {number} standHeight
 * @param {number} slideHeight
 * @returns {boolean}
 */
export function canStand(clearance, standHeight, slideHeight) {
  return clearance >= standHeight - slideHeight + 0.05;
}

/**
 * Initial slide speed: keeps current momentum, with a small boost and a floor.
 * @param {number} speed
 * @returns {number}
 */
export function slideEntrySpeed(speed) {
  return Math.max(speed * SLIDE_BOOST, 7.5);
}
