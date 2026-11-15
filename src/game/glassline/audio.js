// @ts-check
// Original procedural GLASSLINE audio: no samples, no external music, no copied
// material. Every sound — including the convolution reverb impulse response — is
// synthesized from oscillators and seeded noise at runtime.
//
// Graph (all levels are in the pure helpers below, so the mix can be rendered
// offline and measured without a browser):
//
//   windLow ──┐
//   windHigh ─┤
//   city ─────┼─► worldFilter ─► worldBus ─┐
//   traffic ──┘                             │
//   cloth ──────────────────────────────────┼─► ambienceBus ─┐
//   pad / bass / arp ───────────────────────┴─► musicBus ────┼─► duckGain ─┐
//   step / land / stunt one-shots ─────────────► sfxBus ─────┼─────────────┤
//   slide / wallrun loops ─────────────────────► sfxBus        │             │
//                                                              │   ┌─────────┴──┐
//   reverb sends (music, sfx) ─► convolver ─► reverbReturn ────┴──►│ compressor │
//                                                                  │  → limiter │
//                                                                  │  → master  │
//                                                                  │  → out     │
//                                                                  └────────────┘
//
// The AudioContext is still created lazily, only after the START/Continue user
// gesture (browser autoplay policy). `createGlasslineAudio({ audioContext })`
// accepts an injected context (e.g. OfflineAudioContext) so tools/audio-render
// can render and measure the real graph.

export const AUDIO_KEY = 'glassline.audio.v1';

/** Master fader default; the saved/volume/mute semantics are unchanged. */
export const DEFAULT_VOLUME = 0.55;

/**
 * @param {number} value
 * @returns {number}
 */
export function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * @param {number} value
 * @returns {number}
 */
function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

/**
 * Smooth Hermite step used by the enclosure crossfade.
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} value
 * @returns {number}
 */
export function smoothstep(edge0, edge1, value) {
  const span = edge1 - edge0;
  if (span <= 0) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / span);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Music data: an original four-chord rooftop loop (Am9 → Fmaj7 → Cmaj7 → G6),
// 3.5 s per chord, low register, detuned pad voices, one quiet arpeggio.
// ---------------------------------------------------------------------------

export const CHORD_SECONDS = 3.5;

/** @type {ReadonlyArray<{name: string, notes: readonly number[], bass: number}>} */
export const MUSIC_CHORDS = Object.freeze([
  { name: 'Am9', notes: [110.0, 130.81, 164.81, 246.94], bass: 55.0 },
  { name: 'Fmaj7', notes: [87.31, 110.0, 130.81, 164.81], bass: 43.65 },
  { name: 'Cmaj7', notes: [130.81, 164.81, 196.0, 246.94], bass: 65.41 },
  { name: 'G6', notes: [98.0, 123.47, 146.83, 164.81], bass: 49.0 },
]);

const PAD_VOICE_GAINS = Object.freeze([0.32, 0.25, 0.19, 0.15]);
const PAD_VOICE_TYPES = Object.freeze(['sawtooth', 'triangle', 'triangle', 'triangle']);
const PAD_DETUNE_CENTS = Object.freeze([-7, 7]);
const BASS_GAIN = 0.22;
const ARP_PATTERN = Object.freeze([0, 2, 1, 3]);
const ARP_STEP_SECONDS = CHORD_SECONDS / 4;

/**
 * Which chord of the loop is playing at a given audio time. Pure and total:
 * negative/non-finite times read as the first chord.
 * @param {number} time seconds
 * @returns {number} index into MUSIC_CHORDS
 */
export function musicIndexAt(time) {
  const seconds = Number(time);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / CHORD_SECONDS) % MUSIC_CHORDS.length;
}

/**
 * Chord state at a time, for the scheduler and for tests.
 * @param {number} time seconds
 * @returns {{index: number, name: string, notes: number[], bass: number, startsAt: number, endsAt: number}}
 */
export function musicAt(time) {
  const index = musicIndexAt(time);
  const chord = MUSIC_CHORDS[index];
  const startsAt = index * CHORD_SECONDS;
  return {
    index,
    name: chord.name,
    notes: [...chord.notes],
    bass: chord.bass,
    startsAt,
    endsAt: startsAt + CHORD_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Pure mix helpers
// ---------------------------------------------------------------------------

/**
 * Map a landing impact speed to a safe landing-audio intensity.
 * @param {number} impact
 */
export function landingPower(impact) {
  return Math.max(0.3, Math.min(1, Math.abs(Number(impact) || 0) / 14));
}

/**
 * Map run speed/finale state to the procedural mix. Pure so it can be tested
 * and rendered without an AudioContext.
 *
 * The optional `out` target is reused by the per-frame update path so the live
 * audio loop does not allocate a fresh object every frame.
 *
 * @param {number} speed metres/second
 * @param {boolean} [finale]
 * @param {{[key: string]: number}} [out]
 */
export function audioMotion(speed, finale = false, out = {}) {
  const ratio = clamp01((Number(speed) || 0) / 12);
  if (finale) {
    out.windGain = 1.1;
    out.windFrequency = 240;
    out.windHighGain = 0.2;
    out.windHighFrequency = 1250;
    out.cityGain = 0.37;
    out.cityFrequency = 135;
    out.trafficGain = 0.1;
    out.clothGain = 0.04;
    out.clothFrequency = 1750;
    out.airGain = 0.085;
    out.airFrequency = 3000;
    out.musicGain = 0.14;
    out.musicCutoff = 300;
    out.arpGain = 0.008;
    return out;
  }
  out.windGain = 0.37 + ratio * 0.88;
  out.windFrequency = 160 + ratio * 140;
  out.windHighGain = 0.02 + ratio * 0.17;
  out.windHighFrequency = 800 + ratio * 800;
  // High "air" band: the thin wind above 2 kHz that makes an open rooftop mix
  // read as air instead of a low rumble. Very low gain, opens with speed.
  out.airGain = 0.017 + ratio * 0.055;
  out.airFrequency = 2550 + ratio * 1600;
  out.cityGain = 0.4 - ratio * 0.03;
  out.cityFrequency = 145 + ratio * 30;
  out.trafficGain = 0.135 + ratio * 0.025;
  out.clothGain = ratio * 0.13;
  out.clothFrequency = 1500 + ratio * 1200;
  out.musicGain = 0.11 + ratio * 0.018;
  out.musicCutoff = 460 + ratio * 1100;
  out.arpGain = 0.004 + ratio * 0.003;
  return out;
}

/**
 * Surface response for footsteps and landings. The physics capsule mover
 * reports `surface` from the collider (build.js writes `platform.material ||
 * 'concrete'`), so these are the timbres the game can ask for. Unknown names
 * fall back to concrete.
 *
 * @param {string} [surface]
 * @returns {{name: string, bodyFrequency: number, bodyEnd: number, bodyGain: number,
 *   bodyDuration: number, toneType: OscillatorType, noiseCutoff: number,
 *   noiseEnd: number, noiseGain: number, noiseQ: number, noiseType: BiquadFilterType,
 *   noiseDuration: number, clickCutoff: number, clickQ: number, clickGain: number}}
 */
export function surfaceResponse(surface) {
  const key = typeof surface === 'string' ? surface.trim().toLowerCase() : '';
  switch (key) {
    case 'metal':
      return {
        name: 'metal',
        bodyFrequency: 168,
        bodyEnd: 118,
        bodyGain: 0.55,
        bodyDuration: 0.2,
        toneType: 'triangle',
        noiseCutoff: 2800,
        noiseEnd: 2200,
        noiseGain: 0.6,
        noiseQ: 3.2,
        noiseType: 'bandpass',
        noiseDuration: 0.09,
        clickCutoff: 4800,
        clickQ: 1.8,
        clickGain: 0.9,
      };
    case 'planter':
    case 'wood':
      return {
        name: key,
        bodyFrequency: 116,
        bodyEnd: 72,
        bodyGain: 0.62,
        bodyDuration: 0.13,
        toneType: 'triangle',
        noiseCutoff: 950,
        noiseEnd: 700,
        noiseGain: 0.55,
        noiseQ: 1.3,
        noiseType: 'bandpass',
        noiseDuration: 0.075,
        clickCutoff: 2400,
        clickQ: 1.2,
        clickGain: 0.35,
      };
    case 'gravel':
      return {
        name: 'gravel',
        bodyFrequency: 88,
        bodyEnd: 52,
        bodyGain: 0.5,
        bodyDuration: 0.09,
        toneType: 'sine',
        noiseCutoff: 2100,
        noiseEnd: 1100,
        noiseGain: 0.9,
        noiseQ: 0.7,
        noiseType: 'highpass',
        noiseDuration: 0.11,
        clickCutoff: 4600,
        clickQ: 0.9,
        clickGain: 0.55,
      };
    case 'water':
      return {
        name: 'water',
        bodyFrequency: 140,
        bodyEnd: 60,
        bodyGain: 0.4,
        bodyDuration: 0.12,
        toneType: 'sine',
        noiseCutoff: 3200,
        noiseEnd: 700,
        noiseGain: 0.8,
        noiseQ: 0.8,
        noiseType: 'lowpass',
        noiseDuration: 0.22,
        clickCutoff: 4800,
        clickQ: 0.9,
        clickGain: 0.4,
      };
    case 'concrete':
    default:
      return {
        name: 'concrete',
        bodyFrequency: 74,
        bodyEnd: 40,
        bodyGain: 1,
        bodyDuration: 0.12,
        toneType: 'sine',
        noiseCutoff: 1500,
        noiseEnd: 850,
        noiseGain: 0.85,
        noiseQ: 0.9,
        noiseType: 'bandpass',
        noiseDuration: 0.065,
        clickCutoff: 3200,
        clickQ: 1.1,
        clickGain: 0.4,
      };
  }
}

/**
 * Deterministic pseudo-random value in [0, 1) for a step index. Same index, same
 * value on every run — footsteps vary but stay reproducible for renders.
 * @param {number} index
 * @returns {number}
 */
export function hashUnit(index) {
  const seed = Math.sin((Number(index) || 0) * 12.9898 + 78.233) * 43758.5453;
  return seed - Math.floor(seed);
}

/**
 * Deterministic step variation: alternating feet, small pitch/weight wobble.
 * @param {number} index step counter
 * @param {number} [speed]
 */
export function stepVariation(index, speed = 0) {
  const step = Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : 0;
  const wobble = hashUnit(step);
  const side = step % 2 === 0 ? -1 : 1;
  const speedRatio = clamp01((Number(speed) || 0) / 8);
  return {
    side,
    pan: side * (0.16 + wobble * 0.12),
    pitch: 0.92 + wobble * 0.16,
    weight: 0.82 + hashUnit(step + 0.5) * 0.26 + speedRatio * 0.12,
  };
}

/**
 * Cadence implied by the player's stride. The player emits a step every 1.35 m
 * (walk/run) or 1.75 m (sprint); this reports the resulting rate so the audio
 * docs and tests share one definition.
 * @param {number} speed metres/second
 * @returns {{speed: number, strideMeters: number, cadenceHz: number}}
 */
export function stepCadence(speed) {
  const value = clampRange(speed, 0, 12);
  const strideMeters = value > 6 ? 1.75 : 1.35;
  return { speed: value, strideMeters, cadenceHz: value / strideMeters };
}

/**
 * Spatial cue math for checkpoint/finish chimes: pan relative to the camera yaw
 * and a distance attenuation. The listener yaw follows the game's convention
 * (forward is -Z at yaw 0, right is +X).
 *
 * @param {{x?: number, z?: number}|number[]} target
 * @param {{x?: number, z?: number, yaw?: number}} listener
 * @returns {{pan: number, attenuation: number, distance: number}}
 */
export function cuePan(target, listener = {}) {
  const targetX = Array.isArray(target) ? Number(target[0]) || 0 : Number(target?.x) || 0;
  const targetZ = Array.isArray(target) ? Number(target[2]) || 0 : Number(target?.z) || 0;
  const listenerX = Number(listener?.x) || 0;
  const listenerZ = Number(listener?.z) || 0;
  const yaw = Number(listener?.yaw) || 0;
  const dx = targetX - listenerX;
  const dz = targetZ - listenerZ;
  const distance = Math.hypot(dx, dz);
  const attenuation = clampRange(1 / (1 + distance / 14), 0.22, 1);
  if (distance < 1e-4) return { pan: 0, attenuation: 1, distance: 0 };
  // Camera right vector for yaw: (cos yaw, -sin yaw) in (x, z).
  const lateral = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance;
  return {
    pan: clampRange(lateral * 0.9, -1, 1),
    attenuation,
    distance,
  };
}

/**
 * Enclosure amount (0 open rooftop … 1 fully inside the courtyard) for a
 * position against level `audioZones`. Each zone is an AABB with `min`/`max`
 * arrays and an optional `enclosure` weight; the amount fades over `fade`
 * metres inside the edges so walking through the gate crossfades instead of
 * snapping.
 *
 * @param {{x: number, y?: number, z: number}} position
 * @param {Array<{min: number[], max: number[], enclosure?: number, fade?: number}>} [zones]
 * @param {number} [fade] default crossfade distance in metres
 * @returns {number} 0..1
 */
export function enclosureAmount(position, zones, fade = 3) {
  if (!Array.isArray(zones) || zones.length === 0) return 0;
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  const z = Number(position?.z) || 0;
  let amount = 0;
  for (const zone of zones) {
    const min = zone?.min;
    const max = zone?.max;
    if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) continue;
    const inside = Math.min(x - min[0], max[0] - x, y - min[1], max[1] - y, z - min[2], max[2] - z);
    if (!(inside > 0)) continue;
    const zoneFade = Number.isFinite(Number(zone.fade)) ? Math.max(0.001, Number(zone.fade)) : fade;
    const weight = Number.isFinite(Number(zone.enclosure)) ? clamp01(zone.enclosure) : 1;
    amount = Math.max(amount, weight * smoothstep(0, zoneFade, inside));
  }
  return clamp01(amount);
}

/**
 * Map the enclosure amount to the audible crossfade: wind/city/traffic drop,
 * the outside bed is low-passed ("muffled"), the reverb return comes up, and the
 * music ducks slightly. Pure and monotonic for testing.
 *
 * @param {number} amount 0..1
 * @param {{[key: string]: number}} [out]
 */
export function enclosureMix(amount, out = {}) {
  const a = clamp01(amount);
  out.windScale = 1 - 0.5 * a;
  out.windHighScale = 1 - 0.62 * a;
  out.airScale = 1 - 0.7 * a;
  out.cityScale = 1 - 0.42 * a;
  out.trafficScale = 1 - 0.58 * a;
  out.clothScale = 1 - 0.22 * a;
  out.cityCutoffScale = 1 - 0.42 * a;
  out.airCutoff = 19000 - 16800 * a;
  out.reverbAdd = 0.2 * a;
  out.musicScale = 1 - 0.12 * a;
  return out;
}

/**
 * Duck amount and hold time for dispatch/checkpoint/finish/respawn. The duck
 * rides on a gain between ambience+music and the mix bus, so it never mutes the
 * stinger that caused it.
 *
 * @param {string} kind
 * @returns {{name: string, depth: number, hold: number}}
 */
export function duckEnvelope(kind) {
  switch (kind) {
    case 'dispatch':
      return { name: 'dispatch', depth: 0.34, hold: 5.4 };
    case 'finish':
      return { name: 'finish', depth: 0.4, hold: 4.0 };
    case 'checkpoint':
      return { name: 'checkpoint', depth: 0.62, hold: 1.5 };
    case 'respawn':
      return { name: 'respawn', depth: 0.55, hold: 1.6 };
    default:
      return { name: 'cue', depth: 0.75, hold: 0.8 };
  }
}

/**
 * Loop-layer targets from the controller state: continuous slide friction and
 * wall-run scuff instead of one-shots only.
 *
 * @param {{sliding?: boolean, wallrunning?: boolean, speed?: number, grounded?: boolean}} [state]
 * @param {{[key: string]: number}} [out]
 */
export function motionLayers(state = {}, out = {}) {
  const speedRatio = clamp01((Number(state.speed) || 0) / 8);
  out.slideGain = state.sliding ? 0.1 + speedRatio * 0.05 : 0;
  out.slideFrequency = 850 + speedRatio * 900;
  out.slideQ = 0.9 + speedRatio * 0.6;
  out.wallrunGain = state.wallrunning ? 0.17 : 0;
  out.wallrunFrequency = 720 + speedRatio * 240;
  out.wallrunQ = 1.2;
  return out;
}

// ---------------------------------------------------------------------------
// Seeded noise / impulse generation
// ---------------------------------------------------------------------------

const NOISE_BUFFER_SECONDS = 3;

/**
 * @param {number} seed
 * @returns {() => number} deterministic [0, 1)
 */
function createRandom(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/**
 * Build a looping noise buffer. `pink` is the wind bed, `brown` the city rumble,
 * `white` the transient/cloth source.
 * @param {BaseAudioContext} context
 * @param {'white'|'pink'|'brown'} kind
 * @param {() => number} random
 * @returns {AudioBuffer}
 */
function createNoiseBuffer(context, kind, random) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * NOISE_BUFFER_SECONDS);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let brown = 0;
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    const white = random() * 2 - 1;
    let value = white;
    if (kind === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      value = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;
    } else if (kind === 'brown') {
      brown = (brown + white * 0.02) / 1.02;
      value = brown * 3.4;
    }
    data[i] = value;
    const magnitude = Math.abs(value);
    if (magnitude > peak) peak = magnitude;
  }
  const scale = peak > 1e-4 ? 0.92 / peak : 1;
  for (let i = 0; i < length; i += 1) data[i] *= scale;
  return buffer;
}

/**
 * Synthesize a stereo convolution impulse: a dark, exponentially decaying
 * diffuse tail plus a few discrete early reflections for the rooftop walls.
 * Deterministic per seed and scaled by ConvolverNode's built-in normalization.
 *
 * @param {BaseAudioContext} context
 * @param {() => number} random
 * @param {number} [seconds]
 * @returns {AudioBuffer}
 */
function createReverbImpulse(context, random, seconds = 2.6) {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(2, length, rate);
  const earlyReflections = [0.009, 0.017, 0.026, 0.041, 0.057, 0.073, 0.092, 0.117];
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let first = 0;
    let second = 0;
    const spread = channel === 0 ? 0.0006 : -0.0004;
    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      const white = random() * 2 - 1;
      // Time-varying low-pass: the tail gets progressively darker.
      const cutoff = 0.34 - progress * 0.26;
      first += cutoff * (white - first);
      const secondCutoff = 0.1 - progress * 0.07;
      second += secondCutoff * (first - second);
      data[i] = second * Math.exp(-progress * 4.6) * (1 - progress * 0.3) * 0.62;
    }
    for (let k = 0; k < earlyReflections.length; k += 1) {
      const index = Math.floor((earlyReflections[k] + spread * (k % 2 ? 1 : -1)) * rate);
      if (index >= 0 && index < length) {
        data[index] += (k % 2 === 0 ? 1 : -1) * 0.55 * Math.exp(-k * 0.24);
      }
    }
    for (let i = Math.max(0, length - 256); i < length; i += 1) {
      data[i] *= (length - i) / 256;
    }
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Settings persistence (unchanged key and semantics)
// ---------------------------------------------------------------------------

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
    return {
      volume: Number.isFinite(data.volume) ? clampVolume(data.volume) : DEFAULT_VOLUME,
      muted: data.muted === true,
    };
  } catch {
    return { volume: DEFAULT_VOLUME, muted: false };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * @param {{audioContext?: BaseAudioContext, ambience?: boolean, music?: boolean}} [options]
 *   `ambience`/`music` default to true; tools/audio-render.mjs turns them off to
 *   measure layers in isolation. Gameplay always uses the defaults.
 */
export function createGlasslineAudio(options = {}) {
  const saved = loadSettings();
  let volume = saved.volume;
  let muted = saved.muted;
  const injectedContext = options.audioContext || null;
  const includeAmbience = options.ambience !== false;
  const includeMusic = options.music !== false;

  /** @type {BaseAudioContext|null} */
  let context = null;
  let ownsContext = false;
  let started = false;
  let disposed = false;
  let graphBuilt = false;

  // Persistent graph nodes (kept in one list so dispose() can disconnect and the
  // render tool can report the node count).
  /** @type {any[]} */
  const nodes = [];
  /** @type {any[]} */
  const sources = [];
  /** @type {Array<() => void>} */
  const offs = [];
  /** @type {Map<string, AudioBuffer>} */
  const noiseBuffers = new Map();
  const random = createRandom(0x51a7f00d);

  /** @type {any} */ let master = null;
  /** @type {any} */ let compressor = null;
  /** @type {any} */ let limiter = null;
  /** @type {any} */ let duckGain = null;
  /** @type {any} */ let ambienceBus = null;
  /** @type {any} */ let musicBus = null;
  /** @type {any} */ let sfxBus = null;
  /** @type {any} */ let worldBus = null;
  /** @type {any} */ let worldFilter = null;
  /** @type {any} */ let reverb = null;
  /** @type {any} */ let reverbReturn = null;
  /** @type {any} */ let reverbMusicSend = null;
  /** @type {any} */ let reverbSfxSend = null;
  /** @type {any} */ let windLowGain = null;
  /** @type {any} */ let windLowFilter = null;
  /** @type {any} */ let windHighGain = null;
  /** @type {any} */ let windHighFilter = null;
  /** @type {any} */ let airGain = null;
  /** @type {any} */ let airFilter = null;
  /** @type {any} */ let cityGain = null;
  /** @type {any} */ let cityFilter = null;
  /** @type {any} */ let trafficGain = null;
  /** @type {any} */ let trafficFilter = null;
  /** @type {any} */ let clothGain = null;
  /** @type {any} */ let clothFilter = null;
  /** @type {any} */ let padFilter = null;
  /** @type {any} */ let arpGain = null;
  /** @type {any} */ let arpOscillator = null;
  /** @type {any} */ let bassOscillator = null;
  /** @type {any[]} */ const padOscillators = [];
  /** @type {any} */ let slideGain = null;
  /** @type {any} */ let slideFilter = null;
  /** @type {any} */ let wallrunGain = null;
  /** @type {any} */ let wallrunFilter = null;

  let musicStartAt = 0;
  let nextChordAt = 0;
  let nextArpAt = 0;
  let scheduledChordIndex = 0;
  let arpNoteIndex = 0;
  let arpLevel = 0.02;
  let stepIndex = 0;
  let lastUpdateAt = -1;
  let lastSliding = false;
  let lastWallrunning = false;
  let primed = false;

  // Reusable targets: the per-frame path only writes AudioParams, it never
  // allocates nodes or per-frame objects.
  /** @type {{[key: string]: number}} */
  const motionTarget = {};
  /** @type {{[key: string]: number}} */
  const enclosureTarget = {};
  /** @type {{[key: string]: number}} */
  const layerTarget = {};

  function persist() {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ volume, muted }));
    } catch {
      /* storage is optional */
    }
  }

  /**
   * Create a gain node, track it, and connect it.
   * @param {number} value
   * @returns {any}
   */
  function gainNode(value) {
    const node = context.createGain();
    node.gain.value = value;
    nodes.push(node);
    return node;
  }

  /**
   * @param {'lowpass'|'highpass'|'bandpass'} type
   * @param {number} frequency
   * @param {number} q
   * @returns {any}
   */
  function filterNode(type, frequency, q) {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    nodes.push(node);
    return node;
  }

  /**
   * @param {OscillatorType} type
   * @param {number} frequency
   * @returns {any}
   */
  function oscillator(type, frequency) {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    nodes.push(node);
    return node;
  }

  /**
   * @param {string} kind
   * @returns {AudioBuffer}
   */
  function noiseBuffer(kind) {
    const key = noiseBuffers.has(kind) ? kind : 'white';
    let buffer = noiseBuffers.get(key);
    if (!buffer) {
      buffer = createNoiseBuffer(context, /** @type {any} */ (key), random);
      noiseBuffers.set(key, buffer);
    }
    return buffer;
  }

  /**
   * @param {AudioNode} node
   * @param {AudioNode} destination
   */
  function connect(node, destination) {
    node.connect(destination);
    return destination;
  }

  function ensure() {
    if (context || disposed) return !!context;
    if (injectedContext) {
      context = injectedContext;
      ownsContext = false;
    } else {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      ownsContext = true;
    }
    if (!graphBuilt) buildGraph();
    return true;
  }

  function buildGraph() {
    // --- master chain: bus compressor → limiter → master volume → output -----
    master = context.createGain();
    master.gain.value = muted ? 0 : volume;
    nodes.push(master);

    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    nodes.push(limiter);

    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 10;
    compressor.ratio.value = 2.2;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.25;
    nodes.push(compressor);

    connect(compressor, limiter);
    connect(limiter, master);
    connect(master, context.destination);

    // --- buses ---------------------------------------------------------------
    duckGain = gainNode(1);
    ambienceBus = gainNode(1);
    musicBus = gainNode(0.42);
    sfxBus = gainNode(2.6);
    worldBus = gainNode(1);
    connect(duckGain, compressor);
    connect(ambienceBus, duckGain);
    connect(musicBus, duckGain);
    connect(sfxBus, compressor);

    worldFilter = filterNode('lowpass', 19000, 0.5);
    connect(worldFilter, worldBus);
    connect(worldBus, ambienceBus);

    // --- procedural convolution reverb on a send -----------------------------
    reverb = context.createConvolver();
    reverb.normalize = true;
    reverb.buffer = createReverbImpulse(context, random, 2.6);
    nodes.push(reverb);

    reverbReturn = gainNode(0.16);
    connect(reverb, reverbReturn);
    connect(reverbReturn, compressor);

    reverbMusicSend = gainNode(0.3);
    connect(duckGain, reverbMusicSend);
    connect(reverbMusicSend, reverb);

    reverbSfxSend = gainNode(0.12);
    connect(sfxBus, reverbSfxSend);
    connect(reverbSfxSend, reverb);

    graphBuilt = true;
  }

  function resume() {
    try {
      const promise = context?.resume?.();
      if (promise && promise.catch) promise.catch(() => {});
    } catch {
      /* suspended contexts are fine; start() is retried by the menu */
    }
  }

  function startAmbience() {
    const now = context.currentTime;

    // Wind low band: pink noise through a high/low-pass pair, slowly gusting.
    // The high-pass keeps the rooftop wind in the 50-300 Hz body instead of a
    // subwoofer rumble that would eat all the loudness headroom.
    // Slow gust LFO shared by the wind bands (created before the layers that
    // connect to it so all three wind layers breathe together).
    const gust = oscillator('sine', 0.055);
    gust.start(now);
    sources.push(gust);
    const gustLow = gainNode(0.14);
    connect(gust, gustLow);
    const gustHigh = gainNode(0.012);
    connect(gust, gustHigh);
    const airGust = gainNode(0.0025);
    connect(gust, airGust);

    const windLow = context.createBufferSource();
    windLow.buffer = noiseBuffer('pink');
    windLow.loop = true;
    windLow.playbackRate.value = 0.8;
    const windLowHighpass = filterNode('highpass', 62, 0.7);
    windLowFilter = filterNode('lowpass', 170, 0.6);
    windLowGain = gainNode(0.5);
    connect(windLow, windLowHighpass);
    connect(windLowHighpass, windLowFilter);
    connect(windLowFilter, windLowGain);
    connect(windLowGain, worldFilter);
    connect(gustLow, windLowGain.gain);
    windLow.start(now);
    sources.push(windLow);

    // Wind high band: the rooftop whistle, speed opens it.
    const windHigh = context.createBufferSource();
    windHigh.buffer = noiseBuffer('pink');
    windHigh.loop = true;
    windHigh.playbackRate.value = 1.35;
    windHighFilter = filterNode('bandpass', 820, 0.75);
    windHighGain = gainNode(0.045);
    connect(windHigh, windHighFilter);
    connect(windHighFilter, windHighGain);
    connect(windHighGain, worldFilter);
    connect(gustHigh, windHighGain.gain);
    windHigh.start(now);
    sources.push(windHigh);

    // High air band: the top of the wind that the reference mix keeps audible.
    // White noise through a high-pass + band-pass, kept at a very low level so it
    // reads as air, not as hiss; it is inside the enclosure filter so going
    // indoors muffles it with the rest of the outside bed.
    const air = context.createBufferSource();
    air.buffer = noiseBuffer('white');
    air.loop = true;
    air.playbackRate.value = 1.6;
    const airHighpass = filterNode('highpass', 2000, 0.6);
    airFilter = filterNode('bandpass', 3200, 0.55);
    airGain = gainNode(0.008);
    connect(air, airHighpass);
    connect(airHighpass, airFilter);
    connect(airFilter, airGain);
    connect(airGain, worldFilter);
    connect(airGust, airGain.gain);
    air.start(now);
    sources.push(air);
    // City bed: brown noise, low-passed, breathing very slowly.
    const city = context.createBufferSource();
    city.buffer = noiseBuffer('brown');
    city.loop = true;
    city.playbackRate.value = 0.55;
    const cityHighpass = filterNode('highpass', 68, 0.7);
    cityFilter = filterNode('lowpass', 150, 0.7);
    cityGain = gainNode(0.5);
    connect(city, cityHighpass);
    connect(cityHighpass, cityFilter);
    connect(cityFilter, cityGain);
    connect(cityGain, worldFilter);
    city.start(now);
    sources.push(city);
    const citySwell = oscillator('sine', 0.045);
    const citySwellGain = gainNode(0.05);
    connect(citySwell, citySwellGain);
    connect(citySwellGain, cityGain.gain);
    citySwell.start(now);
    sources.push(citySwell);

    // Distant-traffic chatter band: narrow band-pass with a slow swell.
    const traffic = context.createBufferSource();
    traffic.buffer = noiseBuffer('brown');
    traffic.loop = true;
    traffic.playbackRate.value = 0.9;
    trafficFilter = filterNode('bandpass', 430, 5);
    trafficGain = gainNode(0.17);
    connect(traffic, trafficFilter);
    connect(trafficFilter, trafficGain);
    connect(trafficGain, worldFilter);
    traffic.start(now);
    sources.push(traffic);
    const trafficSwell = oscillator('sine', 0.09);
    const trafficSwellGain = gainNode(0.08);
    connect(trafficSwell, trafficSwellGain);
    connect(trafficSwellGain, trafficGain.gain);
    trafficSwell.start(now);
    sources.push(trafficSwell);

    // Cloth/gear rustle, tied to speed and kept close to the listener.
    const cloth = context.createBufferSource();
    cloth.buffer = noiseBuffer('white');
    cloth.loop = true;
    cloth.playbackRate.value = 1.1;
    const clothHighpass = filterNode('highpass', 700, 0.7);
    clothFilter = filterNode('bandpass', 1500, 0.9);
    clothGain = gainNode(0);
    connect(cloth, clothHighpass);
    connect(clothHighpass, clothFilter);
    connect(clothFilter, clothGain);
    connect(clothGain, ambienceBus);
    cloth.start(now);
    sources.push(cloth);
  }

  function startMusic() {
    padFilter = filterNode('lowpass', 460, 0.8);
    connect(padFilter, musicBus);
    const chord = MUSIC_CHORDS[0];
    for (let voice = 0; voice < chord.notes.length; voice += 1) {
      const voiceGain = gainNode(PAD_VOICE_GAINS[voice]);
      connect(voiceGain, padFilter);
      const pair = [];
      for (const detune of PAD_DETUNE_CENTS) {
        const osc = oscillator(PAD_VOICE_TYPES[voice], chord.notes[voice]);
        osc.detune.value = detune;
        connect(osc, voiceGain);
        pair.push(osc);
      }
      padOscillators.push(pair);
      for (const osc of pair) {
        osc.start(context.currentTime);
        sources.push(osc);
      }
    }
    bassOscillator = oscillator('sine', chord.bass);
    const bassGain = gainNode(BASS_GAIN);
    connect(bassOscillator, bassGain);
    connect(bassGain, padFilter);
    bassOscillator.start(context.currentTime);
    sources.push(bassOscillator);

    arpOscillator = oscillator('triangle', chord.notes[0] * 2);
    arpGain = gainNode(0.0001);
    connect(arpOscillator, arpGain);
    connect(arpGain, musicBus);
    arpOscillator.start(context.currentTime);
    sources.push(arpOscillator);
  }

  function startMotionLayers() {
    const slide = context.createBufferSource();
    slide.buffer = noiseBuffer('white');
    slide.loop = true;
    slide.playbackRate.value = 0.95;
    slideFilter = filterNode('bandpass', 900, 1.1);
    slideGain = gainNode(0);
    connect(slide, slideFilter);
    connect(slideFilter, slideGain);
    connect(slideGain, sfxBus);
    slide.start();
    sources.push(slide);

    const wallrun = context.createBufferSource();
    wallrun.buffer = noiseBuffer('white');
    wallrun.loop = true;
    wallrun.playbackRate.value = 0.85;
    wallrunFilter = filterNode('bandpass', 720, 1.6);
    wallrunGain = gainNode(0);
    connect(wallrun, wallrunFilter);
    connect(wallrunFilter, wallrunGain);
    connect(wallrunGain, sfxBus);
    wallrun.start();
    sources.push(wallrun);
  }

  /**
   * Schedule pad chord changes and arpeggio notes up to `until` (audio time).
   * Called from updateState with a short lookahead, and by the offline render
   * tool once for the whole render window.
   * @param {number} until
   */
  function scheduleMusic(until) {
    if (!context || !started || !padFilter) return;
    const horizon = Math.max(Number(until) || 0, context.currentTime + 0.02);
    while (nextChordAt <= horizon) {
      scheduleChord(scheduledChordIndex, nextChordAt);
      nextChordAt += CHORD_SECONDS;
      scheduledChordIndex += 1;
    }
    while (nextArpAt <= horizon) {
      scheduleArpNote(nextArpAt);
      nextArpAt += ARP_STEP_SECONDS;
    }
  }

  /**
   * @param {number} index
   * @param {number} at
   */
  function scheduleChord(index, at) {
    const chord = MUSIC_CHORDS[index % MUSIC_CHORDS.length];
    for (let voice = 0; voice < padOscillators.length; voice += 1) {
      for (const osc of padOscillators[voice]) {
        osc.frequency.setValueAtTime(chord.notes[voice], at);
      }
    }
    if (bassOscillator) bassOscillator.frequency.setValueAtTime(chord.bass, at);
  }

  /**
   * @param {number} at
   */
  function scheduleArpNote(at) {
    if (!arpOscillator || !arpGain) return;
    const chord = MUSIC_CHORDS[Math.floor(arpNoteIndex / ARP_PATTERN.length) % MUSIC_CHORDS.length];
    const note = chord.notes[ARP_PATTERN[arpNoteIndex % ARP_PATTERN.length]] * 2;
    arpOscillator.frequency.setValueAtTime(note, at);
    const level = Math.max(0.0002, arpLevel);
    arpGain.gain.setValueAtTime(0.0001, at);
    arpGain.gain.linearRampToValueAtTime(level, at + 0.018);
    arpGain.gain.linearRampToValueAtTime(0.0001, at + 0.62);
    arpNoteIndex += 1;
  }

  function start() {
    if (disposed) return;
    if (!ensure()) return;
    if (started) {
      resume();
      return;
    }
    started = true;
    resume();
    if (includeAmbience) startAmbience();
    if (includeMusic) startMusic();
    startMotionLayers();
    musicStartAt = context.currentTime;
    nextChordAt = musicStartAt;
    nextArpAt = musicStartAt;
    scheduledChordIndex = 0;
    arpNoteIndex = 0;
    primed = true;
    scheduleMusic(context.currentTime + 0.5);
  }

  /**
   * Set an AudioParam target with a time constant, skipping repeats.
   * @param {any} param
   * @param {number} value
   * @param {number} timeConstant
   * @param {number} now
   */
  function setTarget(param, value, timeConstant, now) {
    if (!param || !Number.isFinite(value)) return;
    try {
      param.setTargetAtTime(value, now, timeConstant);
    } catch {
      /* a closed context must never throw into the game loop */
    }
  }

  /**
   * Duck the ambience/music bus for a stinger. `when` is an offset in seconds
   * from now (used by the offline renderer to place cues).
   * @param {string} kind
   * @param {number} [when]
   */
  function duck(kind, when = 0) {
    if (!context || !duckGain || !started) return;
    const envelope = duckEnvelope(kind);
    const at = context.currentTime + Math.max(0, Number(when) || 0);
    duckGain.gain.setTargetAtTime(envelope.depth, at, 0.07);
    duckGain.gain.setTargetAtTime(1, at + envelope.hold, 0.45);
  }

  // -------------------------------------------------------------------------
  // One-shot synthesis
  // -------------------------------------------------------------------------

  /**
   * @param {AudioNode} source
   * @param {number} pan
   * @returns {AudioNode} the node to connect further
   */
  function panned(source, pan) {
    if (!context.createStereoPanner) return source;
    const panner = context.createStereoPanner();
    panner.pan.value = clampRange(pan, -1, 1);
    connect(source, panner);
    return panner;
  }

  /**
   * @param {object} options
   * @param {number} options.frequency
   * @param {number} [options.endFrequency]
   * @param {number} [options.duration]
   * @param {OscillatorType} [options.type]
   * @param {number} [options.gain]
   * @param {number} [options.when]
   * @param {number} [options.pan]
   * @param {number} [options.attack]
   */
  function tone(options) {
    if (!context || !sfxBus) return;
    const {
      frequency,
      endFrequency = frequency,
      duration = 0.15,
      type = 'sine',
      gain = 0.06,
      when = 0,
      pan = 0,
      attack = 0.012,
    } = options;
    const at = context.currentTime + Math.max(0, Number(when) || 0);
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), at);
    if (Math.abs(endFrequency - frequency) > 0.01) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    connect(osc, envelope);
    connect(panned(envelope, pan), sfxBus);
    osc.start(at);
    osc.stop(at + duration + 0.03);
  }

  /**
   * @param {object} options
   * @param {number} options.duration
   * @param {number} options.cutoff
   * @param {number} [options.endCutoff]
   * @param {number} [options.gain]
   * @param {'lowpass'|'highpass'|'bandpass'} [options.type]
   * @param {number} [options.q]
   * @param {number} [options.when]
   * @param {number} [options.pan]
   * @param {number} [options.playbackRate]
   * @param {string} [options.buffer]
   */
  function noiseBurst(options) {
    if (!context || !sfxBus) return;
    const {
      duration = 0.2,
      cutoff = 900,
      endCutoff = Math.max(80, cutoff * 0.35),
      gain = 0.05,
      type = 'lowpass',
      q = 0.8,
      when = 0,
      pan = 0,
      playbackRate = 1,
      buffer = 'white',
    } = options;
    const at = context.currentTime + Math.max(0, Number(when) || 0);
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(buffer);
    source.playbackRate.value = playbackRate;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(30, cutoff), at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endCutoff), at + duration);
    filter.Q.value = q;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    connect(source, filter);
    connect(filter, envelope);
    connect(panned(envelope, pan), sfxBus);
    const offset = random() * Math.max(0.01, source.buffer.duration - duration - 0.1);
    source.start(at, offset, duration + 0.05);
  }

  /**
   * @param {Record<string, any>} [payload]
   */
  function playStep(payload = {}) {
    const surface = surfaceResponse(payload.surface);
    const variation = stepVariation((stepIndex += 1), 0);
    const pan = Number.isFinite(Number(payload.pan)) ? clampRange(payload.pan, -1, 1) : variation.pan;
    const when = Math.max(0, Number(payload.when) || 0);
    const weight = variation.weight * surface.bodyGain;
    tone({
      frequency: surface.bodyFrequency * variation.pitch,
      endFrequency: surface.bodyEnd,
      duration: surface.bodyDuration,
      type: surface.toneType,
      gain: 0.025 * weight,
      when,
      pan: pan * 0.6,
    });
    noiseBurst({
      duration: surface.noiseDuration,
      cutoff: surface.noiseCutoff * variation.pitch,
      endCutoff: surface.noiseEnd,
      gain: 0.35 * weight,
      type: surface.noiseType,
      q: surface.noiseQ,
      when: when + 0.004,
      pan,
    });
    noiseBurst({
      duration: 0.032,
      cutoff: surface.clickCutoff,
      endCutoff: surface.clickCutoff * 0.8,
      gain: 0.09 * surface.clickGain * weight,
      type: 'bandpass',
      q: surface.clickQ,
      when: when + 0.002,
      pan: pan * 1.1,
    });
  }

  /**
   * @param {number} intensity 0.3..1
   * @param {Record<string, any>} [payload]
   */
  function playLanding(intensity = 0.7, payload = {}) {
    const power = clampRange(intensity, 0.3, 1);
    const surface = surfaceResponse(payload.surface);
    const pan = clampRange(payload.pan ?? 0, -1, 1);
    const when = Math.max(0, Number(payload.when) || 0);
    // Sub thump: the weight of the body hitting concrete.
    tone({
      frequency: surface.bodyFrequency * 0.6,
      endFrequency: 24,
      duration: 0.2 + power * 0.12,
      type: 'sine',
      gain: 0.24 * power * surface.bodyGain,
      when,
      pan: pan * 0.35,
    });
    tone({
      frequency: 92 * power + 34,
      endFrequency: 30,
      duration: 0.16,
      type: surface.toneType,
      gain: 0.1 * power * surface.bodyGain,
      when: when + 0.01,
      pan: pan * 0.5,
    });
    noiseBurst({
      duration: 0.15,
      cutoff: surface.noiseCutoff,
      endCutoff: surface.noiseEnd * 0.7,
      gain: 0.05 * power * surface.noiseGain,
      type: 'lowpass',
      q: 0.8,
      when: when + 0.008,
      pan,
    });
    // Cloth/gear rustle settles a beat after impact.
    noiseBurst({
      duration: 0.13,
      cutoff: 2200,
      endCutoff: 1100,
      gain: 0.03 * power,
      type: 'highpass',
      q: 0.7,
      when: when + 0.03,
      pan: -pan * 0.2 + 0.05,
    });
    if (power > 0.72) {
      noiseBurst({
        duration: 0.08,
        cutoff: 2600,
        endCutoff: 1300,
        gain: 0.012,
        type: 'bandpass',
        q: 1.4,
        when: when + 0.05,
        pan: pan * 0.7,
      });
    }
  }

  /** @param {Record<string, any>} [payload] */
  function playCheckpoint(payload = {}) {
    const pan = clampRange(payload.pan ?? 0, -1, 1);
    const attenuation = clampRange(payload.attenuation ?? 1, 0.2, 1);
    const when = Math.max(0, Number(payload.when) || 0);
    const level = 0.05 * attenuation;
    tone({ frequency: 523.25, duration: 0.17, type: 'sine', gain: level, when, pan });
    tone({ frequency: 784, duration: 0.26, type: 'triangle', gain: level * 0.7, when: when + 0.1, pan });
    tone({
      frequency: 1046.5,
      duration: 0.36,
      type: 'sine',
      gain: level * 0.4,
      when: when + 0.2,
      pan,
    });
    noiseBurst({
      duration: 0.2,
      cutoff: 3200,
      endCutoff: 1800,
      gain: 0.009 * attenuation,
      type: 'bandpass',
      q: 1.2,
      when,
      pan,
    });
    duck('checkpoint', when);
  }

  /** @param {Record<string, any>} [payload] */
  function playFinish(payload = {}) {
    const pan = clampRange(payload.pan ?? 0, -1, 1);
    const attenuation = clampRange(payload.attenuation ?? 1, 0.2, 1);
    const when = Math.max(0, Number(payload.when) || 0);
    const chord = MUSIC_CHORDS[0].notes;
    for (let i = 0; i < chord.length; i += 1) {
      tone({
        frequency: chord[i],
        duration: 1.5 + i * 0.22,
        type: i < 2 ? 'sawtooth' : 'triangle',
        gain: (0.05 - i * 0.007) * attenuation,
        when: when + i * 0.09,
        pan,
        attack: 0.05,
      });
    }
    tone({
      frequency: chord[0] * 2,
      endFrequency: chord[0] * 3,
      duration: 1.1,
      type: 'sine',
      gain: 0.03 * attenuation,
      when: when + 0.4,
      pan: pan * 0.6,
    });
    noiseBurst({
      duration: 0.9,
      cutoff: 900,
      endCutoff: 300,
      gain: 0.02 * attenuation,
      type: 'bandpass',
      q: 0.7,
      when,
      pan,
    });
    duck('finish', when);
  }

  /** @param {Record<string, any>} [payload] */
  function playDispatch(payload = {}) {
    const when = Math.max(0, Number(payload.when) || 0);
    // Radio chirp: two short band-passed blips, like a cheap courier handset.
    tone({ frequency: 520, endFrequency: 760, duration: 0.07, gain: 0.034, when });
    noiseBurst({ duration: 0.05, cutoff: 2400, gain: 0.018, type: 'bandpass', q: 2.4, when });
    tone({
      frequency: 760,
      endFrequency: 620,
      duration: 0.11,
      gain: 0.026,
      when: when + 0.075,
    });
    noiseBurst({
      duration: 0.16,
      cutoff: 1800,
      endCutoff: 900,
      gain: 0.008,
      type: 'bandpass',
      q: 1.6,
      when: when + 0.09,
    });
    duck('dispatch', when);
  }

  /**
   * One-shot SFX entry point. Unchanged name/spec: `play(name, payload)`.
   * @param {string} name
   * @param {Record<string, any>} [payload]
   */
  function play(name, payload = {}) {
    if (!started || muted || !context || !sfxBus) return;
    const when = Math.max(0, Number(payload.when) || 0);
    switch (name) {
      case 'ui':
        tone({ frequency: 720, endFrequency: 540, duration: 0.055, gain: 0.028, when });
        break;
      case 'step':
        playStep(payload);
        break;
      case 'land':
        playLanding(landingPower(payload.impact), payload);
        break;
      case 'jump':
        noiseBurst({
          duration: 0.13,
          cutoff: 750,
          endCutoff: 320,
          gain: 0.04,
          type: 'bandpass',
          q: 0.7,
          when,
          pan: payload.pan ?? 0,
        });
        noiseBurst({
          duration: 0.06,
          cutoff: 2600,
          endCutoff: 1600,
          gain: 0.012,
          type: 'highpass',
          when,
          pan: payload.pan ?? 0,
        });
        tone({ frequency: 118, endFrequency: 52, duration: 0.12, gain: 0.03, when });
        break;
      case 'slide':
        // Attack transient; the continuous friction loop takes over from
        // updateState while the controller is sliding.
        noiseBurst({
          duration: 0.34,
          cutoff: 1700,
          endCutoff: 700,
          gain: 0.055,
          type: 'bandpass',
          q: 1.05,
          when,
        });
        noiseBurst({
          duration: 0.28,
          cutoff: 500,
          endCutoff: 220,
          gain: 0.02,
          when: when + 0.02,
        });
        tone({ frequency: 165, endFrequency: 96, duration: 0.3, gain: 0.022, when });
        break;
      case 'vault':
        noiseBurst({
          duration: 0.16,
          cutoff: 950,
          endCutoff: 420,
          gain: 0.042,
          type: 'bandpass',
          q: 0.8,
          when,
        });
        noiseBurst({
          duration: 0.08,
          cutoff: 2800,
          endCutoff: 1800,
          gain: 0.011,
          type: 'highpass',
          when: when + 0.02,
        });
        tone({ frequency: 104, endFrequency: 56, duration: 0.14, gain: 0.026, when });
        break;
      case 'mantle':
        noiseBurst({
          duration: 0.22,
          cutoff: 720,
          endCutoff: 360,
          gain: 0.042,
          when,
        });
        tone({ frequency: 126, endFrequency: 62, duration: 0.22, gain: 0.03, when });
        noiseBurst({
          duration: 0.1,
          cutoff: 2100,
          endCutoff: 1200,
          gain: 0.01,
          type: 'highpass',
          when: when + 0.08,
        });
        break;
      case 'wallrun':
        // The scuff loop is the body; this is the wall contact slap.
        noiseBurst({
          duration: 0.26,
          cutoff: 1100,
          endCutoff: 600,
          gain: 0.05,
          type: 'bandpass',
          q: 1.5,
          when,
        });
        tone({ frequency: 92, endFrequency: 58, duration: 0.16, gain: 0.02, when });
        break;
      case 'wallclimb':
        noiseBurst({
          duration: 0.34,
          cutoff: 820,
          endCutoff: 420,
          gain: 0.032,
          when,
        });
        tone({ frequency: 168, endFrequency: 340, duration: 0.36, gain: 0.032, when });
        break;
      case 'roll':
        noiseBurst({
          duration: 0.28,
          cutoff: 680,
          endCutoff: 300,
          gain: 0.05,
          when,
        });
        tone({ frequency: 142, endFrequency: 88, duration: 0.24, gain: 0.026, when });
        break;
      case 'checkpoint':
        playCheckpoint(payload);
        break;
      case 'finish':
        playFinish(payload);
        break;
      case 'respawn':
        duck('respawn', when);
        tone({
          frequency: 190,
          endFrequency: 128,
          duration: 0.3,
          gain: 0.03,
          when,
          pan: payload.pan ?? 0,
        });
        noiseBurst({
          duration: 0.24,
          cutoff: 1500,
          endCutoff: 500,
          gain: 0.014,
          type: 'bandpass',
          q: 1.2,
          when,
          pan: payload.pan ?? 0,
        });
        break;
      case 'radio':
        tone({ frequency: 540, endFrequency: 780, duration: 0.07, gain: 0.026, when });
        tone({
          frequency: 780,
          endFrequency: 640,
          duration: 0.1,
          gain: 0.018,
          when: when + 0.06,
        });
        break;
      default:
        break;
    }
  }

  /**
   * Bind gameplay events. Payloads are forwarded so surfaces and spatial cue
   * data reach the synth.
   * @param {{on?: (name: string, handler: (payload?: any) => void) => () => void}} [events]
   */
  function bind(events) {
    if (!events || !events.on) return () => {};
    const map = {
      'glassline:jump': (payload) => play('jump', payload || {}),
      'glassline:land': (payload) => play('land', payload || {}),
      'glassline:step': (payload) => play('step', payload || {}),
      'glassline:slide': (payload) => play('slide', payload || {}),
      'glassline:vault': (payload) => play('vault', payload || {}),
      'glassline:mantle': (payload) => play('mantle', payload || {}),
      'glassline:wallrun': (payload) => play('wallrun', payload || {}),
      'glassline:wallclimb': (payload) => play('wallclimb', payload || {}),
      'glassline:roll': (payload) => play('roll', payload || {}),
      'glassline:checkpoint': (payload) => play('checkpoint', payload || {}),
      'glassline:finish': (payload) => play('finish', payload || {}),
      'glassline:respawn': (payload) => play('respawn', payload || {}),
    };
    for (const [name, handler] of Object.entries(map)) {
      offs.push(events.on(name, handler));
    }
    return () => {
      for (const off of offs.splice(0)) off();
    };
  }

  /**
   * Full per-frame mix update. Only writes AudioParam targets; allocates no
   * nodes and no per-frame objects. Updates are throttled to 20 Hz (plus
   * immediate response when a loop layer starts/stops).
   * @param {{speed?: number, finale?: boolean, enclosure?: number, sliding?: boolean,
   *   wallrunning?: boolean, sprinting?: boolean, grounded?: boolean}} [state]
   * @param {boolean} [force] apply even if the 20 Hz throttle has not elapsed
   *   (used when the game pauses, so the wind/loop layers settle to rest)
   */
  function updateState(state = {}, force = false) {
    if (!context || !started || disposed) return;
    const now = context.currentTime;
    const sliding = state.sliding === true;
    const wallrunning = state.wallrunning === true;
    const layerChanged = sliding !== lastSliding || wallrunning !== lastWallrunning;
    const due = force || !primed || layerChanged || now - lastUpdateAt >= 0.05;
    if (!due) {
      scheduleMusic(now + 0.3);
      return;
    }
    primed = false;
    lastUpdateAt = now;
    lastSliding = sliding;
    lastWallrunning = wallrunning;

    const enclosure = clamp01(state.enclosure);
    const enc = enclosureMix(enclosure, enclosureTarget);
    const mix = audioMotion(state.speed, state.finale === true, motionTarget);

    setTarget(windLowGain?.gain, mix.windGain * enc.windScale, 0.35, now);
    setTarget(windLowFilter?.frequency, mix.windFrequency, 0.5, now);
    setTarget(windHighGain?.gain, mix.windHighGain * enc.windHighScale, 0.4, now);
    setTarget(windHighFilter?.frequency, mix.windHighFrequency, 0.5, now);
    setTarget(airGain?.gain, mix.airGain * enc.airScale, 0.4, now);
    setTarget(airFilter?.frequency, mix.airFrequency, 0.5, now);
    setTarget(cityGain?.gain, mix.cityGain * enc.cityScale, 0.6, now);
    setTarget(cityFilter?.frequency, mix.cityFrequency * enc.cityCutoffScale, 0.6, now);
    setTarget(trafficGain?.gain, mix.trafficGain * enc.trafficScale, 0.6, now);
    setTarget(clothGain?.gain, mix.clothGain * enc.clothScale, 0.25, now);
    setTarget(clothFilter?.frequency, mix.clothFrequency, 0.3, now);
    setTarget(musicBus?.gain, mix.musicGain * enc.musicScale, 0.4, now);
    setTarget(padFilter?.frequency, mix.musicCutoff, 0.4, now);
    setTarget(worldFilter?.frequency, enc.airCutoff, 0.5, now);
    setTarget(reverbReturn?.gain, 0.16 + enc.reverbAdd, 0.6, now);
    arpLevel = mix.arpGain;

    const layers = motionLayers(state, layerTarget);
    setTarget(slideGain?.gain, layers.slideGain, 0.08, now);
    setTarget(slideFilter?.frequency, layers.slideFrequency, 0.1, now);
    setTarget(slideFilter?.Q, layers.slideQ, 0.1, now);
    setTarget(wallrunGain?.gain, layers.wallrunGain, 0.1, now);
    setTarget(wallrunFilter?.frequency, layers.wallrunFrequency, 0.1, now);

    scheduleMusic(now + 0.3);
  }

  /**
   * Legacy helper kept for API compatibility: speed + finale only.
   * @param {number} speed
   * @param {boolean} [finale]
   */
  function updateMotion(speed = 0, finale = false) {
    updateState({ speed, finale });
  }

  /**
   * @param {number} value
   */
  function setVolume(value) {
    volume = clampVolume(value);
    if (master && context) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.03);
      } catch {
        /* context may be closed */
      }
    }
    persist();
  }

  /**
   * @param {boolean} value
   */
  function setMuted(value) {
    muted = !!value;
    if (master && context) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.03);
      } catch {
        /* context may be closed */
      }
    }
    persist();
  }

  function dispose() {
    disposed = true;
    for (const source of sources.splice(0)) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const node of nodes.splice(0)) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    for (const off of offs.splice(0)) off();
    if (ownsContext && context) {
      try {
        const promise = context.close?.();
        if (promise && promise.catch) promise.catch(() => {});
      } catch {
        /* context may already be closed */
      }
    }
    context = null;
    master = null;
    started = false;
    graphBuilt = false;
  }

  return {
    start,
    play,
    bind,
    setVolume,
    setMuted,
    updateMotion,
    updateState,
    scheduleMusicUntil(until) {
      scheduleMusic(until);
    },
    playDispatch,
    playLanding,
    dispose,
    get volume() {
      return volume;
    },
    get muted() {
      return muted;
    },
    get started() {
      return started;
    },
    /** Number of persistent audio nodes in the graph (budget evidence). */
    get nodeCount() {
      return nodes.length;
    },
  };
}
