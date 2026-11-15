// @ts-check
// Procedural day sky + PMREM environment for reflective city materials.
// No external HDRIs or sky textures.
//
// The sky is the single largest colour surface in a first-person frame (20-40 %),
// so it is built rather than tinted: a saturated blue gradient, a cumulus deck
// with sunlit tops and blue-grey bases, a silver lining toward the sun, and a real
// sun disc in the direction of the engine's directional light. The reference frame
// sheet in docs/visual-gap/shots/reference-vocabulary.png is the target: vivid
// blue behind scattered white cloud, never a cream/white wash.
//
// Everything is deterministic and generated here, so the sky and the PMREM
// environment baked from it stay consistent (glass reflections pick up the clouds).

const noiseCache = new WeakMap();

/**
 * Deterministic 256x256 value-noise texture for the cloud fbm. White noise is
 * fine: the shader smooth-interpolates it, which is cheaper than building a
 * prefiltered pyramid.
 * @param {any} THREE
 */
function createNoiseTexture(THREE) {
  const cached = noiseCache.get(THREE);
  if (cached) return cached;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 0x9e3779b9;
  for (let i = 0; i < size * size; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i * 4] = seed >>> 24;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i * 4 + 1] = seed >>> 24;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i * 4 + 2] = seed >>> 24;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  noiseCache.set(THREE, texture);
  return texture;
}

const VERTEX_SHADER = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uCloudCover;
  uniform float uCloudScale;
  varying vec3 vDir;

  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return texture2D(uNoise, (i + f + 0.5) / 256.0).r;
  }
  float fbm3(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 3; k++) { s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; }
    return s / 0.875;
  }
  float fbm6(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 6; k++) { s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; }
    return s / 0.984375;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = max(dir.y, 0.0);
    float mu = dot(dir, normalize(uSunDir));
    float s = max(mu, 0.0);
    vec2 sunXZ = normalize(uSunDir.xz + vec2(1e-5));
    vec2 dirXZ = normalize(dir.xz + vec2(1e-5));
    float ts = clamp(dot(dirXZ, sunXZ) * 0.5 + 0.5, 0.0, 1.0);

    // ---- clear sky: saturated blue overhead, pale blue at the horizon ----
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.32));
    // warm haze band toward the sun, hugging the horizon
    col += uSunColor * pow(ts, 8.0) * (0.05 + 0.16 * exp(-h * 9.0));
    // aureole and sun disc (the flare pass owns the screen-space glare)
    col += uSunColor * pow(s, 6.0) * 0.11;
    col += uSunColor * pow(s, 300.0) * 0.45;
    col += uSunColor * smoothstep(0.99985, 0.99999, mu) * 5.0;

    // ---- cumulus deck ----
    // A plane projected on the dome: small near the zenith, compressed toward the
    // horizon. Drift is slow; the deck never scrolls fast enough to distract.
    vec2 cuv = dirXZ / (h + 0.14) * uCloudScale + vec2(0.005, 0.0025) * uTime;
    float warp = fbm3(cuv * 0.45 + 4.9);
    vec2 q = cuv + (warp - 0.5) * 0.55;
    float dens = fbm6(q);
    // small-scale texture on the puffs so the silhouettes are not blobby
    float ridged = 1.0 - abs(2.0 * fbm3(q * 3.4 + 11.0) - 1.0);
    dens = dens * 0.88 + (ridged - 0.5) * 0.12;

    float edge = mix(0.53, 0.41, uCloudCover);
    float cover = smoothstep(edge, edge + 0.10, dens);
    // Clouds live in the 7-65 deg band: below that the projection compresses and
    // above it the planar projection collapses into a singularity at the zenith.
    cover *= smoothstep(0.012, 0.10, h);
    cover *= 1.0 - smoothstep(0.70, 0.93, h);
    cover *= 1.0 - smoothstep(3.6, 6.2, length(cuv));
    // keep a ragged clear gap around the sun so the disc can burn through
    cover *= 1.0 - 0.55 * smoothstep(0.90, 0.995, mu);

    // ---- cloud shading: density gradient toward the sun = relief ----
    float densSun = fbm6(q + sunXZ * 0.24);
    float relief = clamp((dens - densSun) * 4.0 + 0.5, 0.0, 1.0);
    float thick = smoothstep(0.50, 0.78, dens);
    // blue-grey shadowed base, warm white sunlit top
    vec3 base = mix(vec3(0.36, 0.42, 0.54), vec3(0.62, 0.67, 0.77), 1.0 - thick);
    // Sunlit tops sit well above 1.0 in HDR so they roll off to white after the
    // tonemap and bloom, like the reference's clipped cumulus.
    vec3 top = mix(vec3(3.1, 2.95, 2.7), vec3(1.55, 1.55, 1.62), thick);
    vec3 cloud = mix(base, top, relief * relief * 0.82 + 0.18);
    // silver lining where the cloud is thin and close to the sun
    cloud += uSunColor * pow(s, 10.0) * 0.34 * (1.0 - thick);
    // aerial perspective: low clouds melt into the horizon haze
    cloud = mix(cloud, uHorizon * 1.06 + 0.05, smoothstep(0.34, 0.04, h));
    col = mix(col, cloud, cover);

    // below the horizon: haze, mostly hidden by geometry but visible off a ledge
    if (dir.y < 0.0) {
      col = mix(uHorizon * 0.92, uBottom * 0.62, min(1.0, -dir.y * 3.0));
      col += uSunColor * pow(s, 8.0) * 0.05;
    }
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }
`;

/**
 * @param {any} game
 * @param {any} [sunDirection]
 */
export function createHighKeySky(game, sunDirection = null) {
  const { THREE, scene, renderer } = game;
  const sun = (sunDirection || new THREE.Vector3(0.3, 0.45, -0.85)).clone().normalize();
  const noise = createNoiseTexture(THREE);

  const geometry = new THREE.SphereGeometry(620, 48, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x0a3d8f) },
      uHorizon: { value: new THREE.Color(0xa8c9e2) },
      uBottom: { value: new THREE.Color(0xc2d6e6) },
      uSunDir: { value: sun.clone() },
      uSunColor: { value: new THREE.Color(0xfffdf4) },
      uNoise: { value: noise },
      uTime: { value: 0 },
      // 0.5 = the shipped day look; the level data may override per scene.
      uCloudCover: { value: 0.56 },
      uCloudScale: { value: 1.25 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'glassline-high-key-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  /** @param {number} time seconds; drives the slow cloud drift */
  function update(time) {
    material.uniforms.uTime.value = Number.isFinite(time) ? time : 0;
  }
  mesh.userData.update = update;

  let environment = null;
  if (renderer) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      // Capture the same day sky (clouds included) so glass reflects the weather.
      const envMaterial = material.clone();
      envMaterial.uniforms.uNoise.value = noise;
      const envSky = new THREE.Mesh(geometry, envMaterial);
      envScene.add(envSky);
      environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
      scene.environment = environment;
      scene.environmentIntensity = 0.14;
      envMaterial.dispose();
      pmrem.dispose();
    } catch (error) {
      console.warn('[sky] PMREM environment unavailable', error);
    }
  }

  return { mesh, material, environment, sun, update };
}
