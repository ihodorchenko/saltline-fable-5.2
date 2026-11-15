// @ts-check
// Single source of truth for the direction TOWARD the sun. The visible sky dome,
// the engine sun (shadows, lens flare, shadow-frustum fit) and the scene lights
// must all agree, or the flare ends up on the opposite side of the visible sun.

/** @type {readonly [number, number, number]} */
export const SUN_DIRECTION = Object.freeze([0.3, 0.45, -0.85]);
