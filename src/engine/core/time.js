// Frame time state shared by the game loop and modules. The loop owns the
// wall-clock delta/average; this module owns the clamped/fixed simulation time.

/**
 * @returns {{t: number, dt: number, frame: number, real: number}}
 */
export function createTime() {
  return { t: 0, dt: 0, frame: 0, real: 0 };
}

/**
 * Advance the simulation clock.
 * @param {{t: number, dt: number, frame: number, real: number}} time
 * @param {number} rawDelta seconds since the previous frame
 * @param {number} now performance.now() timestamp
 * @param {string|number|undefined} fixedDelta optional fixed timestep override
 * @returns {number} applied delta
 */
export function advanceTime(time, rawDelta, now, fixedDelta) {
  let dt = Math.min(rawDelta, 0.05);
  if (fixedDelta) dt = +fixedDelta;
  time.dt = dt;
  time.t += dt;
  time.real = now / 1000;
  time.frame++;
  return dt;
}
