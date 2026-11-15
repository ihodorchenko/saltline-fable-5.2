// @ts-check
// GLASSLINE tutorial mode: data-driven route, checkpoint/respawn/finish flow,
// saved progress, route readability and a minimal stage HUD.

import { tutorialLevel } from '../../levels/tutorial.js';
import { buildLevel } from '../../levels/build.js';
import { keyHint, keycapHtml } from './hud.js';
import { createBeacon } from '../../levels/guides.js';
import { createPlayerController } from './player.js';
import { createTutorialMenu } from './menu.js';
import { createGlasslineAudio } from './audio.js';
import { loadBindings } from './bindings.js';
import { createPerfHud } from './perf.js';
import { createCourierRig, createMentorCharacter } from './characters.js';
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
  hud.className = 'gl-hud';
  // Plates are the default; ?hud=ink opts out for the frameless variant.
  if (new URLSearchParams(window.location.search).get('hud') !== 'ink') {
    hud.classList.add('gl-hud--plate');
  }
  hud.innerHTML =
    '<div class="gl-hud__left">' +
    '<div class="gl-hud__brand"><span class="gl-hud__mark">GLASSLINE</span><span class="gl-hud__sub">ROOFTOP INDUCTION</span></div>' +
    '<div class="gl-hud__act" id="gl-act">ACT I / III</div>' +
    '<div class="gl-hud__stage" id="gl-stage"></div>' +
    '<div class="gl-progress" id="gl-progress"><i id="gl-progress-fill"></i></div>' +
    '<div class="gl-hud__count" id="gl-count"></div>' +
    '</div>' +
    '<div class="gl-hud__right">' +
    '<div class="gl-hud__time" id="gl-time">TIME 00:00</div>' +
    '<div class="gl-hud__best" id="gl-best">BEST --:--</div>' +
    '<div class="gl-hud__split" id="gl-split">SPLIT --:--</div>' +
    '</div>' +
    '<div class="gl-hud__prompt" id="gl-prompt"></div>' +
    '<div class="gl-hud__help" id="gl-help">R retry · Backspace restart</div>' +
    '<div class="gl-toast" id="gl-toast"><div class="gl-toast__title" id="gl-toast-title"></div><div class="gl-toast__sub" id="gl-toast-sub"></div></div>' +
    '<div class="gl-dispatch" id="gl-dispatch"><span class="gl-dispatch__tag">DISPATCH</span><span class="gl-dispatch__text" id="gl-dispatch-text"></span></div>';
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
  const actEl = hud.querySelector('#gl-act');
  const stageEl = hud.querySelector('#gl-stage');
  const promptEl = hud.querySelector('#gl-prompt');
  const countEl = hud.querySelector('#gl-count');
  const timeEl = hud.querySelector('#gl-time');
  const splitEl = hud.querySelector('#gl-split');
  const bestEl = hud.querySelector('#gl-best');
  const fillEl = hud.querySelector('#gl-progress-fill');
  const helpEl = hud.querySelector('#gl-help');
  const toastEl = hud.querySelector('#gl-toast');
  const toastTitle = hud.querySelector('#gl-toast-title');
  const toastSub = hud.querySelector('#gl-toast-sub');
  const dispatchEl = hud.querySelector('#gl-dispatch');
  const dispatchText = hud.querySelector('#gl-dispatch-text');
  let toastTimer = 0;
  let dispatchTimer = 0;

  function showDispatch(text) {
    if (!dispatchEl || !dispatchText) return;
    dispatchText.textContent = text;
    dispatchEl.classList.add('on');
    window.clearTimeout(dispatchTimer);
    dispatchTimer = window.setTimeout(
      () => dispatchEl.classList.remove('on'),
      7000,
    );
  }
  const hintEl = document.querySelector('#glassline-hint');
  if (helpEl) {
    helpEl.innerHTML = [
      keyHint(bindings.label('retry'), 'retry'),
      keyHint(bindings.label('restart'), 'restart'),
      'click view to look',
    ].join(' · ');
  }
  // The stage HUD owns the tutorial's on-screen copy. Keep the controller's
  // generic hint out of the scene; the title screen explains pointer lock.
  if (hintEl) hintEl.style.display = 'none';
  const courier = createCourierRig(game);
  const mentor = createMentorCharacter(game);
  built.root.add(mentor.root);
  function showHud() {
    hud.style.display = 'block';
    courier.setVisible(true);
    if (mentor.active) mentor.root.visible = true;
  }
  function hideHud() {
    hud.style.display = 'none';
    courier.setVisible(false);
    mentor.root.visible = false;
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

  const beacon = createBeacon(game.THREE);
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

  function actForCheckpoint(index) {
    if (index >= 17) return { index: 2, roman: 'III' };
    if (index >= 10) return { index: 1, roman: 'II' };
    return { index: 0, roman: 'I' };
  }

  function showToast(title, sub) {
    if (!toastEl) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastSub) toastSub.textContent = sub;
    toastEl.classList.add('on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  function setHud() {
    const checkpoint = level.checkpoints[progress.checkpoint];
    const act = actForCheckpoint(progress.checkpoint);
    if (actEl) {
      const actTitle = (level.acts[act.index]?.title || '')
        .split('—')
        .pop()
        .trim();
      actEl.textContent = progress.finished
        ? 'RUN COMPLETE / III ACTS'
        : `ACT ${act.roman} / III · ${actTitle}`;
    }
    if (stageEl) {
      stageEl.textContent = progress.finished
        ? 'COURSE COMPLETE'
        : `${String(progress.checkpoint + 1).padStart(2, '0')} / 21 · ${checkpoint.stage}`;
    }
    if (promptEl) {
      promptEl.innerHTML = keycapHtml(
        progress.finished
          ? 'Rooftop induction complete. Backspace restarts.'
          : progress.message || checkpoint.prompt,
      );
    }
    if (countEl) {
      countEl.textContent =
        `${String(progress.checkpoint).padStart(2, '0')} / ${String(
          level.checkpoints.length - 1,
        ).padStart(2, '0')} CHECKPOINTS   ·   ${progress.respawns} RESPAWNS`;
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
    showToast('RESPAWNED', `CHECKPOINT ${String(progress.checkpoint).padStart(2, '0')} · ${progress.respawns} TOTAL`);
  }

  function restart() {
    progress.checkpoint = 0;
    progress.respawns = 0;
    progress.finished = false;
    progress.message = '';
    if (toastEl) toastEl.classList.remove('on');
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
    showHud();
    mentor.begin();
    setHud();
  }

  function startOver() {
    restart();
    started = true;
    paused = false;
    showHud();
    controller.setEnabled(true);
    audio.start();
    audio.play('ui');
    audio.updateMotion(0, false);
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
      showHud();
      mentor.begin();
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
      audio.updateMotion(0, false);
      audio.playDispatch();
      showDispatch(
        'Rooftop line is open. Follow the red thread. Do not look down.',
      );
    },
    onResume: () => {
      paused = false;
      showHud();
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
      audio.updateMotion(0, false);
    },
    onRestart: () => {
      restart();
      started = true;
      paused = false;
      showHud();
      controller.setEnabled(true);
      audio.start();
      audio.play('ui');
      audio.updateMotion(0, false);
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
    showHud();
    mentor.begin();
    controller.setEnabled(true);
  }
  const benchMode = game.params?.peak === '1';
  if (!autostart && !benchMode) {
    menu.hide();
    hideHud();
    paused = true;
  }
  let bench = null;
  let bootObserver = null;
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

  function revealMenu() {
    hideHud();
    if (progress.finished) {
      paused = true;
      started = false;
      controller.setEnabled(false);
      menu?.showComplete({
        time: '--:--',
        best: best ? formatTime(best) : '--:--',
        respawns: progress.respawns,
      });
    } else {
      paused = true;
      started = false;
      controller.setEnabled(false);
      menu?.showStart();
    }
  }

  if (!benchMode && (progress.finished || !autostart)) {
    const bootEl = document.querySelector('#boot');
    const bootDone = () =>
      !bootEl ||
      bootEl.hidden ||
      bootEl.classList.contains('done') ||
      getComputedStyle(bootEl).opacity === '0';
    if (bootDone()) {
      revealMenu();
    } else if (bootEl) {
      bootObserver = new MutationObserver(() => {
        if (bootDone()) {
          bootObserver?.disconnect();
          bootObserver = null;
          revealMenu();
        }
      });
      bootObserver.observe(bootEl, {
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
      });
    }
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
      hideHud();
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
    city: built.city,
    storageKey: TUTORIAL_STORAGE_KEY,
    menu,
    audio,
    bindings,
    perf,
    bench,
    characters: { courier, mentor },
  };

  return {
    update(dt) {
      if (benchMode) {
        updateBench(performance.now());
        return;
      }
      perf.update(dt);
      if (built.sky) built.sky.position.copy(game.camera.position);
      if (built.lighting) built.lighting.update(game.camera.position);
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
      courier.update(game.camera, state, game.time?.t || elapsed, dt);
      mentor.update(dt, state.pos.z);
      audio.updateMotion(state.speed, state.pos.z < -174);

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
          showToast(
            `CHECKPOINT ${String(i).padStart(2, '0')} / ${String(
              level.checkpoints.length - 1,
            ).padStart(2, '0')}`,
            `${checkpoint.stage}  ·  +${formatTime(split)}`,
          );
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
        if (game.camera) {
          game.camera.fov = 75;
          game.camera.rotation.z = 0;
          game.camera.updateProjectionMatrix();
        }
        audio.updateMotion(0, true);
        try {
          game.events?.emit('glassline:finish', { time: elapsed });
        } catch {
          /* events are optional */
        }
        paused = true;
        hideHud();
        controller.setEnabled(false);
        menu?.showComplete({
          time: formatTime(elapsed),
          best: formatTime(best ?? elapsed),
          respawns: progress.respawns,
        });
      }
    },
    dispose() {
      bootObserver?.disconnect();
      window.clearTimeout(dispatchTimer);
      removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      menu?.dispose();
      audio.dispose();
      perf.dispose();
      courier.root.removeFromParent();
      mentor.root.removeFromParent();
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
