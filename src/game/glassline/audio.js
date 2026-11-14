// @ts-check
// Original procedural GLASSLINE audio: no samples, no external music. The
// AudioContext only starts after a user gesture (the START button).

export const AUDIO_KEY = 'glassline.audio.v1';

/**
 * @param {number} value
 * @returns {number}
 */
export function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
    return {
      volume: Number.isFinite(data.volume) ? clampVolume(data.volume) : 0.55,
      muted: data.muted === true,
    };
  } catch {
    return { volume: 0.55, muted: false };
  }
}

export function createGlasslineAudio() {
  const saved = loadSettings();
  let volume = saved.volume;
  let muted = saved.muted;
  let context = null;
  let master = null;
  let musicGain = null;
  let windGain = null;
  let noiseBuffer = null;
  let started = false;
  let disposed = false;
  const sources = [];
  const offs = [];

  function persist() {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ volume, muted }));
    } catch {
      /* storage is optional */
    }
  }

  function ensure() {
    if (context || disposed) return !!context;
    const AudioContextClass =
      globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function startAmbience() {
    if (!context || !master) return;
    // Wind: looping filtered noise.
    const wind = context.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 0.7;
    windGain = context.createGain();
    windGain.gain.value = 0.018;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    sources.push(wind);

    // Original slow pad: A2 / E3 / A3 with a breathing filter.
    musicGain = context.createGain();
    musicGain.gain.value = 0.026;
    const musicFilter = context.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 620;
    musicGain.connect(master);
    musicFilter.connect(musicGain);
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.055;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(musicFilter.frequency);
    lfo.start();
    sources.push(lfo);
    for (const [frequency, gainValue] of [
      [110, 0.5],
      [164.81, 0.28],
      [220, 0.22],
      [329.63, 0.08],
    ]) {
      const oscillator = context.createOscillator();
      oscillator.type = frequency === 110 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = gainValue;
      oscillator.connect(gain).connect(musicFilter);
      oscillator.start();
      sources.push(oscillator);
    }
  }

  function start() {
    if (disposed) return;
    if (!ensure()) return;
    if (started) {
      context?.resume?.().catch?.(() => {});
      return;
    }
    started = true;
    context?.resume?.().catch?.(() => {});
    startAmbience();
  }

  function tone({
    frequency = 440,
    endFrequency = frequency,
    duration = 0.15,
    type = 'sine',
    gain = 0.06,
    delay = 0,
  } = {}) {
    if (!started || muted || !context || !master) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      now + duration,
    );
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function noise({
    duration = 0.2,
    cutoff = 900,
    gain = 0.05,
    type = 'lowpass',
    q = 0.8,
    delay = 0,
  } = {}) {
    if (!started || muted || !context || !master || !noiseBuffer) return;
    const now = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, cutoff * 0.35),
      now + duration,
    );
    filter.Q.value = q;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function play(name, payload = {}) {
    if (!started || muted) return;
    switch (name) {
      case 'ui':
        tone({ frequency: 720, endFrequency: 520, duration: 0.06, gain: 0.035 });
        break;
      case 'step':
        noise({ duration: 0.055, cutoff: 1800, gain: 0.018, type: 'highpass' });
        break;
      case 'jump':
        tone({ frequency: 220, endFrequency: 520, duration: 0.16, gain: 0.055 });
        noise({ duration: 0.09, cutoff: 1200, gain: 0.025 });
        break;
      case 'land': {
        const impact = Math.min(1, Math.abs(payload.impact || 0) / 8);
        tone({ frequency: 95, endFrequency: 55, duration: 0.2, gain: 0.06 + impact * 0.04 });
        noise({ duration: 0.16, cutoff: 500, gain: 0.04 + impact * 0.03 });
        break;
      }
      case 'slide':
        noise({ duration: 0.38, cutoff: 1400, gain: 0.06, q: 1.2 });
        tone({ frequency: 170, endFrequency: 120, duration: 0.32, gain: 0.028 });
        break;
      case 'vault':
        noise({ duration: 0.2, cutoff: 1600, gain: 0.045 });
        tone({ frequency: 300, endFrequency: 440, duration: 0.16, gain: 0.035 });
        break;
      case 'mantle':
        noise({ duration: 0.24, cutoff: 700, gain: 0.04 });
        tone({ frequency: 180, endFrequency: 290, duration: 0.22, gain: 0.04 });
        break;
      case 'wallrun':
        noise({ duration: 0.55, cutoff: 1100, gain: 0.05, q: 1.4 });
        break;
      case 'wallclimb':
        tone({ frequency: 160, endFrequency: 330, duration: 0.4, gain: 0.04 });
        noise({ duration: 0.4, cutoff: 800, gain: 0.03 });
        break;
      case 'roll':
        noise({ duration: 0.3, cutoff: 650, gain: 0.05 });
        tone({ frequency: 140, endFrequency: 90, duration: 0.25, gain: 0.03 });
        break;
      case 'checkpoint':
        tone({ frequency: 660, duration: 0.16, gain: 0.05 });
        tone({ frequency: 880, duration: 0.24, gain: 0.04, delay: 0.12 });
        break;
      case 'finish':
        tone({ frequency: 220, duration: 0.9, gain: 0.06 });
        tone({ frequency: 330, duration: 1.1, gain: 0.045, delay: 0.08 });
        tone({ frequency: 440, duration: 1.25, gain: 0.04, delay: 0.16 });
        break;
      case 'respawn':
        tone({ frequency: 180, endFrequency: 120, duration: 0.3, gain: 0.035 });
        break;
      default:
        break;
    }
  }

  function bind(events) {
    if (!events || !events.on) return () => {};
    const map = {
      'glassline:jump': () => play('jump'),
      'glassline:land': (payload) => play('land', payload),
      'glassline:step': () => play('step'),
      'glassline:slide': () => play('slide'),
      'glassline:vault': () => play('vault'),
      'glassline:mantle': () => play('mantle'),
      'glassline:wallrun': () => play('wallrun'),
      'glassline:wallclimb': () => play('wallclimb'),
      'glassline:roll': () => play('roll'),
      'glassline:checkpoint': () => play('checkpoint'),
      'glassline:finish': () => play('finish'),
      'glassline:respawn': () => play('respawn'),
    };
    for (const [name, handler] of Object.entries(map)) {
      offs.push(events.on(name, handler));
    }
    return () => {
      for (const off of offs.splice(0)) off();
    };
  }

  function setVolume(value) {
    volume = clampVolume(value);
    if (master) {
      master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.03);
    }
    persist();
  }

  function setMuted(value) {
    muted = !!value;
    if (master) {
      master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.03);
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
    for (const off of offs.splice(0)) off();
    context?.close?.().catch?.(() => {});
    context = null;
    started = false;
  }

  return {
    start,
    play,
    bind,
    setVolume,
    setMuted,
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
  };
}
