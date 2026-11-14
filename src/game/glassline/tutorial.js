// @ts-check
// GLASSLINE tutorial mode: data-driven route, checkpoint/respawn/finish flow,
// saved progress, route readability and a minimal stage HUD.

import { tutorialLevel } from '../../levels/tutorial.js';
import { buildLevel } from '../../levels/build.js';
import { createPlayerController } from './player.js';
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
  const empty = { checkpoint: 0, respawns: 0, finished: false };
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
  const controller = createPlayerController(game);
  const hud = createHud();
  const stageEl = hud.querySelector('#gl-stage');
  const promptEl = hud.querySelector('#gl-prompt');
  const countEl = hud.querySelector('#gl-count');
  const timeEl = hud.querySelector('#gl-time');
  const splitEl = hud.querySelector('#gl-split');
  const bestEl = hud.querySelector('#gl-best');
  const fillEl = hud.querySelector('#gl-progress-fill');
  let elapsed = 0;
  let timeAccumulator = 0;
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
      timeEl.textContent = `TIME ${formatTime(elapsed)}`;
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
    setHud();
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

  function onKeyDown(event) {
    if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      respawn();
    } else if (event.code === 'Backspace' && !event.repeat) {
      event.preventDefault();
      restart();
    }
  }
  addEventListener('keydown', onKeyDown);

  game.glassline = {
    controller,
    root: built.root,
    tutorial: progress,
    level,
    storageKey: TUTORIAL_STORAGE_KEY,
  };

  return {
    update(dt) {
      if (beacon.visible) beacon.rotation.y += dt * 1.2;
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
      }
    },
    dispose() {
      removeEventListener('keydown', onKeyDown);
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
