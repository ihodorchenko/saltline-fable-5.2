// Deterministic PRNG: mulberry32 with the exact sequence used by the legacy
// single-file build. Every procedural system must draw from this instance.

/**
 * @param {number} [seed=1337]
 * @returns {Function & {range: Function, int: Function, pick: Function, sign: Function, fork: Function}}
 */
export function createRng(seed = 1337) {
  let state = seed >>> 0;

  const random = () => {
    state |= 0;
    state = (state + 1831565813) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  random.range = (min, max) => min + (max - min) * random();
  random.int = (min, max) => Math.floor(min + (max - min + 1) * random());
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.sign = () => (random() < 0.5 ? -1 : 1);
  random.fork = () => createRng(Math.floor(random() * 4294967296));
  return random;
}
