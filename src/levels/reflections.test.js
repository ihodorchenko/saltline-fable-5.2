import { describe, expect, it } from 'vitest';
import {
  assignReflectionProbes,
  canCaptureReflections,
  createReflectionProbes,
  probePositions,
  resolveProbeQuality,
} from './reflections.js';

describe('reflection probe quality gate', () => {
  it('runs the scene capture above low quality only', () => {
    expect(resolveProbeQuality('low')).toBe(false);
    expect(resolveProbeQuality('medium')).toBe(true);
    expect(resolveProbeQuality('high')).toBe(true);
    expect(resolveProbeQuality('ultra')).toBe(true);
    expect(resolveProbeQuality(undefined)).toBe(true);
  });

  it('needs a renderer, a scene and the three cube/PMREM classes', () => {
    expect(canCaptureReflections(null)).toBe(false);
    expect(canCaptureReflections({})).toBe(false);
    expect(
      canCaptureReflections({
        THREE: { CubeCamera: class {}, PMREMGenerator: class {} },
        renderer: {},
        scene: {},
      }),
    ).toBe(true);
  });

  it('returns null instead of throwing when there is no renderer', () => {
    expect(createReflectionProbes({}, {})).toBeNull();
    expect(createReflectionProbes(null, null)).toBeNull();
  });

  it('is skipped at low quality even when a renderer exists', () => {
    const game = {
      THREE: { CubeCamera: class {}, PMREMGenerator: class {} },
      renderer: {},
      scene: {},
      quality: { name: 'low' },
    };
    expect(createReflectionProbes(game, {})).toBeNull();
  });

  it('returns null when the GPU capture throws', () => {
    const game = {
      THREE: {
        CubeCamera: class {},
        PMREMGenerator: class {},
        WebGLCubeRenderTarget: class {
          constructor() {
            throw new Error('no half float cube targets');
          }
        },
      },
      renderer: {},
      scene: { fog: null },
      quality: { name: 'high' },
    };
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(createReflectionProbes(game, {})).toBeNull();
    } finally {
      console.warn = warn;
    }
  });
});

describe('reflection probe placement', () => {
  it('samples the route at platform height, deterministically', () => {
    const level = {
      platforms: [
        { pos: [0, -0.25, 9], size: [10, 0.5, 6] },
        { pos: [2, 1.35, -21], size: [8, 0.5, 7] },
        { pos: [2, 3.25, -45], size: [6, 0.5, 4] },
        { pos: [2, 1.45, -68], size: [8, 0.5, 8] },
        { pos: [2, 3.25, -113], size: [6, 0.5, 6] },
      ],
    };
    const first = probePositions(level, 2);
    expect(first).toHaveLength(2);
    expect(probePositions(level, 2)).toEqual(first);
    // The probes sit at eye height above a route platform, not on it.
    // With 5 platforms and 2 probes the sampled indices are 1 and 3.
    expect(first[0].y).toBeCloseTo(1.35 + 0.25 + 1.7, 5);
    expect(first[1].y).toBeCloseTo(1.45 + 0.25 + 1.7, 5);
    expect(first[1].x).toBe(2);
    expect(first[0].z).toBeGreaterThan(first[1].z);
    // x/z keep the authored route line so the glass reflects the canyon.
    expect(first[0].x).toBe(2);
  });

  it('falls back to canyon-height probes for a level without platforms', () => {
    const positions = probePositions({}, 3);
    expect(positions).toHaveLength(3);
    for (const position of positions) expect(position.y).toBe(8);
    expect(probePositions(null, 1)[0].z).toBe(-30);
  });

  it('clamps the probe count to 1-3', () => {
    const level = { platforms: [{ pos: [0, 0, 0], size: [1, 1, 1] }] };
    expect(probePositions(level, 0)).toHaveLength(1);
    expect(probePositions(level, 99)).toHaveLength(3);
  });
});

describe('reflection probe assignment', () => {
  const makeProbes = () => ({
    textures: [{ name: 'near-canyon' }, { name: 'mid-route' }],
    categories: { glass: { name: 'near-canyon' }, metal: { name: 'mid-route' } },
  });
  const material = (category, extra = {}) => ({
    envMap: null,
    envMapIntensity: 1,
    needsUpdate: false,
    userData: category ? { reflections: category } : {},
    ...extra,
  });

  it('points tagged materials at the matching probe and raises env intensity', () => {
    const glass = material('glass');
    const metal = material('metal');
    const concrete = material(null);
    const root = {
      traverse(visit) {
        [glass, metal, concrete].forEach((m, index) =>
          visit({ name: `mesh-${index}`, material: index === 2 ? [m] : m }),
        );
      },
    };
    const assigned = assignReflectionProbes(root, makeProbes());
    expect(assigned).toBe(2);
    expect(glass.envMap).toEqual({ name: 'near-canyon' });
    expect(glass.envMapIntensity).toBeGreaterThan(1.8);
    expect(glass.needsUpdate).toBe(true);
    expect(metal.envMap).toEqual({ name: 'mid-route' });
    expect(metal.envMapIntensity).toBeLessThan(glass.envMapIntensity);
    expect(metal.envMapIntensity).toBeGreaterThan(1);
    expect(concrete.envMap).toBeNull();
    expect(concrete.envMapIntensity).toBe(1);
  });

  it('only touches a shared material once', () => {
    const glass = material('glass');
    const root = {
      traverse(visit) {
        visit({ material: glass });
        visit({ material: glass });
        visit({ material: [glass] });
      },
    };
    expect(assignReflectionProbes(root, makeProbes())).toBe(1);
  });

  it('accepts explicit intensities and tolerates a missing probe set', () => {
    const glass = material('glass');
    const root = { traverse: (visit) => visit({ material: glass }) };
    expect(assignReflectionProbes(root, makeProbes(), { glassIntensity: 2.5 })).toBe(1);
    expect(glass.envMapIntensity).toBe(2.5);
    expect(assignReflectionProbes(root, null)).toBe(0);
    expect(assignReflectionProbes(null, makeProbes())).toBe(0);
  });
});
