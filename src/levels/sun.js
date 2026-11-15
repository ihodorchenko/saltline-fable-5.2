// @ts-check
// Single source of truth for the direction TOWARD the sun. The visible sky dome,
// the engine sun (shadows, lens flare, shadow-frustum fit) and the scene lights
// must all agree, or the flare ends up on the opposite side of the visible sun.
//
// Elevation and azimuth are art direction: ~56 deg elevation, ~50 deg off the
// route axis. A low sun straight down the route backlit the whole tutorial and
// kept horizontal surfaces at ~0.45 of the sun, so white roofs never read white.

/** @type {readonly [number, number, number]} */
export const SUN_DIRECTION = Object.freeze([-0.52, 0.93, -0.42]);
