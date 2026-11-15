/* eslint-disable no-undef */
// Offline render + mix measurement harness for the GLASSLINE procedural audio.
//
// Boots a blank same-origin page on the running Vite dev server, imports the
// real src/game/glassline/audio.js in the browser, renders the live graph
// through an OfflineAudioContext at 48 kHz stereo, then writes 24-bit WAVs and
// a manifest with integrated loudness (approx. BS.1770), true peak (4x
// oversampled), RMS, spectral centroid and band energies.
//
// Usage:
//   npm run dev                                # in another shell (port 5173)
//   node tools/audio-render.mjs                # renders into artifacts/audio/
//   node tools/audio-render.mjs --out /tmp/audio --url http://127.0.0.1:5173
//
// Flags:
//   --url      dev server base URL (default http://127.0.0.1:5173)
//   --out      output directory (default artifacts/audio)
//   --channel  Playwright browser channel (default PLAYWRIGHT_CHANNEL or msedge)
//
// Exits non-zero when a render clips (true peak > -0.5 dBFS), is silent, or the
// persistent audio graph exceeds the 120-node budget.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SAMPLE_RATE = 48000;
const CLIP_TRUE_PEAK_DBFS = -0.5;
const SILENCE_LUFS = -60;
const NODE_BUDGET = 120;
// Ambience loudness target from the task brief; reported, not a hard gate.
const AMBIENCE_LUFS_TARGET = [-22, -18];

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const BASE = flag('url', 'http://127.0.0.1:5173');
const OUT = resolve(ROOT, flag('out', 'artifacts/audio'));
const CHANNEL = flag('channel', process.env.PLAYWRIGHT_CHANNEL || 'msedge');

/** @type {import('playwright').Browser|null} */
let activeBrowser = null;

// ---------------------------------------------------------------------------
// Render programme. `state` is the controller state passed to updateState();
// `timeline` entries change that state at OfflineAudioContext suspend points.
// `events` are one-shot SFX scheduled with an explicit time offset so the whole
// montage can render in one pass.
// ---------------------------------------------------------------------------

const RENDERS = [
  {
    file: 'ambience-idle.wav',
    description: 'Rooftop ambience, standing still: two-band wind, city bed, traffic chatter, music loop.',
    duration: 8,
    state: { speed: 0, finale: false, enclosure: 0 },
  },
  {
    file: 'ambience-sprint.wav',
    description:
      'Rooftop ambience at sprint speed (7.2 m/s): wind opens, whistle rises, cloth rustle appears, pad filter opens.',
    duration: 8,
    state: { speed: 7.2, sprinting: true, enclosure: 0 },
  },
  {
    file: 'courtyard.wav',
    description:
      'Inside the act II walled service courtyard: wind/traffic down, city bed low-passed, reverb return up.',
    duration: 6,
    state: { speed: 0, enclosure: 1 },
  },
  {
    file: 'motion-loops.wav',
    description:
      'Continuous controller-driven loops: 2 s open → slide friction 2 s → 1 s open → wall-run scuff 2 s.',
    duration: 8,
    state: { speed: 4, enclosure: 0 },
    timeline: [
      { at: 2.0, state: { speed: 7, sliding: true } },
      { at: 4.0, state: { speed: 4, sliding: false } },
      { at: 5.5, state: { speed: 6.4, wallrunning: true } },
      { at: 7.5, state: { speed: 2, wallrunning: false } },
    ],
  },
  {
    file: 'diag-ambience-solo.wav',
    description: 'Diagnostic: wind + city bed only (no music, no SFX) for the <500 Hz spectral check.',
    duration: 8,
    state: { speed: 0, enclosure: 0 },
    layers: { ambience: true, music: false },
  },
  {
    file: 'diag-music-solo.wav',
    description: 'Diagnostic: pad/bass/arpeggio only (no wind/city, no SFX) for the 100-800 Hz music check.',
    duration: 8,
    state: { speed: 0, enclosure: 0 },
    layers: { ambience: false, music: true },
  },
  {
    file: 'diag-sfx-solo.wav',
    description:
      'Diagnostic: the one-shot montage with no ambience or music, so footstep/stunt spectral balance and peaks are measured directly.',
    duration: 13,
    state: { speed: 0, enclosure: 0 },
    layers: { ambience: false, music: false },
    events: [
      { name: 'step', when: 0.2, payload: { surface: 'concrete' } },
      { name: 'step', when: 0.62, payload: { surface: 'concrete' } },
      { name: 'step', when: 1.04, payload: { surface: 'concrete' } },
      { name: 'step', when: 1.46, payload: { surface: 'metal' } },
      { name: 'step', when: 1.88, payload: { surface: 'metal' } },
      { name: 'step', when: 2.3, payload: { surface: 'planter' } },
      { name: 'step', when: 2.72, payload: { surface: 'concrete' } },
      { name: 'jump', when: 3.3 },
      { name: 'landing', when: 3.95, payload: { impact: 3.2, surface: 'concrete' } },
      { name: 'landing', when: 4.75, payload: { impact: 11.5, surface: 'concrete' } },
      { name: 'landing', when: 5.65, payload: { impact: 9.5, surface: 'metal' } },
      { name: 'slide', when: 6.35 },
      { name: 'vault', when: 7.15 },
      { name: 'mantle', when: 7.75 },
      { name: 'wallrun', when: 8.35 },
      { name: 'wallclimb', when: 8.95 },
      { name: 'roll', when: 9.6 },
      { name: 'checkpoint', when: 10.3, payload: { pan: -0.55, attenuation: 0.95 } },
      { name: 'dispatch', when: 11.0 },
      { name: 'finish', when: 12.1, payload: { pan: 0.4, attenuation: 0.9 } },
    ],
  },
  {
    file: 'diag-steps-solo.wav',
    description:
      'Diagnostic: eight footsteps across concrete/metal/planter with no bed, for the 800-4000 Hz footstep read.',
    duration: 5.5,
    state: { speed: 0, enclosure: 0 },
    layers: { ambience: false, music: false },
    events: [
      { name: 'step', when: 0.25, payload: { surface: 'concrete' } },
      { name: 'step', when: 0.8, payload: { surface: 'concrete' } },
      { name: 'step', when: 1.35, payload: { surface: 'metal' } },
      { name: 'step', when: 1.9, payload: { surface: 'metal' } },
      { name: 'step', when: 2.45, payload: { surface: 'planter' } },
      { name: 'step', when: 3.0, payload: { surface: 'planter' } },
      { name: 'step', when: 3.55, payload: { surface: 'concrete' } },
      { name: 'step', when: 4.1, payload: { surface: 'metal' } },
    ],
  },
  {
    file: 'diag-motion-solo.wav',
    description:
      'Diagnostic: controller-driven loop layers only (no bed): silent → slide friction → silent → wall-run scuff.',
    duration: 8,
    state: { speed: 4, enclosure: 0 },
    layers: { ambience: false, music: false },
    timeline: [
      { at: 2.0, state: { speed: 7, sliding: true } },
      { at: 4.0, state: { speed: 4, sliding: false } },
      { at: 5.5, state: { speed: 6.4, wallrunning: true } },
      { at: 7.5, state: { speed: 2, wallrunning: false } },
    ],
  },
  {
    file: 'diag-duck.wav',
    description:
      'Diagnostic: ambience only, dispatch cue at 2 s, to measure the ambience/music duck on the stinger.',
    duration: 6,
    state: { speed: 0, enclosure: 0 },
    layers: { ambience: true, music: false },
    events: [{ name: 'dispatch', when: 2.0 }],
  },
  {
    file: 'sfx-montage.wav',
    description:
      'One-shot montage: concrete/metal/planter steps, jump, light/heavy landings, slide, vault, mantle, wall-run hit, wall-climb, roll, checkpoint, dispatch, finish.',
    duration: 13,
    state: { speed: 0, enclosure: 0 },
    events: [
      { name: 'step', when: 0.2, payload: { surface: 'concrete' } },
      { name: 'step', when: 0.62, payload: { surface: 'concrete' } },
      { name: 'step', when: 1.04, payload: { surface: 'concrete' } },
      { name: 'step', when: 1.46, payload: { surface: 'metal' } },
      { name: 'step', when: 1.88, payload: { surface: 'metal' } },
      { name: 'step', when: 2.3, payload: { surface: 'planter' } },
      { name: 'step', when: 2.72, payload: { surface: 'concrete' } },
      { name: 'jump', when: 3.3 },
      { name: 'landing', when: 3.95, payload: { impact: 3.2, surface: 'concrete' } },
      { name: 'landing', when: 4.75, payload: { impact: 11.5, surface: 'concrete' } },
      { name: 'landing', when: 5.65, payload: { impact: 9.5, surface: 'metal' } },
      { name: 'slide', when: 6.35 },
      { name: 'vault', when: 7.15 },
      { name: 'mantle', when: 7.75 },
      { name: 'wallrun', when: 8.35 },
      { name: 'wallclimb', when: 8.95 },
      { name: 'roll', when: 9.6 },
      { name: 'checkpoint', when: 10.3, payload: { pan: -0.55, attenuation: 0.95 } },
      { name: 'dispatch', when: 11.0 },
      { name: 'finish', when: 12.1, payload: { pan: 0.4, attenuation: 0.9 } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function db(value) {
  return 20 * Math.log10(Math.max(value, 1e-12));
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function mean(values) {
  let sum = 0;
  for (const value of values) sum += value;
  return values.length ? sum / values.length : 0;
}

// ---------------------------------------------------------------------------
// Analysis: BS.1770-style integrated loudness (K-weighting), true peak,
// RMS, spectral centroid and band energies.
// ---------------------------------------------------------------------------

/**
 * RBJ biquad coefficients.
 * @returns {{b: number[], a: number[]}}
 */
function highShelf(frequency, sampleRate, gainDb, q) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cos);
  const b2 = A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
  const a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cos);
  const a2 = A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] };
}

/**
 * @returns {{b: number[], a: number[]}}
 */
function highPass(frequency, sampleRate, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] };
}

/**
 * @param {Float32Array} input
 * @param {{b: number[], a: number[]}} coefficients
 * @returns {Float32Array}
 */
function biquad(input, coefficients) {
  const { b, a } = coefficients;
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[i] = y;
  }
  return output;
}

/**
 * ITU-R BS.1770 K-weighting: high-shelf (+4 dB @ ~1682 Hz) then high-pass
 * (~38 Hz). Coefficients follow the standard prototype so they reproduce the
 * published 48 kHz values exactly at this render rate.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 */
function kWeight(samples, sampleRate) {
  const shelf = highShelf(1681.974450955533, sampleRate, 3.999843853973347, 0.7071752369554196);
  const pass = highPass(38.13547087602444, sampleRate, 0.5003270373238773);
  return biquad(biquad(samples, shelf), pass);
}

/**
 * Integrated loudness in LUFS with 400 ms blocks / 100 ms hop and absolute +
 * relative gating.
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 */
function integratedLoudness(channels, sampleRate) {
  const weighted = channels.map((channel) => kWeight(channel, sampleRate));
  const blockSize = Math.round(0.4 * sampleRate);
  const hop = Math.round(0.1 * sampleRate);
  const length = weighted[0]?.length || 0;
  if (length < blockSize) return -Infinity;
  /** @type {number[]} */
  const blockPowers = [];
  for (let start = 0; start + blockSize <= length; start += hop) {
    let sum = 0;
    for (const channel of weighted) {
      let energy = 0;
      for (let i = start; i < start + blockSize; i += 1) energy += channel[i] * channel[i];
      sum += energy / blockSize;
    }
    if (sum > 0) blockPowers.push(sum);
  }
  if (!blockPowers.length) return -Infinity;
  const absoluteThreshold = Math.pow(10, (-70 + 0.691) / 10);
  const aboveAbsolute = blockPowers.filter((power) => power >= absoluteThreshold);
  if (!aboveAbsolute.length) return -Infinity;
  const absoluteMean = mean(aboveAbsolute);
  const relativeThreshold = absoluteMean / 10;
  const gated = aboveAbsolute.filter((power) => power >= relativeThreshold);
  const finalPower = mean(gated.length ? gated : aboveAbsolute);
  return -0.691 + 10 * Math.log10(Math.max(finalPower, 1e-30));
}

/**
 * 4x oversampled peak with a windowed-sinc interpolator (12 taps per phase).
 * @param {Float32Array[]} channels
 */
function truePeakDbfs(channels) {
  const phases = 4;
  const half = 6;
  /** @type {number[][]} */
  const kernels = [];
  for (let phase = 1; phase < phases; phase += 1) {
    const fraction = phase / phases;
    const kernel = [];
    let sum = 0;
    for (let k = -half + 1; k <= half; k += 1) {
      const x = fraction - k;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const windowPosition = (k + half - 1) / (2 * half - 1);
      const window =
        0.42 - 0.5 * Math.cos(2 * Math.PI * windowPosition) + 0.08 * Math.cos(4 * Math.PI * windowPosition);
      const tap = sinc * window;
      kernel.push(tap);
      sum += tap;
    }
    kernels.push(kernel.map((tap) => tap / sum));
  }
  let peak = 0;
  for (const channel of channels) {
    const length = channel.length;
    for (let i = 0; i < length; i += 1) {
      const magnitude = Math.abs(channel[i]);
      if (magnitude > peak) peak = magnitude;
      for (let phase = 0; phase < kernels.length; phase += 1) {
        let value = 0;
        for (let k = -half + 1; k <= half; k += 1) {
          const index = clamp(i + k, 0, length - 1);
          value += channel[index] * kernels[phase][k + half - 1];
        }
        const interpolated = Math.abs(value);
        if (interpolated > peak) peak = interpolated;
      }
    }
  }
  return db(peak);
}

/** @param {Float32Array[]} channels */
function rmsDbfs(channels) {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      sum += channel[i] * channel[i];
      count += 1;
    }
  }
  return db(Math.sqrt(sum / Math.max(1, count)));
}

/**
 * In-place iterative radix-2 FFT.
 * @param {Float64Array} real
 * @param {Float64Array} imaginary
 */
function fft(real, imaginary) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const even = start + k;
        const odd = start + k + size / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImag;
        const oddImag = real[odd] * twiddleImag + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImag;
        real[even] += oddReal;
        imaginary[even] += oddImag;
        const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
        twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

const BANDS = [
  ['sub', 20, 60],
  ['low', 60, 150],
  ['lowmid', 150, 500],
  ['mid', 500, 1200],
  ['highmid', 1200, 4000],
  ['high', 4000, 10000],
  ['air', 10000, 20000],
];

/**
 * Spectral centroid + band energy fractions from averaged FFT frames.
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 */
function spectrum(channels, sampleRate) {
  const fftSize = 4096;
  const hop = 2048;
  const length = channels[0]?.length || 0;
  const bins = fftSize / 2;
  const power = new Float64Array(bins + 1);
  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);
  let frames = 0;
  for (let start = 0; start + fftSize <= length; start += hop) {
    for (let i = 0; i < fftSize; i += 1) {
      let sample = 0;
      for (const channel of channels) sample += channel[start + i] || 0;
      real[i] = (sample / channels.length) * window[i];
      imaginary[i] = 0;
    }
    fft(real, imaginary);
    for (let bin = 1; bin <= bins; bin += 1) {
      power[bin] += real[bin] * real[bin] + imaginary[bin] * imaginary[bin];
    }
    frames += 1;
  }
  if (!frames) {
    return { centroidHz: 0, bands: Object.fromEntries(BANDS.map(([name]) => [name, 0])) };
  }
  let magnitudeSum = 0;
  let weighted = 0;
  const bandPower = Object.fromEntries(BANDS.map(([name]) => [name, 0]));
  let totalPower = 0;
  for (let bin = 1; bin <= bins; bin += 1) {
    const frequency = (bin * sampleRate) / fftSize;
    if (frequency > 20000) continue;
    const value = power[bin];
    const magnitude = Math.sqrt(value);
    magnitudeSum += magnitude;
    weighted += frequency * magnitude;
    totalPower += value;
    for (const [name, low, high] of BANDS) {
      if (frequency >= low && frequency < high) {
        bandPower[name] += value;
        break;
      }
    }
  }
  const bands = {};
  for (const [name] of BANDS) {
    bands[name] = totalPower > 0 ? bandPower[name] / totalPower : 0;
  }
  return {
    centroidHz: magnitudeSum > 0 ? weighted / magnitudeSum : 0,
    bands,
  };
}

/**
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 */
function analyze(channels, sampleRate) {
  const spectrumStats = spectrum(channels, sampleRate);
  return {
    integratedLufs: round(integratedLoudness(channels, sampleRate), 2),
    truePeakDbfs: round(truePeakDbfs(channels), 2),
    rmsDbfs: round(rmsDbfs(channels), 2),
    spectralCentroidHz: round(spectrumStats.centroidHz, 0),
    bands: Object.fromEntries(
      Object.entries(spectrumStats.bands).map(([name, value]) => [name, round(value, 4)]),
    ),
  };
}

/**
 * @param {Float32Array[]} channels
 * @param {number} startSeconds
 * @param {number} endSeconds
 * @param {number} sampleRate
 */
function segmentChannels(channels, startSeconds, endSeconds, sampleRate) {
  const start = Math.max(0, Math.floor(startSeconds * sampleRate));
  const end = Math.min(channels[0].length, Math.floor(endSeconds * sampleRate));
  return channels.map((channel) => channel.subarray(start, Math.max(start, end)));
}

/**
 * @param {Float32Array[]} channels
 * @param {number} startSeconds
 * @param {number} endSeconds
 * @param {number} sampleRate
 */
function segmentRmsDbfs(channels, startSeconds, endSeconds, sampleRate) {
  const sliced = segmentChannels(channels, startSeconds, endSeconds, sampleRate);
  return round(rmsDbfs(sliced), 2);
}

// ---------------------------------------------------------------------------
// 24-bit WAV writer
// ---------------------------------------------------------------------------

function encodeWav24(channels, sampleRate) {
  const channelCount = channels.length;
  const frameCount = channels[0]?.length || 0;
  const dataSize = frameCount * channelCount * 3;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * 3, 28);
  buffer.writeUInt16LE(channelCount * 3, 32);
  buffer.writeUInt16LE(24, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = clamp(channels[channel][frame] || 0, -1, 1);
      let value = Math.round(sample * 8388607);
      if (value < 0) value += 0x1000000;
      buffer[offset] = value & 0xff;
      buffer[offset + 1] = (value >> 8) & 0xff;
      buffer[offset + 2] = (value >> 16) & 0xff;
      offset += 3;
    }
  }
  return buffer;
}

function base64ToFloat32(base64) {
  const bytes = Buffer.from(base64, 'base64');
  const copy = Uint8Array.prototype.slice.call(bytes);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

function concatWithSilence(segments, sampleRate, gapSeconds) {
  const gapFrames = Math.round(gapSeconds * sampleRate);
  const totalFrames =
    segments.reduce((sum, segment) => sum + segment[0].length, 0) +
    gapFrames * Math.max(0, segments.length - 1);
  const fused = [new Float32Array(totalFrames), new Float32Array(totalFrames)];
  let offset = 0;
  segments.forEach((segment, index) => {
    if (index > 0) offset += gapFrames;
    for (let channel = 0; channel < 2; channel += 1) {
      fused[channel].set(segment[channel] || segment[0], offset);
    }
    offset += segment[0].length;
  });
  return fused;
}

// ---------------------------------------------------------------------------
// Browser render
// ---------------------------------------------------------------------------

const HARNESS_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>GLASSLINE audio harness</title></head>' +
  '<body><p>offline audio harness</p></body></html>';

/**
 * Runs inside the page. Must stay self-contained: Playwright serializes this
 * function, so it cannot reference module-scope helpers.
 * @param {{duration: number, state: Record<string, any>, events: Array<Record<string, any>>, timeline: Array<Record<string, any>>}} spec
 */
async function renderInPage(spec) {
  const module = await import('/game/glassline/audio.js');
  const sampleRate = 48000;
  const frames = Math.ceil(spec.duration * sampleRate);
  const context = new OfflineAudioContext(2, frames, sampleRate);
  const layers = spec.layers || {};
  const audio = module.createGlasslineAudio({
    audioContext: context,
    ambience: layers.ambience !== false,
    music: layers.music !== false,
  });
  audio.start();
  const baseState = { ...(spec.state || {}) };
  audio.updateState(baseState);
  audio.scheduleMusicUntil(spec.duration);
  for (const event of spec.events || []) {
    const payload = { ...(event.payload || {}), when: event.when || 0 };
    if (event.name === 'dispatch') audio.playDispatch(payload);
    else if (event.name === 'landing') audio.playLanding(payload.impact / 14 || 0.7, payload);
    else audio.play(event.name, payload);
  }
  for (const step of spec.timeline || []) {
    context.suspend(step.at).then(() => {
      audio.updateState({ ...baseState, ...(step.state || {}) });
      context.resume();
    });
  }
  const buffer = await context.startRendering();
  const encode = (data) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  return {
    sampleRate: buffer.sampleRate,
    frames: buffer.length,
    left: encode(buffer.getChannelData(0)),
    right: encode(buffer.getChannelData(1)),
    nodeCount: audio.nodeCount,
    settings: { volume: audio.volume, muted: audio.muted },
  };
}

/**
 * Runs inside the page: prove that repeated updateState calls create no nodes.
 */
async function probeUpdateBudget() {
  const module = await import('/game/glassline/audio.js');
  const context = new OfflineAudioContext(2, 4800, 48000);
  const audio = module.createGlasslineAudio({ audioContext: context });
  audio.start();
  const state = { speed: 0, finale: false, enclosure: 0, sliding: false, wallrunning: false };
  const before = audio.nodeCount;
  for (let frame = 0; frame < 1200; frame += 1) {
    state.speed = (frame % 90) / 10;
    state.sliding = frame % 120 > 90;
    state.wallrunning = frame % 150 > 120;
    state.enclosure = frame % 200 > 150 ? 1 : 0;
    audio.updateState(state);
  }
  const after = audio.nodeCount;
  audio.dispose();
  return { before, after, frames: 1200 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let serverOk;
  try {
    const response = await fetch(BASE, { method: 'GET' });
    serverOk = response.ok;
  } catch {
    serverOk = false;
  }
  if (!serverOk) {
    throw new Error(
      `dev server is not reachable at ${BASE} — start it with "npm run dev" and re-run this tool`,
    );
  }

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: CHANNEL || undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  activeBrowser = browser;
  const page = await browser.newPage();
  await page.route('**/__audio-harness.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: HARNESS_HTML }),
  );
  await page.goto(`${BASE}/__audio-harness.html`, { waitUntil: 'domcontentloaded' });

  /** @type {Record<string, any>} */
  const manifestRenders = {};
  /** @type {Record<string, {channels: Float32Array[], stats: any}>} */
  const rendered = {};
  const failures = [];

  for (const spec of RENDERS) {
    const started = Date.now();
    const result = await page.evaluate(renderInPage, {
      duration: spec.duration,
      state: spec.state || {},
      events: spec.events || [],
      timeline: spec.timeline || [],
      layers: spec.layers || {},
    });
    const channels = [base64ToFloat32(result.left), base64ToFloat32(result.right)];
    const stats = analyze(channels, result.sampleRate);
    const wav = encodeWav24(channels, result.sampleRate);
    await writeFile(resolve(OUT, spec.file), wav);
    rendered[spec.file] = { channels, stats };
    const clipped = stats.truePeakDbfs > CLIP_TRUE_PEAK_DBFS;
    const silent = !Number.isFinite(stats.integratedLufs) || stats.integratedLufs < SILENCE_LUFS;
    if (clipped) failures.push(`${spec.file} clips at ${stats.truePeakDbfs} dBFS true peak`);
    if (silent) failures.push(`${spec.file} is silent (${stats.integratedLufs} LUFS)`);
    if (result.nodeCount > NODE_BUDGET) {
      failures.push(`${spec.file} built ${result.nodeCount} persistent nodes (> ${NODE_BUDGET})`);
    }
    manifestRenders[spec.file] = {
      description: spec.description,
      durationSeconds: spec.duration,
      frames: result.frames,
      sampleRate: result.sampleRate,
      channels: 2,
      secondsToRender: round((Date.now() - started) / 1000, 2),
      persistentNodes: result.nodeCount,
      masterVolume: result.settings?.volume ?? null,
      ...stats,
      under500HzShare: round(stats.bands.sub + stats.bands.low + stats.bands.lowmid, 4),
      clipped,
      silent,
    };
    console.log(
      `${spec.file.padEnd(20)} ${String(stats.integratedLufs).padStart(7)} LUFS  ` +
        `${String(stats.truePeakDbfs).padStart(7)} dBTP  ${String(stats.rmsDbfs).padStart(7)} dBFS  ` +
        `centroid ${String(stats.spectralCentroidHz).padStart(5)} Hz  ` +
        `${result.nodeCount} nodes  ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }

  // Combined listening demo: the whole ambience arc plus the SFX montage.
  const demoOrder = ['ambience-idle.wav', 'ambience-sprint.wav', 'courtyard.wav', 'sfx-montage.wav'];
  const demoSegments = demoOrder.map((file) => rendered[file].channels);
  const demoChannels = concatWithSilence(demoSegments, SAMPLE_RATE, 0.6);
  const demoStats = analyze(demoChannels, SAMPLE_RATE);
  await writeFile(resolve(OUT, 'demo.wav'), encodeWav24(demoChannels, SAMPLE_RATE));
  const demoSeconds = demoChannels[0].length / SAMPLE_RATE;
  manifestRenders['demo.wav'] = {
    description:
      'Owner listening demo: idle ambience (8 s) → sprint ambience (8 s) → courtyard (6 s) → one-shot montage (13 s), 0.6 s gaps.',
    durationSeconds: round(demoSeconds, 2),
    sampleRate: SAMPLE_RATE,
    channels: 2,
    ...demoStats,
    under500HzShare: round(demoStats.bands.sub + demoStats.bands.low + demoStats.bands.lowmid, 4),
    clipped: demoStats.truePeakDbfs > CLIP_TRUE_PEAK_DBFS,
    silent: !Number.isFinite(demoStats.integratedLufs) || demoStats.integratedLufs < SILENCE_LUFS,
  };
  if (manifestRenders['demo.wav'].clipped) {
    failures.push(`demo.wav clips at ${demoStats.truePeakDbfs} dBFS true peak`);
  }

  const ambience = ['ambience-idle.wav', 'ambience-sprint.wav'];
  const ambienceLoudnessOk = ambience.every((file) => {
    const lufs = manifestRenders[file].integratedLufs;
    return lufs >= AMBIENCE_LUFS_TARGET[0] && lufs <= AMBIENCE_LUFS_TARGET[1];
  });
  const nodeCount = manifestRenders['ambience-idle.wav'].persistentNodes;

  // Loop layers: with no bed, the slide and wall-run windows must be audible and
  // the gaps silent, proving updateState drives the continuous loops.
  const motionChannels = rendered['diag-motion-solo.wav'].channels;
  const motionSilentDb = segmentRmsDbfs(motionChannels, 0.3, 1.8, SAMPLE_RATE);
  const motionSlideDb = segmentRmsDbfs(motionChannels, 2.2, 3.9, SAMPLE_RATE);
  const motionWallrunDb = segmentRmsDbfs(motionChannels, 5.7, 7.4, SAMPLE_RATE);
  const motionLoops = {
    ok: motionSlideDb > motionSilentDb + 6 && motionWallrunDb > motionSilentDb + 6,
    silentGapRmsDbfs: motionSilentDb,
    slideRmsDbfs: motionSlideDb,
    wallrunRmsDbfs: motionWallrunDb,
    target: 'slide and wall-run loop windows >= 6 dB above the silent gap',
  };

  // Ducking: dispatch at t = 2 s must pull the ambience bus down.
  const duckChannels = rendered['diag-duck.wav'].channels;
  const duckPreDb = segmentRmsDbfs(duckChannels, 0.8, 1.9, SAMPLE_RATE);
  const duckPostDb = segmentRmsDbfs(duckChannels, 2.6, 4.2, SAMPLE_RATE);
  const ducking = {
    ok: duckPreDb - duckPostDb >= 3,
    preDuckRmsDbfs: duckPreDb,
    duringDuckRmsDbfs: duckPostDb,
    dropDb: round(duckPreDb - duckPostDb, 2),
    target: '>= 3 dB ambience/music drop after the dispatch cue',
  };

  // Music progression: the first two chords of the loop differ in register.
  const musicChannels = rendered['diag-music-solo.wav'].channels;
  const chordOne = spectrum(segmentChannels(musicChannels, 0.2, 3.3, SAMPLE_RATE), SAMPLE_RATE);
  const chordTwo = spectrum(segmentChannels(musicChannels, 3.7, 6.8, SAMPLE_RATE), SAMPLE_RATE);
  const musicProgression = {
    ok: Math.abs(chordOne.centroidHz - chordTwo.centroidHz) >= 5,
    chordOneName: 'Am9',
    chordTwoName: 'Fmaj7',
    chordOneCentroidHz: round(chordOne.centroidHz, 0),
    chordTwoCentroidHz: round(chordTwo.centroidHz, 0),
    target: 'the second chord window has a different spectral centre from the first',
  };

  const updateProbe = await page.evaluate(probeUpdateBudget);
  const perFrameAllocation = {
    ok: updateProbe.after === updateProbe.before && updateProbe.after <= NODE_BUDGET,
    nodesBefore: updateProbe.before,
    nodesAfter: updateProbe.after,
    frames: updateProbe.frames,
    target: 'updateState over 1200 frames creates no audio nodes',
  };

  const ambienceSolo = manifestRenders['diag-ambience-solo.wav'];
  const musicSolo = manifestRenders['diag-music-solo.wav'];
  const sfxSolo = manifestRenders['diag-sfx-solo.wav'];
  const stepsSolo = manifestRenders['diag-steps-solo.wav'];
  const share = (render, names) =>
    round(
      names.reduce((sum, name) => sum + render.bands[name], 0),
      4,
    );
  const mixTargets = {
    windCityUnder500Hz: {
      ok: ambienceSolo.under500HzShare >= 0.9,
      measuredShare: ambienceSolo.under500HzShare,
      target: '>= 0.90',
      render: 'diag-ambience-solo.wav',
    },
    musicPad100To800Hz: {
      ok: share(musicSolo, ['low', 'lowmid', 'mid']) >= 0.8,
      measuredShare: share(musicSolo, ['low', 'lowmid', 'mid']),
      target: '>= 0.80',
      render: 'diag-music-solo.wav',
    },
    steps800To4000Hz: {
      ok: share(stepsSolo, ['mid', 'highmid', 'high']) >= 0.5,
      spectralCentroidHz: stepsSolo.spectralCentroidHz,
      measuredShare: share(stepsSolo, ['mid', 'highmid', 'high']),
      target: '800-4000 Hz bands + high >= 0.50 of footstep energy',
      render: 'diag-steps-solo.wav',
    },
    sfxPeakBelowMinus3Dbfs: {
      ok: sfxSolo.truePeakDbfs < -3,
      truePeakDbfs: sfxSolo.truePeakDbfs,
      target: '< -3 dBFS',
      render: 'diag-sfx-solo.wav',
    },
  };

  const idleLufs = manifestRenders['ambience-idle.wav'].integratedLufs;
  const courtyardLufs = manifestRenders['courtyard.wav'].integratedLufs;
  const idleCentroid = manifestRenders['ambience-idle.wav'].spectralCentroidHz;
  const courtyardCentroid = manifestRenders['courtyard.wav'].spectralCentroidHz;
  const enclosureComparison = {
    ok: courtyardLufs < idleLufs && courtyardCentroid < idleCentroid,
    openRooftop: { integratedLufs: idleLufs, spectralCentroidHz: idleCentroid },
    courtyard: { integratedLufs: courtyardLufs, spectralCentroidHz: courtyardCentroid },
    note:
      'The courtyard render at rest should be quieter and darker than the open rooftop bed: ' +
      'wind/city drop, the city bed is low-passed and the reverb return is raised.',
  };

  const manifest = {
    tool: 'tools/audio-render.mjs',
    engine: 'OfflineAudioContext (browser)',
    generatedAt: new Date().toISOString(),
    url: BASE,
    sampleRate: SAMPLE_RATE,
    channels: 2,
    format: 'WAV 24-bit PCM',
    masterVolume: manifestRenders['ambience-idle.wav'].masterVolume,
    graphBudget: { persistentNodes: nodeCount, limit: NODE_BUDGET, ok: nodeCount <= NODE_BUDGET },
    checks: {
      clipping: {
        ok: !Object.values(manifestRenders).some((render) => render.clipped),
        truePeakLimitDbfs: CLIP_TRUE_PEAK_DBFS,
      },
      silence: {
        ok: !Object.values(manifestRenders).some((render) => render.silent),
        lufsThreshold: SILENCE_LUFS,
      },
      ambienceLoudness: {
        ok: ambienceLoudnessOk,
        targetLufs: AMBIENCE_LUFS_TARGET,
        measuredLufs: Object.fromEntries(
          ambience.map((file) => [file, manifestRenders[file].integratedLufs]),
        ),
        note: 'Mix target from the brief; reported as a design check, not a hard failure.',
      },
      enclosureCrossfade: enclosureComparison,
      motionLoops,
      ducking,
      musicProgression,
      perFrameAllocation,
      mixTargets,
      failureCount: failures.length,
      failures,
    },
    bandEdgesHz: Object.fromEntries(BANDS.map(([name, low, high]) => [name, [low, high]])),
    renders: manifestRenders,
    diagnostics: [
      'diag-ambience-solo.wav',
      'diag-music-solo.wav',
      'diag-steps-solo.wav',
      'diag-sfx-solo.wav',
    ],
    notes: [
      'Integrated loudness: approximate ITU-R BS.1770 with K-weighting, 400 ms blocks, 100 ms hop, absolute + relative gating.',
      'True peak: 4x oversampled windowed-sinc interpolation (12 taps/phase).',
      'Spectral centroid and band energies: averaged 4096-point FFT frames with a Hann window.',
      'Renders run the real game graph through the default master volume (0.55); they are not normalized.',
    ],
  };
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('');
  console.log(`wrote ${Object.keys(manifestRenders).length} WAVs + manifest.json to ${OUT}`);
  console.log(
    `graph: ${nodeCount} persistent nodes (budget ${NODE_BUDGET}); ` +
      `ambience loudness target ${AMBIENCE_LUFS_TARGET[0]}..${AMBIENCE_LUFS_TARGET[1]} LUFS ` +
      `(${ambienceLoudnessOk ? 'within target' : 'outside target'})`,
  );
  console.log(
    `layers: wind/city <500 Hz ${(ambienceSolo.under500HzShare * 100).toFixed(1)}% (target >= 90%) · ` +
      `pad 100-800 Hz ${(share(musicSolo, ['low', 'lowmid', 'mid']) * 100).toFixed(1)}% (>= 80%) · ` +
      `sfx ${sfxSolo.spectralCentroidHz} Hz centroid, ` +
      `steps 800-4000 ${(share(stepsSolo, ['mid', 'highmid', 'high']) * 100).toFixed(1)}%`,
  );
  console.log(
    `enclosure: rooftop ${idleLufs} LUFS / ${idleCentroid} Hz → courtyard ` +
      `${courtyardLufs} LUFS / ${courtyardCentroid} Hz`,
  );
  console.log(
    `loops: silent ${motionSilentDb} dBFS → slide ${motionSlideDb} dBFS → wallrun ${motionWallrunDb} dBFS · ` +
      `duck drop ${ducking.dropDb} dB · chords ${musicProgression.chordOneCentroidHz}→${musicProgression.chordTwoCentroidHz} Hz · ` +
      `updateState nodes ${updateProbe.before}→${updateProbe.after}/${updateProbe.frames} frames`,
  );
  if (failures.length) {
    console.error('AUDIO RENDER FAILED:');
    for (const failure of failures) console.error(` - ${failure}`);
    await browser.close();
    process.exitCode = 1;
    return;
  }
  await browser.close();
  console.log('audio renders OK: no clipping, no silent renders, node budget respected');
}

main().catch(async (error) => {
  console.error(error);
  try {
    await activeBrowser?.close();
  } catch {
    /* browser may not have launched */
  }
  process.exitCode = 1;
});
