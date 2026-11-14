// @ts-check
// Lightweight validation for data-driven levels.

/**
 * @param {any} level
 * @returns {string[]} errors
 */
export function validateLevel(level) {
  const errors = [];
  if (!level || typeof level !== 'object') return ['level is not an object'];
  if (!level.spawn || !Number.isFinite(level.spawn.x) || !Number.isFinite(level.spawn.z)) {
    errors.push('spawn must have finite x/z');
  }
  if (!Array.isArray(level.platforms) || level.platforms.length === 0) {
    errors.push('at least one platform is required');
  }
  if (!Array.isArray(level.checkpoints) || level.checkpoints.length === 0) {
    errors.push('at least one checkpoint is required');
  }
  if (!level.finish || !Array.isArray(level.finish.pos)) {
    errors.push('finish.pos is required');
  }
  const ids = new Set();
  for (const item of [...(level.platforms || []), ...(level.obstacles || []), ...(level.checkpoints || [])]) {
    if (!item.id) errors.push('item without id');
    else if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  return errors;
}
