import { describe, expect, it } from 'vitest';
import { ATMOSPHERE, applyAtmosphere, resolveAtmosphere } from './atmosphere.js';

const ENGINE = {
  volSigma: 0.0034,
  volFarHaze: 0.42,
  volAmbient: 0.2,
  lookSat: 1.22,
  lookPower: 1.18,
  agxMix: 0.25,
  dirt: 0.1,
};
const OLD_FOG = 0.0018;

const makeGame = () => ({ render: { tune: {} }, scene: { fog: { density: OLD_FOG } } });

describe('resolveAtmosphere', () => {
  it('defaults to enabled at haze 1', () => {
    expect(resolveAtmosphere('')).toEqual({ enabled: true, haze: 1 });
    expect(resolveAtmosphere('?q=high')).toEqual({ enabled: true, haze: 1 });
  });

  it('reads atmo=off and haze scale, clamped to 0..4', () => {
    expect(resolveAtmosphere('?atmo=off').enabled).toBe(false);
    expect(resolveAtmosphere('?haze=0.5').haze).toBe(0.5);
    expect(resolveAtmosphere('?haze=99').haze).toBe(4);
    expect(resolveAtmosphere('?haze=-3').haze).toBe(0);
  });

  it('ignores junk and empty haze values', () => {
    expect(resolveAtmosphere('?haze=abc').haze).toBe(1);
    expect(resolveAtmosphere('?haze=').haze).toBe(1);
  });
});

describe('atmosphere targets', () => {
  it('is clearer than the engine defaults but not haze-free', () => {
    expect(ATMOSPHERE.haze.volSigma).toBeLessThan(ENGINE.volSigma);
    expect(ATMOSPHERE.haze.volFarHaze).toBeLessThan(ENGINE.volFarHaze);
    expect(ATMOSPHERE.haze.volAmbient).toBeLessThan(ENGINE.volAmbient);
    expect(ATMOSPHERE.fogDensity).toBeLessThan(OLD_FOG);
    expect(ATMOSPHERE.haze.volSigma).toBeGreaterThan(0);
    expect(ATMOSPHERE.fogDensity).toBeGreaterThan(0);
  });

  it('raises contrast without muting the red route', () => {
    expect(ATMOSPHERE.look.lookSat).toBeGreaterThanOrEqual(1.15);
    expect(ATMOSPHERE.look.lookPower).toBeGreaterThan(ENGINE.lookPower);
    expect(ATMOSPHERE.look.lookPower).toBeLessThanOrEqual(1.4);
    expect(ATMOSPHERE.look.agxMix).toBeLessThan(ENGINE.agxMix);
    expect(ATMOSPHERE.look.dirt).toBeLessThan(ENGINE.dirt);
  });
});

describe('applyAtmosphere', () => {
  it('sets haze, grade, bloom and fog by default', () => {
    const game = makeGame();
    applyAtmosphere(game, '');
    expect(game.render.tune.volSigma).toBe(ATMOSPHERE.haze.volSigma);
    expect(game.render.tune.volFarHaze).toBe(ATMOSPHERE.haze.volFarHaze);
    expect(game.render.tune.lookSat).toBe(ATMOSPHERE.look.lookSat);
    expect(game.render.tune.lookPower).toBe(ATMOSPHERE.look.lookPower);
    expect(game.render.tune.bloomThreshold).toBe(ATMOSPHERE.base.bloomThreshold);
    expect(game.scene.fog.density).toBe(ATMOSPHERE.fogDensity);
  });

  it('?atmo=off keeps the previous look but still sets the original bloom', () => {
    const game = makeGame();
    applyAtmosphere(game, '?atmo=off');
    expect(game.render.tune.volSigma).toBeUndefined();
    expect(game.render.tune.lookSat).toBeUndefined();
    expect(game.render.tune.lookPower).toBeUndefined();
    expect(game.render.tune.bloom).toBe(ATMOSPHERE.base.bloom);
    expect(game.scene.fog.density).toBe(OLD_FOG);
  });

  it('scales haze terms with ?haze and never past full far-haze', () => {
    const doubled = makeGame();
    applyAtmosphere(doubled, '?haze=2');
    expect(doubled.render.tune.volSigma).toBeCloseTo(ATMOSPHERE.haze.volSigma * 2);
    expect(doubled.scene.fog.density).toBeCloseTo(ATMOSPHERE.fogDensity * 2);
    const heavy = makeGame();
    applyAtmosphere(heavy, '?haze=4');
    expect(heavy.render.tune.volFarHaze).toBeLessThanOrEqual(1);
    const none = makeGame();
    applyAtmosphere(none, '?haze=0');
    expect(none.render.tune.volSigma).toBe(0);
    expect(none.scene.fog.density).toBe(0);
  });

  it('is a no-op without a render engine, tune or fog', () => {
    expect(() => applyAtmosphere({}, '')).not.toThrow();
    expect(() => applyAtmosphere({ render: {}, scene: { fog: {} } }, '')).not.toThrow();
  });
});
