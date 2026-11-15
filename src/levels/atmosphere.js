// @ts-check
// Air and grade for GLASSLINE. The haze that flattens the scene is stacked: scene
// fog, the engine's volumetric scattering (sigma, far haze, ambient) and a global
// saturation/tone grade. They are tuned together here. Values are starting points
// for look-dev; compare in the browser with:
//   ?haze=0.5   thinner air   (?haze=0 no haze, ?haze=2 heavier)
//   ?atmo=off   the previous look (scene fog and engine defaults)

export const ATMOSPHERE = {
  // The existing GLASSLINE bloom look, unchanged.
  base: { bloom: 0.09, bloomThreshold: 1.8, streakThreshold: 1.15 },
  // Engine defaults in brackets: lookSat [1.22], lookPower [1.18], agxMix [0.25], dirt [0.1].
  // lookSat stays at the engine default on purpose: the palette is muted at the
  // source, and lowering global saturation would also mute the red route.
  // lookPower is the contrast curve (pow on the graded colour: deepens mids and
  // shadows, whites stay), the main lever against the washed-out look.
  look: { lookSat: 1.22, lookPower: 1.28, agxMix: 0.12, dirt: 0.04 },
  // Engine defaults in brackets: volSigma [0.0034], volFarHaze [0.42],
  // volAmbient [0.2], volSunScale [0.85]. All but volSunScale scale with ?haze.
  haze: { volSigma: 0.002, volFarHaze: 0.22, volAmbient: 0.1, volSunScale: 0.75 },
  // Scene FogExp2 density [was 0.0018].
  fogDensity: 0.0011,
};

/**
 * @param {string} [search] location.search
 * @returns {{enabled: boolean, haze: number}}
 */
export function resolveAtmosphere(search = '') {
  const params = new URLSearchParams(search);
  const raw = params.get('haze');
  const parsed = raw === null || raw.trim() === '' ? NaN : Number(raw);
  const haze = Number.isFinite(parsed) ? Math.min(4, Math.max(0, parsed)) : 1;
  return { enabled: params.get('atmo') !== 'off', haze };
}

/**
 * Apply the atmosphere to a game. Safe without a render engine or fog.
 * @param {any} game
 * @param {string} [search] defaults to the page's query string
 */
export function applyAtmosphere(game, search = typeof window !== 'undefined' ? window.location.search : '') {
  const { enabled, haze } = resolveAtmosphere(search);
  const tune = game.render?.tune;
  if (tune) {
    Object.assign(tune, ATMOSPHERE.base);
    if (enabled) {
      const h = ATMOSPHERE.haze;
      Object.assign(tune, ATMOSPHERE.look);
      tune.volSigma = h.volSigma * haze;
      tune.volFarHaze = Math.min(1, h.volFarHaze * haze);
      tune.volAmbient = h.volAmbient * haze;
      tune.volSunScale = h.volSunScale;
    }
  }
  const fog = game.scene?.fog;
  if (enabled && fog && typeof fog.density === 'number') {
    fog.density = ATMOSPHERE.fogDensity * haze;
  }
}
