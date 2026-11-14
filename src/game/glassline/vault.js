// @ts-check
// Pure vault eligibility/rules. Physics probes live in the controller; these
// functions are deterministic and unit-tested.

export const VAULT_MIN_SPEED = 2.8;
export const VAULT_MAX_HEIGHT = 1.15;
export const VAULT_MAX_DISTANCE = 1.45;
export const VAULT_DURATION = 0.38;

/**
 * @param {{onGround: boolean, speed: number, height: number, distance: number}} input
 * @returns {boolean}
 */
export function canVault({ onGround, speed, height, distance }) {
  return (
    !!onGround &&
    Number.isFinite(speed) &&
    speed >= VAULT_MIN_SPEED &&
    Number.isFinite(height) &&
    height >= 0.35 &&
    height <= VAULT_MAX_HEIGHT &&
    Number.isFinite(distance) &&
    distance > 0 &&
    distance <= VAULT_MAX_DISTANCE
  );
}
