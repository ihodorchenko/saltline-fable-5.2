// @ts-check
// High-key procedural sky + PMREM environment for reflective city materials.
// No external HDRIs or sky textures.

/**
 * @param {any} game
 * @param {any} [sunDirection]
 */
export function createHighKeySky(game, sunDirection = null) {
  const { THREE, scene, renderer } = game;
  const sun = (sunDirection || new THREE.Vector3(0.3, 0.45, -0.85)).clone().normalize();

  const geometry = new THREE.SphereGeometry(620, 32, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x1454a6) },
      uHorizon: { value: new THREE.Color(0xe9f5fb) },
      uBottom: { value: new THREE.Color(0xddecf8) },
      uSunDir: { value: sun.clone() },
      uSunColor: { value: new THREE.Color(0xfffdf4) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = h >= 0.0
          ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(uHorizon, uBottom, min(1.0, -h * 4.0));

        // Wide morning haze plus a hard sun disc / glare in the same direction
        // as the scene's directional light.
        float sunAmount = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunAmount, 12.0) * 0.24;
        col += uSunColor * pow(sunAmount, 360.0) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'glassline-high-key-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  let environment = null;
  if (renderer) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const envSky = new THREE.Mesh(geometry, material);
      envScene.add(envSky);
      environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
      scene.environment = environment;
      scene.environmentIntensity = 0.34;
      pmrem.dispose();
    } catch (error) {
      console.warn('[sky] PMREM environment unavailable', error);
    }
  }

  return { mesh, material, environment, sun };
}
