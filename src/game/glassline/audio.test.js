import { describe, expect, it } from 'vitest';
import {
  AUDIO_KEY,
  CHORD_SECONDS,
  MUSIC_CHORDS,
  audioMotion,
  clampVolume,
  cuePan,
  duckEnvelope,
  enclosureAmount,
  enclosureMix,
  hashUnit,
  landingPower,
  motionLayers,
  musicAt,
  musicIndexAt,
  smoothstep,
  stepCadence,
  stepVariation,
  surfaceResponse,
} from './audio.js';

describe('glassline audio settings', () => {
  it('keeps the persisted settings key stable', () => {
    expect(AUDIO_KEY).toBe('glassline.audio.v1');
  });

  it('clamps volume to a safe range', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0.55)).toBe(0.55);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume('nope')).toBe(0);
  });

  it('maps landing impact to a bounded intensity', () => {
    expect(landingPower(-2)).toBe(0.3);
    expect(landingPower(-14)).toBe(1);
    expect(landingPower(-7)).toBeCloseTo(0.5);
    expect(landingPower('bad')).toBe(0.3);
  });
});

describe('audio motion mix', () => {
  it('opens the wind and synth with speed', () => {
    const idle = audioMotion(0);
    const sprint = audioMotion(12);
    expect(sprint.windGain).toBeGreaterThan(idle.windGain);
    expect(sprint.windFrequency).toBeGreaterThan(idle.windFrequency);
    expect(sprint.windHighGain).toBeGreaterThan(idle.windHighGain);
    expect(sprint.windHighFrequency).toBeGreaterThan(idle.windHighFrequency);
    expect(sprint.clothGain).toBeGreaterThan(idle.clothGain);
    expect(sprint.clothFrequency).toBeGreaterThan(idle.clothFrequency);
    expect(sprint.musicCutoff).toBeGreaterThan(idle.musicCutoff);
    expect(sprint.musicGain).toBeGreaterThan(idle.musicGain);
    expect(sprint.arpGain).toBeGreaterThan(idle.arpGain);
  });

  it('moves the finale to a louder, darker wind bed', () => {
    const finale = audioMotion(0, true);
    const sprint = audioMotion(12);
    expect(finale.windGain).toBeGreaterThan(0.8);
    expect(finale.windGain).toBeGreaterThan(audioMotion(0).windGain);
    expect(finale.musicCutoff).toBeLessThan(sprint.musicCutoff);
    expect(finale.windFrequency).toBeLessThan(sprint.windFrequency);
  });

  it('stays finite and bounded for hostile input', () => {
    for (const speed of [-5, 0, 3.2, 7, 12, 99, NaN, Infinity]) {
      const mix = audioMotion(speed);
      for (const [key, value] of Object.entries(mix)) {
        expect(Number.isFinite(value), `${key} for ${speed}`).toBe(true);
      }
      expect(mix.windGain).toBeGreaterThanOrEqual(0);
      expect(mix.clothGain).toBeGreaterThanOrEqual(0);
    }
  });

  it('can reuse an output object so the per-frame path does not allocate', () => {
    const out = {};
    const result = audioMotion(5, false, out);
    expect(result).toBe(out);
  });
});

describe('surface response', () => {
  it('gives concrete, metal and planter distinct timbres', () => {
    const concrete = surfaceResponse('concrete');
    const metal = surfaceResponse('metal');
    const planter = surfaceResponse('planter');
    expect(metal.bodyFrequency).toBeGreaterThan(concrete.bodyFrequency);
    expect(metal.clickCutoff).toBeGreaterThan(concrete.clickCutoff);
    expect(metal.noiseQ).toBeGreaterThan(planter.noiseQ);
    expect(planter.noiseCutoff).toBeLessThan(metal.noiseCutoff);
    expect(concrete.bodyGain).toBeGreaterThan(metal.bodyGain);
  });

  it('falls back to concrete for unknown or missing surfaces', () => {
    expect(surfaceResponse().name).toBe('concrete');
    expect(surfaceResponse('lava').name).toBe('concrete');
    expect(surfaceResponse(/** @type {any} */ (42)).name).toBe('concrete');
    expect(surfaceResponse(' Metal ').name).toBe('metal');
  });

  it('keeps every response bounded and usable', () => {
    for (const name of ['concrete', 'metal', 'planter', 'wood', 'gravel', 'water']) {
      const response = surfaceResponse(name);
      expect(response.bodyFrequency).toBeGreaterThan(20);
      expect(response.bodyEnd).toBeGreaterThan(0);
      expect(response.bodyDuration).toBeGreaterThan(0);
      expect(response.noiseCutoff).toBeGreaterThan(30);
      expect(response.noiseDuration).toBeGreaterThan(0);
      expect(response.noiseGain).toBeGreaterThan(0);
      expect(response.clickCutoff).toBeGreaterThan(0);
      expect(response.bodyGain).toBeGreaterThan(0);
    }
  });
});

describe('step cadence and variation', () => {
  it('is deterministic for a given step index', () => {
    const first = stepVariation(17, 6);
    const second = stepVariation(17, 6);
    expect(second).toEqual(first);
    expect(hashUnit(17)).toBe(hashUnit(17));
  });

  it('alternates feet and keeps the pan subtle', () => {
    const even = stepVariation(0);
    const odd = stepVariation(1);
    expect(even.side).toBe(-1);
    expect(odd.side).toBe(1);
    expect(Math.sign(even.pan)).toBe(-1);
    expect(Math.sign(odd.pan)).toBe(1);
    expect(Math.abs(even.pan)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(odd.pan)).toBeLessThanOrEqual(0.3);
  });

  it('keeps pitch and weight in a safe variation band', () => {
    for (let index = 0; index < 64; index += 1) {
      const variation = stepVariation(index, index % 2 ? 8 : 0);
      expect(variation.pitch).toBeGreaterThanOrEqual(0.92);
      expect(variation.pitch).toBeLessThanOrEqual(1.08);
      expect(variation.weight).toBeGreaterThan(0.8);
      expect(variation.weight).toBeLessThan(1.6);
    }
  });

  it('reports the stride cadence of the player controller', () => {
    expect(stepCadence(2.7).strideMeters).toBe(1.35);
    expect(stepCadence(7.2).strideMeters).toBe(1.75);
    expect(stepCadence(7.2).cadenceHz).toBeGreaterThan(stepCadence(2.7).cadenceHz);
    expect(stepCadence(-4).cadenceHz).toBe(0);
    expect(stepCadence(99).speed).toBe(12);
  });
});

describe('spatial cue pan', () => {
  const listener = { x: 0, z: 0, yaw: 0 };

  it('centres a cue that is straight ahead', () => {
    const cue = cuePan({ x: 0, z: -10 }, listener);
    expect(cue.pan).toBeCloseTo(0);
    expect(cue.distance).toBeCloseTo(10);
    expect(cue.attenuation).toBeGreaterThan(0.3);
    expect(cue.attenuation).toBeLessThan(1);
  });

  it('pans right and left by the camera yaw', () => {
    expect(cuePan({ x: 6, z: -10 }, listener).pan).toBeGreaterThan(0.3);
    expect(cuePan({ x: -6, z: -10 }, listener).pan).toBeLessThan(-0.3);
    // Turning 90 degrees right makes +X straight ahead.
    const turned = cuePan({ x: 10, z: 0 }, { x: 0, z: 0, yaw: -Math.PI / 2 });
    expect(Math.abs(turned.pan)).toBeLessThan(0.05);
  });

  it('attenuates with distance and accepts array targets', () => {
    const near = cuePan([0, 1, -2], listener);
    const far = cuePan([0, 1, -80], listener);
    expect(near.attenuation).toBeGreaterThan(far.attenuation);
    expect(far.attenuation).toBeGreaterThanOrEqual(0.22);
    const onTop = cuePan([3, 1, 4], listener);
    expect(onTop.distance).toBeCloseTo(5);
    expect(Math.abs(onTop.pan)).toBeLessThanOrEqual(1);
  });

  it('returns a centred, unattenuated cue at the listener', () => {
    expect(cuePan({ x: 0, z: 0 }, listener)).toEqual({
      pan: 0,
      attenuation: 1,
      distance: 0,
    });
  });
});

describe('enclosure crossfade', () => {
  const zones = [
    {
      id: 'courtyard',
      min: [-7, -13, -130],
      max: [7, 4, -102],
      enclosure: 1,
      fade: 3,
    },
  ];

  it('is open on the roofs and fully enclosed in the courtyard', () => {
    expect(enclosureAmount({ x: 0, z: 10 }, zones)).toBe(0);
    expect(enclosureAmount({ x: 0, y: 0, z: -110 }, zones)).toBe(1);
  });

  it('fades across the walls and the roof line', () => {
    const edge = enclosureAmount({ x: 0, y: 0, z: -102.05 }, zones);
    const deep = enclosureAmount({ x: 0, y: 0, z: -105 }, zones);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(0.2);
    expect(deep).toBeGreaterThan(edge);
    // Above the walls is outside the zone.
    expect(enclosureAmount({ x: 0, y: 5, z: -110 }, zones)).toBe(0);
  });

  it('handles missing or malformed zones safely', () => {
    expect(enclosureAmount({ x: 0, z: 0 })).toBe(0);
    expect(enclosureAmount({ x: 0, z: 0 }, /** @type {any} */ (null))).toBe(0);
    expect(enclosureAmount({ x: 0, z: -110 }, [/** @type {any} */ ({})])).toBe(0);
  });

  it('takes the strongest overlapping zone and respects its weight', () => {
    const half = [
      { min: [-7, -13, -130], max: [7, 4, -102], enclosure: 0.5, fade: 1 },
      { min: [-2, -13, -120], max: [2, 4, -110], enclosure: 1, fade: 1 },
    ];
    expect(enclosureAmount({ x: 0, y: 0, z: -115 }, half)).toBe(1);
    expect(enclosureAmount({ x: 5, y: 0, z: -110 }, half)).toBeCloseTo(0.5);
  });

  it('maps enclosure to a muffled, wetter mix', () => {
    const open = enclosureMix(0);
    const enclosed = enclosureMix(1);
    expect(open.windScale).toBe(1);
    expect(open.reverbAdd).toBe(0);
    expect(open.airCutoff).toBeGreaterThan(15000);
    expect(enclosed.windScale).toBeLessThan(open.windScale);
    expect(enclosed.cityScale).toBeLessThan(open.cityScale);
    expect(enclosed.trafficScale).toBeLessThan(open.trafficScale);
    expect(enclosed.airCutoff).toBeLessThan(4000);
    expect(enclosed.reverbAdd).toBeGreaterThan(0.1);
    // Monotonic crossfade between the two states.
    let previous = enclosureMix(0);
    for (const amount of [0.25, 0.5, 0.75]) {
      const next = enclosureMix(amount);
      expect(next.windScale).toBeLessThan(previous.windScale);
      expect(next.airCutoff).toBeLessThan(previous.airCutoff);
      expect(next.reverbAdd).toBeGreaterThan(previous.reverbAdd);
      previous = next;
    }
  });
});

describe('duck envelope', () => {
  it('provides a depth and hold for each stinger', () => {
    for (const kind of ['dispatch', 'checkpoint', 'finish', 'respawn']) {
      const envelope = duckEnvelope(kind);
      expect(envelope.depth).toBeGreaterThan(0);
      expect(envelope.depth).toBeLessThan(1);
      expect(envelope.hold).toBeGreaterThan(0.5);
    }
  });

  it('ducks furthest for dispatch and least for checkpoint', () => {
    expect(duckEnvelope('dispatch').depth).toBeLessThan(duckEnvelope('checkpoint').depth);
    expect(duckEnvelope('dispatch').depth).toBeLessThan(duckEnvelope('finish').depth);
    expect(duckEnvelope('checkpoint').hold).toBeLessThan(duckEnvelope('dispatch').hold);
  });

  it('falls back to a short cue duck for unknown kinds', () => {
    const fallback = duckEnvelope('mystery');
    expect(fallback.name).toBe('cue');
    expect(fallback.depth).toBeLessThan(1);
    expect(fallback.hold).toBeCloseTo(0.8);
  });
});

describe('motion loop layers', () => {
  it('is silent when the controller is not sliding or wall-running', () => {
    const layers = motionLayers({ speed: 6 });
    expect(layers.slideGain).toBe(0);
    expect(layers.wallrunGain).toBe(0);
  });

  it('opens friction when sliding and scuff when wall-running', () => {
    const slide = motionLayers({ sliding: true, speed: 6 });
    const wallrun = motionLayers({ wallrunning: true, speed: 6 });
    expect(slide.slideGain).toBeGreaterThan(0);
    expect(slide.slideFrequency).toBeGreaterThan(800);
    expect(wallrun.wallrunGain).toBeGreaterThan(0);
    expect(wallrun.wallrunFrequency).toBeGreaterThan(700);
  });

  it('opens the friction band with speed and reuses the out object', () => {
    const slow = motionLayers({ sliding: true, speed: 1 });
    const fast = motionLayers({ sliding: true, speed: 8 });
    expect(fast.slideFrequency).toBeGreaterThan(slow.slideFrequency);
    expect(fast.slideGain).toBeGreaterThan(slow.slideGain);
    const out = {};
    expect(motionLayers({ sliding: true, speed: 4 }, out)).toBe(out);
  });
});

describe('music progression', () => {
  it('keeps an original four-chord loop', () => {
    expect(MUSIC_CHORDS.length).toBe(4);
    expect(CHORD_SECONDS).toBeGreaterThanOrEqual(3);
    expect(CHORD_SECONDS).toBeLessThanOrEqual(4);
    for (const chord of MUSIC_CHORDS) {
      expect(chord.name).toBeTruthy();
      expect(chord.notes.length).toBe(4);
      expect(chord.bass).toBeLessThan(chord.notes[0]);
    }
    const names = new Set(MUSIC_CHORDS.map((chord) => chord.name));
    expect(names.size).toBe(4);
  });

  it('advances a chord every 3.5 seconds and loops', () => {
    expect(musicIndexAt(0)).toBe(0);
    expect(musicIndexAt(CHORD_SECONDS - 0.01)).toBe(0);
    expect(musicIndexAt(CHORD_SECONDS)).toBe(1);
    expect(musicIndexAt(CHORD_SECONDS * 4)).toBe(0);
    expect(musicIndexAt(-5)).toBe(0);
    expect(musicIndexAt(Number.NaN)).toBe(0);
  });

  it('describes the chord that is playing', () => {
    const first = musicAt(0);
    expect(first.index).toBe(0);
    expect(first.name).toBe('Am9');
    expect(first.startsAt).toBe(0);
    expect(first.endsAt).toBe(CHORD_SECONDS);
    expect(first.notes).toEqual([...MUSIC_CHORDS[0].notes]);
    const second = musicAt(CHORD_SECONDS + 0.1);
    expect(second.index).toBe(1);
    expect(second.name).toBe('Fmaj7');
    expect(second.startsAt).toBe(CHORD_SECONDS);
    // Mutating the returned notes must not corrupt the loop data.
    second.notes[0] = 1;
    expect(MUSIC_CHORDS[1].notes[0]).toBe(87.31);
  });
});

describe('smoothstep', () => {
  it('is clamped and monotonic', () => {
    expect(smoothstep(0, 2, -1)).toBe(0);
    expect(smoothstep(0, 2, 0)).toBe(0);
    expect(smoothstep(0, 2, 1)).toBeCloseTo(0.5);
    expect(smoothstep(0, 2, 3)).toBe(1);
    expect(smoothstep(0, 0, 1)).toBe(1);
  });
});

describe('glassline high air band', () => {
  it('opens with speed and lifts for the finale', () => {
    const idle = audioMotion(0);
    const sprint = audioMotion(12);
    const finale = audioMotion(0, true);
    expect(idle.airGain).toBeGreaterThan(0);
    expect(sprint.airGain).toBeGreaterThan(idle.airGain * 2);
    expect(finale.airGain).toBeGreaterThan(sprint.airGain);
    expect(sprint.airFrequency).toBeGreaterThan(idle.airFrequency);
  });

  it('keeps the air band quiet relative to the wind body', () => {
    const sprint = audioMotion(12);
    // The air layer is colour, not loudness: it must stay well under the low wind
    // so the rooftop still reads as wind rather than hiss.
    expect(sprint.airGain).toBeLessThan(sprint.windGain * 0.12);
  });

  it('muffles the air band when the player goes indoors', () => {
    const outside = enclosureMix(0);
    const inside = enclosureMix(1);
    expect(inside.airScale).toBeLessThan(outside.airScale);
    expect(inside.airScale).toBeGreaterThan(0);
  });
});
