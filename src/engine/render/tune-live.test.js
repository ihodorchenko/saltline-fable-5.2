import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The post pipeline used to bake these tune values when its materials were created,
// so changing render.tune.* at runtime silently did nothing. This contract test keeps
// the per-frame sync in the engine source (a WebGL render is not available in Vitest).
const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8');

describe('render.tune is applied live', () => {
  it('refreshes the volumetric uniforms every frame', () => {
    expect(source).toMatch(/H\.uniforms\.uSigma\.value=g\.volSigma/);
    expect(source).toMatch(/H\.uniforms\.uFarHaze\.value=g\.volFarHaze/);
    expect(source).toMatch(/H\.uniforms\.uMaxDist\.value=g\.volMaxDist/);
  });

  it('recompiles the grade pass when lookSat or lookPower change', () => {
    expect(source).toMatch(/Q\.defines\.LOOK_SAT!==g\.lookSat\.toFixed\(3\)/);
    expect(source).toMatch(/Q\.defines\.LOOK_POWER=g\.lookPower\.toFixed\(3\)/);
    expect(source).toMatch(/Q\.needsUpdate=!0/);
  });

  it('only recompiles on change, not every frame', () => {
    expect(source).toMatch(/\(Q\.defines\.LOOK_SAT!==.*\|\|Q\.defines\.LOOK_POWER!==.*\)&&\(/);
  });
});
