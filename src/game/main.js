// GLASSLINE-only browser entry. The original Saltline single-file game remains
// at /index.html; this entry boots only the shared engine and GLASSLINE modes.
import * as THREE from 'three';
import { installRender } from '../engine/render/index.js';
import { createPhysics } from '../engine/physics/index.js';
import { createEvents } from '../engine/core/events.js';
import { createRng } from '../engine/core/rng.js';
import { createTime, advanceTime } from '../engine/core/time.js';
import { glasslineMode } from './glassline/index.js';
import { glasslineTutorialMode } from './glassline/tutorial.js';
import { glasslineEditorMode } from './glassline/editor.js';

const SHOWCASES = {
  glassline: glasslineMode,
  'glassline-tutorial': glasslineTutorialMode,
  'glassline-editor': glasslineEditorMode,
};

const QUALITY = {
  low: {
    name: 'low', scale: 0.78, shadow: 1024, msaa: 0, volSteps: 6,
    ao: false, bloom: false, motionBlur: false, planar: 0, rain: 0,
  },
  medium: {
    name: 'medium', scale: 1, shadow: 1536, msaa: 2, volSteps: 10,
    ao: true, bloom: true, motionBlur: false, planar: 0, rain: 0.25,
  },
  high: {
    name: 'high', scale: 1, shadow: 2048, msaa: 4, volSteps: 16,
    ao: true, bloom: true, motionBlur: true, planar: 0, rain: 0.5,
  },
  ultra: {
    name: 'ultra', scale: 1, shadow: 2048, msaa: 4, volSteps: 20,
    ao: true, bloom: true, motionBlur: true, planar: 0, rain: 0.7,
  },
};

const params = Object.fromEntries(new URLSearchParams(location.search));
const quality = QUALITY[params.q] || QUALITY.high;
const selected = Object.hasOwn(SHOWCASES, params.show)
  ? params.show
  : 'glassline-tutorial';
const boot = document.getElementById('boot');
const bootMsg = document.getElementById('boot-msg');
const bootFill = document.getElementById('boot-fill');

function fatal(error) {
  window.__fatal = String(error);
  console.error('[glassline boot]', error);
  if (bootMsg) bootMsg.textContent = `FAILED TO START · ${error}`;
  const box = document.getElementById('fatal');
  if (box) box.textContent = String(error);
}
function step(message, progress) {
  if (bootMsg) bootMsg.textContent = message;
  if (bootFill) bootFill.style.width = `${Math.round(progress * 100)}%`;
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function bootGlassline() {
  window.__frames = 0;
  window.__ready = false;
  window.__fatal = null;
  window.__errors = [];
  window.addEventListener('error', (event) => {
    window.__errors.push(String(event.message));
  });
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    try {
      window.__errors.push(
        args.map((arg) => (arg && arg.stack) || String(arg)).join(' ').slice(0, 400),
      );
    } catch {
      /* ignore */
    }
    originalError(...args);
  };

  const game = {
    THREE,
    params,
    events: createEvents(),
    rng: createRng(Number(params.seed) || 4207),
    time: createTime(),
    quality,
    level: {
      stub: true,
      playerStart: { pos: new THREE.Vector3(0, 0, 4), yaw: 0 },
      objectives: [],
      enemySpawns: [],
      zones: [],
      interiorBoxes: [],
      cinematicPath: [],
      extraction: { pos: new THREE.Vector3(), radius: 2 },
      groundSurfaceAt: () => 'concrete',
      update() {},
    },
  };
  window.__G = game;

  await step('INITIALIZING CITY LIGHT', 0.08);
  const renderModule = installRender(game, {
    sky: {
      dir: new THREE.Vector3(-0.35, 0.55, -0.75).normalize(),
      color: new THREE.Color(0xffe2b8),
      intensity: 3.4,
    },
    skyColors: {
      zenith: new THREE.Color(0x2b608c),
      horizon: new THREE.Color(0xf5dfc4),
      horizonAway: new THREE.Color(0x9bb9c7),
      fog: new THREE.Color(0xcfe0e7),
    },
    player: { fov: 74, viewFov: 60 },
    quality,
  });
  game.render = await renderModule.create(game);
  game.renderer = game.render.renderer;
  game.scene = game.render.scene;
  game.camera = game.render.camera;
  game.viewCamera = game.render.viewCamera;

  await step('POLISHING GLASS AND CONCRETE', 0.3);
  game.physics = createPhysics(game, {
    min: new THREE.Vector3(-80, -10, -240),
    max: new THREE.Vector3(80, 80, 40),
    groundY: -30,
    seaY: -30,
    quayX: 200,
  });
  game.showcase = selected;
  game.game = { state: 'showcase', update: () => false, start() {} };

  await step('ASSEMBLING ROOFTOPS', 0.55);
  let showcaseInfo = null;
  try {
    showcaseInfo = await SHOWCASES[selected].showcase(game);
  } catch (error) {
    fatal(`showcase "${selected}" threw: ${error && error.stack ? error.stack : error}`);
    throw error;
  }
  game.showcaseInfo = showcaseInfo || {};

  await step('WAITING FOR THE SUN', 0.82);
  try {
    await game.render.onLevelReady();
  } catch (error) {
    console.error('[glassline] onLevelReady failed', error);
  }

  let last = performance.now();
  let fps = 0;
  window.__stats = () => ({
    ...(game.render.stats ? game.render.stats() : {}),
    fps: fps ? +(1 / fps).toFixed(1) : 0,
    state: 'showcase',
  });

  await step('READY TO RUN', 1);
  if (boot) {
    boot.classList.add('done');
    setTimeout(() => {
      boot.hidden = true;
    }, 700);
  }

  game.renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    fps = fps ? fps * 0.95 + dt * 0.05 : dt;
    const stepTime = advanceTime(game.time, dt, now, params.dt);
    if (game.showcaseInfo && game.showcaseInfo.update) {
      game.showcaseInfo.update(stepTime);
    }
    try {
      game.render.frame(stepTime);
    } catch (error) {
      if (!window.__errors.includes(String(error && error.stack ? error.stack : error))) {
        console.error(error);
      }
    }
    window.__frames += 1;
    if (window.__frames === 2) window.__ready = true;
  });
}

bootGlassline().catch((error) => fatal(error));
