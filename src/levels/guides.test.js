import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GUIDE, createBeacon, createFinishGeometry, createRingGeometry } from './guides.js';

describe('route guides', () => {
  it('keeps rings fine and smooth', () => {
    for (const ring of [GUIDE.ring, GUIDE.finish]) {
      expect(ring.tube / ring.radius).toBeLessThan(0.07);
      expect(ring.radial).toBeGreaterThanOrEqual(12);
      expect(ring.segments).toBeGreaterThanOrEqual(64);
    }
  });

  it('builds ring geometry from the shared constants', () => {
    expect(createRingGeometry(THREE).parameters.tube).toBe(GUIDE.ring.tube);
    expect(createFinishGeometry(THREE).parameters.radius).toBe(GUIDE.finish.radius);
  });

  it('drops tessellation at low quality', () => {
    const ring = createRingGeometry(THREE, true).parameters;
    expect(ring.radialSegments).toBe(GUIDE.ring.lowRadial);
    expect(ring.tubularSegments).toBe(GUIDE.ring.lowSegments);
    const finish = createFinishGeometry(THREE, true).parameters;
    expect(finish.radialSegments).toBe(GUIDE.finish.lowRadial);
    expect(finish.tubularSegments).toBe(GUIDE.finish.lowSegments);
  });

  it('makes an opaque, fog-free, outlined beacon', () => {
    const beacon = createBeacon(THREE);
    expect(beacon.name).toBe('glassline-next-checkpoint');
    const gem = beacon.getObjectByName('beacon-gem');
    expect(gem.material.transparent).toBe(false);
    expect(gem.material.opacity).toBe(1);
    expect(gem.material.fog).toBe(false);
    expect(gem.material.flatShading).toBe(true);
    expect(gem.material.emissiveIntensity).toBe(GUIDE.beacon.intensity);
    const outline = beacon.getObjectByName('beacon-outline');
    expect(outline.material.fog).toBe(false);
  });
});
