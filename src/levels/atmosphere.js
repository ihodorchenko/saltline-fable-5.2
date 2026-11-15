// @ts-check
// Air and grade for GLASSLINE. Three things stack here: scene fog, the engine's
// volumetric scattering (sigma, far haze, ambient) and a global saturation/tone
// grade. Tuned together, but note the measured finding in docs/VISUAL_GAP.md:
// air is a *minor* lever (+11 % top-third contrast); the flattened look came from
// exposure, the light rig and the missing sky. Compare in the browser with:
//   ?haze=0.5   thinner air   (?haze=0 no haze, ?haze=2 heavier)
//   ?atmo=off   the previous look (scene fog and engine defaults)

export const ATMOSPHERE = {
  // Glare is kept on the sun and speculars only: the sun is ~10 stops above the
  // white roofs, so a low threshold blooms the whole sky instead of the sun.
  base: { bloom: 0.05, bloomThreshold: 2.6, streakThreshold: 2.0 },
  // Engine defaults in brackets: lookSat [1.22], lookPower [1.18], agxMix [0.25],
  // dirt [0.1]. lookPower is a `#define` inside the AgX branch only, so with
  // agxMix 0 it is inert; the contrast curve now comes from the ACES-side
  // S-curve in the grade pass. lookSat is a mild global lift; most of the
  // reference's saturation must come from the sky, accents and materials.
  look: { lookSat: 1.18, lookPower: 1.28, agxMix: 0, dirt: 0.02, saturation: 0.96 },
  // Engine defaults in brackets: volSigma [0.0034], volFarHaze [0.42],
  // volAmbient [0.2], volSunScale [0.85]. All but volSunScale scale with ?haze.
  // The audit measured air alone as a minor lever (+11 % top-third contrast);
  // this is mostly about one consistent pale-blue palette.
  haze: { volSigma: 0.0012, volFarHaze: 0.1, volAmbient: 0.05, volSunScale: 0.75 },
  // Scene FogExp2 density [was 0.0018].
  fogDensity: 0.0006,
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
      // uSaturation is the live grade saturation (lookSat lives in the AgX branch
      // and is inert while agxMix is 0).
      if (game.render?.post && Number.isFinite(ATMOSPHERE.look.saturation)) {
        game.render.post.saturation = ATMOSPHERE.look.saturation;
      }
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
