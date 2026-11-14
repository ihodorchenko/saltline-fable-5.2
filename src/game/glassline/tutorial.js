// @ts-check
// GLASSLINE tutorial mode: data-driven route, checkpoint/respawn/finish flow,
// saved progress, route readability and a minimal stage HUD.

import { tutorialLevel } from '../../levels/tutorial.js';
import { buildLevel } from '../../levels/build.js';
import { createPlayerController } from './player.js';
import { createTutorialMenu } from './menu.js';
import { createGlasslineAudio } from './audio.js';
import { loadBindings } from './bindings.js';
import { createPerfHud } from './perf.js';
import {
  checkpointSplit,
  formatTime,
  shouldAutoRespawn,
  shouldPromptStuck,
} from './progress.js';

export const TUTORIAL_STORAGE_KEY = 'glassline.tutorial.progress.v1';
export const TUTORIAL_BEST_KEY = 'glassline.tutorial.best.v1';

/**
 * @param {import('../../../types/engine').GameContext} game
 */
function createHud() {
  const hud = document.createElement('div');
  hud.id = 'glassline-tutorial';
  hud.style.cssText =
    'position:fixed;left:22px;top:22px;z-index:40;width:330px;padding:14px 16px;' +
    'background:rgba(8,12,16,.8);border:1px solid rgba(255,255,255,.36);color:#eef1ef;' +
    'font:12px/1.5 "IBM Plex Mono",monospace;letter-spacing:.05em;';
  hud.innerHTML =
    '<div id="gl-stage" style="color:#d23a39;font-weight:700;letter-spacing:.12em"></div>' +
    '<div id="gl-prompt" style="margin-top:6px;min-height:36px"></div>' +
    '<div id="gl-progress" style="height:3px;margin-top:10px;background:#30383c">' +
    '<div id="gl-progress-fill" style="height:100%;width:0;background:#d23a39"></div></div>' +
    '<div id="gl-count" style="margin-top:9px;color:#9aa4a8"></div>' +
    '<div id="gl-time" style="margin-top:2px;color:#9aa4a8"></div>' +
    '<div id="gl-split" style="margin-top:2px;color:#707b80"></div>' +
    '<div id="gl-best" style="margin-top:2px;color:#9aa4a8"></div>' +
    '<div id="gl-help" style="margin-top:4px;color:#707b80">R retry · Backspace restart</div>';
  document.body.appendChild(hud);
  return hud;
}

/**
 * @param {any} level
 * @returns {{checkpoint: number, respawns: number, finished: boolean}}
 */
function loadSavedProgress(level) {
  const empty = {
    checkpoint: 0,
    respawns: 0,
    finished: false,
    started: false,
  };
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const checkpoint = Number.isInteger(data.checkpoint)
      ? Math.max(0, Math.min(data.checkpoint, level.checkpoints.length - 1))
      : 0;
    return {
      checkpoint,
      respawns: Number.isInteger(data.respawns) ? Math.max(0, data.respawns) : 0,
      finished: data.finished === true,
      started:
        data.started === true || checkpoint > 0 || Number(data.respawns) > 0,
    };
  } catch {
    return empty;
  }
}

/**
 * @param {{checkpoint: number, respawns: number, finished: boolean}} progress
 */
function saveProgress(progress) {
  try {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        checkpoint: progress.checkpoint,
        respawns: progress.respawns,
        finished: progress.finished,
        started: progress.started === true,
      }),
    );
  } catch {
    /* storage is optional */
  }
}

function loadBest() {
  try {
    const value = Number(localStorage.getItem(TUTORIAL_BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveBest(seconds) {
  try {
    localStorage.setItem(TUTORIAL_BEST_KEY, String(seconds));
  } catch {
    /* storage is optional */
  }
}

/**
 * @param {import('../../../types/engine').GameContext} game
 */
export async function showcaseTutorial(game) {
  const level = tutorialLevel;
  const built = buildLevel(game, level);
  // The showcase bootstrap adds a flat 80×80 ground plane. The tutorial has its
  // own platforms, so hide that plane to avoid coplanar z-fighting and let the
  // gaps read as real falls.
  for (const child of game.scene.children) {
    if (
      child.isMesh &&
      child.geometry &&
      child.geometry.type === 'PlaneGeometry' &&
      child.geometry.parameters &&
      child.geometry.parameters.width === 80 &&
      child.geometry.parameters.height === 80
    ) {
      child.visible = false;
    }
  }
  const bindings = loadBindings();
  const controller = createPlayerController(game, { bindings });
  controller.setEnabled(false);
  const perf = createPerfHud(game);
  const hud = createHud();
  const stageEl = hud.querySelector('#gl-stage');
  const promptEl = hud.querySelector('#gl-prompt');
  const countEl = hud.querySelector('#gl-count');
  const timeEl = hud.querySelector('#gl-time');
  const splitEl = hud.querySelector('#gl-split');
  const bestEl = hud.querySelector('#gl-best');
  const fillEl = hud.querySelector('#gl-progress-fill');
  const helpEl = hud.querySelector('#gl-help');
  if (helpEl) {
    helpEl.textContent = `${bindings.label('retry')} retry · ${bindings.label('restart')} restart`;
  }
  let elapsed = 0;
  let timeAccumulator = 0;
  let paused = true;
  let started = false;
  let menu = null;
  let lastCheckpointAt = 0;
  let best = loadBest();
  let idleTime = 0;
  let stuckPrompted = false;
  let lastPosition = null;
  let autoRespawns = 0;

  const saved = loadSavedProgress(level);
  const progress = {
    checkpoint: saved.checkpoint,
    respawns: saved.respawns,
    finished: saved.finished,
    started: saved.started,
    message: saved.checkpoint > 0 ? 'Resumed from checkpoint.' : '',
    splits: [],
    best,
    autoRespawns: 0,
  };

  const beaconGeometry = new game.THREE.OctahedronGeometry(0.28);
  const beaconMaterial = new game.THREE.MeshBasicMaterial({
    color: 0xd23a39,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new game.THREE.Mesh(beaconGeometry, beaconMaterial);
  beacon.name = 'glassline-next-checkpoint';
  built.root.add(beacon);

  function updateRings() {
    built.checkpointMeshes.forEach((mesh, index) => {
      const color = progress.finished
        ? 0x5f7f6d
        : index < progress.checkpoint
          ? 0x5f7f6d
          : index === progress.checkpoint
            ? 0xd23a39
            : 0x5a6266;
      mesh.material.color.setHex(color);
    });
    if (progress.finished || progress.checkpoint >= level.checkpoints.length - 1) {
      beacon.visible = false;
      return;
    }
    const next = level.checkpoints[progress.checkpoint + 1];
    beacon.visible = true;
    beacon.position.set(next.pos[0], next.pos[1] + 2.3, next.pos[2]);
    beacon.rotation.y += 0.015;
  }

  function setHud() {
    const checkpoint = level.checkpoints[progress.checkpoint];
    if (stageEl) {
      stageEl.textContent = progress.finished
        ? 'COURSE COMPLETE'
        : `${String(progress.checkpoint + 1).padStart(2, '0')} · ${checkpoint.stage}`;
    }
    if (promptEl) {
      promptEl.textContent = progress.finished
        ? 'Rooftop induction complete. Backspace restarts.'
        : progress.message || checkpoint.prompt;
    }
    if (countEl) {
      countEl.textContent =
        `${progress.checkpoint}/${level.checkpoints.length - 1} CHECKPOINTS · ` +
        `${progress.respawns} RESPAWNS`;
    }
    if (timeEl) {
      timeEl.textContent =
        progress.finished && elapsed <= 0
          ? 'TIME --:--'
          : `TIME ${formatTime(elapsed)}`;
    }
    if (splitEl) {
      const last = progress.splits[progress.splits.length - 1];
      splitEl.textContent = last
        ? `SPLIT ${formatTime(last.split)} · TOTAL ${formatTime(last.total)}`
        : 'SPLIT --:--';
    }
    if (bestEl) {
      bestEl.textContent = best ? `BEST ${formatTime(best)}` : 'BEST --:--';
    }
    if (fillEl) {
      fillEl.style.width = `${
        progress.finished
          ? 100
          : Math.round(
              (progress.checkpoint / (level.checkpoints.length - 1)) * 100,
            )
      }%`;
    }
    updateRings();
  }

  function respawn(auto = false) {
    if (progress.finished) return;
    const checkpoint = level.checkpoints[progress.checkpoint];
    controller.teleport(
      checkpoint.pos[0],
      checkpoint.pos[2],
      checkpoint.yaw,
      0,
      false,
      checkpoint.pos[1] + 0.05,
    );
    progress.respawns += 1;
    if (auto) {
      autoRespawns += 1;
      progress.autoRespawns = autoRespawns;
      progress.message = 'Auto-respawn: no movement detected.';
    } else {
      progress.message = 'Respawned at last checkpoint.';
    }
    idleTime = 0;
    stuckPrompted = false;
    lastPosition = null;
    try {
      game.events?.emit('glassline:respawn', { auto });
    } catch {
      /* events are optional */
    }
    saveProgress(progress);
    setHud();
  }

  function restart() {
    progress.checkpoint = 0;
    progress.respawns = 0;
    progress.finished = false;
    progress.message = '';
    elapsed = 0;
    timeAccumulator = 0;
    lastCheckpointAt = 0;
    progress.splits = [];
    idleTime = 0;
    stuckPrompted = false;
    lastPosition = null;
    autoRespawns = 0;
    progress.autoRespawns = 0;
    try {
      localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    } catch {
      /* storage is optional */
    }
    controller.teleport(
      level.spawn.x,
      level.spawn.z,
      level.spawn.yaw,
      0,
      false,
      level.spawn.y,
    );
    progress.started = true;
    saveProgress(progress);
    paused = false;
    started = true;
    setHud();
  }

  function startOver() {
    restart();
    started = true;
    paused = false;
    controller.setEnabled(true);
    audio.start();
    audio.play('ui');
  }

  const autostart =
    game.params?.autostart === '1' || game.params?.shot === '1';
  const audio = createGlasslineAudio();
  audio.bind(game.events);
  const hasRunProgress = progress.started === true;
  const resumeLabel =
    progress.checkpoint > 0
      ? `CONTINUE · CHECKPOINT ${progress.checkpoint}/${level.checkpoints.length - 1}`
      : 'CONTINUE · SAVED RUN';
  menu = createTutorialMenu({
    level,
    canvas: game.renderer?.domElement || null,
    runStarted: hasRunProgress,
    resumeLabel,
    audio,
    bindings,
    onStart: () => {
      started = true;
      paused = false;
      progress.started = true;
      saveProgress(progress);
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
    },
    onResume: () => {
      paused = false;
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
    },
    onRestart: () => {
      restart();
      started = true;
      paused = false;
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
    },
    onStartOver: () => {
      startOver();
    },
    onSensitivity: (value) => {
      controller.setSensitivity(0.0022 * value);
    },
  });
  if (autostart) {
    menu.hide();
    started = true;
    paused = false;
    progress.started = true;
    saveProgress(progress);
    controller.setEnabled(true);
  }

  const benchMode = game.params?.peak === '1';
  let bench = null;
  if (benchMode) {
    menu.hide();
    hud.style.display = 'none';
    const hint = document.querySelector('#glassline-hint');
    if (hint) hint.style.display = 'none';
    controller.setEnabled(false);
    started = true;
    paused = false;
    built.root.traverse((object) => {
      if (object.isMesh || object.isSprite || object.isLine) {
        object.frustumCulled = false;
      }
    });
    game.camera.position.set(22, 18, 6);
    game.camera.lookAt(2, 1, -95);
    game.camera.updateProjectionMatrix();
    bench = {
      done: false,
      duration: Math.max(1, Number(game.params?.duration) || 8),
      warmup: 1.0,
      elapsed: 0,
      measureElapsed: 0,
      samples: [],
      lastTime: 0,
      result: null,
    };
    window.__glasslineBench = bench;
  }

  function finishBench() {
    if (!bench || bench.done) return;
    const sorted = [...bench.samples].sort((a, b) => a - b);
    const average = (list) =>
      list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
    const percentile = (p) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
    const stats = game.render?.stats?.() || {};
    const gl = game.renderer?.getContext?.();
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const gpu = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl?.getParameter?.(gl.RENDERER) || 'unknown';
    const avgMs = average(sorted);
    const p95 = percentile(0.95);
    const result = {
      done: true,
      quality: game.quality?.name || 'unknown',
      viewport: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio,
      buffer: stats.res || [],
      calls: stats.calls,
      tris: stats.tris,
      geos: stats.geos,
      textures: stats.tex,
      frames: sorted.length,
      avgMs: +avgMs.toFixed(2),
      p50Ms: +percentile(0.5).toFixed(2),
      p95Ms: +p95.toFixed(2),
      p99Ms: +percentile(0.99).toFixed(2),
      fps: +(1000 / Math.max(avgMs, 0.001)).toFixed(1),
      pass60: p95 <= 1000 / 60,
      gpu,
    };
    bench.done = true;
    bench.result = result;
    window.__glasslineBench = result;
    const panel = document.createElement('div');
    panel.id = 'glassline-bench-result';
    panel.style.cssText =
      'position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:80;' +
      'padding:12px 16px;background:rgba(8,12,16,.9);border:1px solid ' +
      (result.pass60 ? '#8fbf9f' : '#d23a39') +
      ';color:#eef1ef;font:12px/1.5 "IBM Plex Mono",monospace;white-space:pre;';
    panel.textContent = [
      'GLASSLINE PEAK LOAD',
      `${result.pass60 ? 'PASS' : 'FAIL'} 60 FPS`,
      `avg ${result.avgMs} ms · p95 ${result.p95Ms} ms · p99 ${result.p99Ms} ms`,
      `${result.calls} calls · ${result.tris} tris · ${result.buffer.join('x')}`,
      result.gpu,
    ].join('\n');
    document.body.appendChild(panel);
    console.log('GLASSLINE_BENCH', JSON.stringify(result));
  }

  function updateBench(now) {
    if (!bench || bench.done) return;
    if (!bench.lastTime) {
      bench.lastTime = now;
      return;
    }
    const frameMs = now - bench.lastTime;
    bench.lastTime = now;
    if (bench.elapsed < bench.warmup * 1000) {
      bench.elapsed += frameMs;
      return;
    }
    bench.measureElapsed += frameMs;
    bench.samples.push(frameMs);
    if (
      bench.samples.length >= 5 &&
      bench.measureElapsed >= bench.duration * 1000
    ) {
      finishBench();
    }
  }

  const startCheckpoint =
    progress.checkpoint > 0
      ? level.checkpoints[progress.checkpoint]
      : null;
  if (startCheckpoint) {
    controller.teleport(
      startCheckpoint.pos[0],
      startCheckpoint.pos[2],
      startCheckpoint.yaw,
      0,
      false,
      startCheckpoint.pos[1] + 0.05,
    );
  } else {
    controller.teleport(
      level.spawn.x,
      level.spawn.z,
      level.spawn.yaw,
      0,
      false,
      level.spawn.y,
    );
  }
  setHud();
  saveProgress(progress);

  if (progress.finished && !benchMode) {
    paused = true;
    started = false;
    controller.setEnabled(false);
    menu?.showComplete({
      time: '--:--',
      best: best ? formatTime(best) : '--:--',
      respawns: progress.respawns,
    });
  }

  function onKeyDown(event) {
    if (bindings.matches(event.code, 'restart') && !event.repeat) {
      event.preventDefault();
      menu?.hide();
      restart();
      started = true;
      paused = false;
      controller.setEnabled(true);
      return;
    }
    if (paused) return;
    if (bindings.matches(event.code, 'retry') && !event.repeat) {
      event.preventDefault();
      respawn();
    }
  }
  const canvas = game.renderer?.domElement || null;
  function onPointerLockChange() {
    if (!started || progress.finished || paused) return;
    if (document.pointerLockElement !== canvas) {
      paused = true;
      controller.setEnabled(false);
      menu?.showPause();
    }
  }
  document.addEventListener('pointerlockchange', onPointerLockChange);
  addEventListener('keydown', onKeyDown);

  game.glassline = {
    controller,
    root: built.root,
    tutorial: progress,
    level,
    storageKey: TUTORIAL_STORAGE_KEY,
    menu,
    audio,
    bindings,
    perf,
    bench,
  };

  return {
    update(dt) {
      if (benchMode) {
        updateBench(performance.now());
        return;
      }
      perf.update(dt);
      if (beacon.visible) beacon.rotation.y += dt * 1.2;
      if (paused) return;
      if (progress.finished) return;
      elapsed += dt;
      timeAccumulator += dt;
      if (timeAccumulator >= 0.2) {
        timeAccumulator = 0;
        if (timeEl) timeEl.textContent = `TIME ${formatTime(elapsed)}`;
      }
      // Check before physics too: a teleport/debug drop below the roof may be
      // resolved upward by the capsule mover before the post-step check.
      if (controller.getState().pos.y < level.fallY) {
        respawn();
        return;
      }
      controller.update(dt);
      const state = controller.getState();

      if (state.pos.y < level.fallY) {
        respawn();
        return;
      }

      if (lastPosition) {
        const moved =
          Math.hypot(
            state.pos.x - lastPosition.x,
            state.pos.z - lastPosition.z,
          ) > 0.15 || Math.abs(state.pos.y - lastPosition.y) > 0.25;
        if (moved) {
          idleTime = 0;
          if (stuckPrompted) {
            stuckPrompted = false;
            progress.message = '';
            setHud();
          }
        } else {
          idleTime += dt;
        }
      }
      lastPosition = {
        x: state.pos.x,
        y: state.pos.y,
        z: state.pos.z,
      };
      if (!stuckPrompted && shouldPromptStuck(idleTime)) {
        stuckPrompted = true;
        progress.message = 'Stuck? Press R to retry from the checkpoint.';
        setHud();
      }
      if (shouldAutoRespawn(idleTime)) {
        respawn(true);
        return;
      }

      for (let i = level.checkpoints.length - 1; i > progress.checkpoint; i--) {
        const checkpoint = level.checkpoints[i];
        const dx = state.pos.x - checkpoint.pos[0];
        const dz = state.pos.z - checkpoint.pos[2];
        if (Math.hypot(dx, dz) <= checkpoint.radius) {
          const previous = progress.checkpoint;
          progress.checkpoint = i;
          const split = checkpointSplit(lastCheckpointAt, elapsed);
          lastCheckpointAt = elapsed;
          progress.splits.push({
            from: previous,
            to: i,
            split,
            total: elapsed,
          });
          try {
            game.events?.emit('glassline:checkpoint', {
              index: i,
              split,
              total: elapsed,
            });
          } catch {
            /* events are optional */
          }
          progress.message = '';
          saveProgress(progress);
          setHud();
          break;
        }
      }

      const finish = level.finish;
      if (
        Math.hypot(state.pos.x - finish.pos[0], state.pos.z - finish.pos[2]) <=
        finish.radius
      ) {
        progress.finished = true;
        progress.message = '';
        if (best === null || elapsed < best) {
          best = elapsed;
          progress.best = best;
          saveBest(best);
        }
        saveProgress(progress);
        setHud();
        try {
          game.events?.emit('glassline:finish', { time: elapsed });
        } catch {
          /* events are optional */
        }
        paused = true;
        controller.setEnabled(false);
        menu?.showComplete({
          time: formatTime(elapsed),
          best: formatTime(best ?? elapsed),
          respawns: progress.respawns,
        });
      }
    },
    dispose() {
      removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      menu?.dispose();
      audio.dispose();
      perf.dispose();
      hud.remove();
      controller.dispose();
    },
  };
}

export const glasslineTutorialMode = {
  /** @param {import('../../../types/engine').GameContext} game */
  create: async (game) => showcaseTutorial(game),
  /** @param {import('../../../types/engine').GameContext} game */
  showcase: showcaseTutorial,
};
