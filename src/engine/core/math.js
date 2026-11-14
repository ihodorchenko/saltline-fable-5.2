// Scalar helpers shared by gameplay, physics and camera code. These preserve
// the exact formulas used by the legacy single-file build.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function damp(current, target, rate, dt) {
  return target + (current - target) * Math.exp(-rate * dt);
}
