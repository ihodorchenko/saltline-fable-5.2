// @ts-check
// GLASSLINE tutorial mode: data-driven blockout plus checkpoint/respawn/finish
// flow and a minimal stage HUD.

import { tutorialLevel } from '../../levels/tutorial.js';
import { buildLevel } from '../../levels/build.js';
import { createPlayerController } from './player.js';

/**
 * @param {import('../../../types/engine').GameContext} game
 */
function createHud() {
  const hud = document.createElement('div');
  hud.id = 'glassline-tutorial';
  hud.style.cssText =
    'position:fixed;left:22px;top:22px;z-index:40;max-width:330px;padding:14px 16px;' +
    'background:rgba(8,12,16,.76);border:1px solid rgba(255,255,255,.36);color:#eef1ef;' +
    'font:12px/1.5 "IBM Plex Mono",monospace;letter-spacing:.05em;';
  hud.innerHTML =
    '<div id="gl-stage" style="color:#d23a39;font-weight:700;letter-spacing:.12em"></div>' +
    '<div id="gl-prompt" style="margin-top:6px"></div>' +
    '<div id="gl-count" style="margin-top:9px;color:#9aa4a8"></div>';
  document.body.appendChild(hud);
  return hud;
}

/**
 * @param {import('../../../types/engine').GameContext} game
 */
export async function showcaseTutorial(game) {
  const level = tutorialLevel;
  const built = buildLevel(game, level);
  const controller = createPlayerController(game);
  const hud = createHud();
  const stageEl = hud.querySelector('#gl-stage');
  const promptEl = hud.querySelector('#gl-prompt');
  const countEl = hud.querySelector('#gl-count');

  const progress = {
    checkpoint: 0,
    respawns: 0,
    finished: false,
    message: '',
  };

  function setHud() {
    const checkpoint = level.checkpoints[progress.checkpoint];
    if (stageEl) stageEl.textContent = progress.finished ? 'COURSE COMPLETE' : checkpoint.stage;
    if (promptEl) promptEl.textContent = progress.finished
      ? 'Rooftop induction complete.'
      : progress.message || checkpoint.prompt;
    if (countEl) {
      countEl.textContent = `${progress.checkpoint}/${level.checkpoints.length - 1} CHECKPOINTS · ${progress.respawns} RESPAWNS`;
    }
  }

  function respawn() {
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
    progress.message = 'Respawned at last checkpoint.';
    setHud();
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

  game.glassline = {
    controller,
    root: built.root,
    tutorial: progress,
    level,
  };

  return {
    update(dt) {
      if (progress.finished) return;
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

      for (let i = level.checkpoints.length - 1; i > progress.checkpoint; i--) {
        const checkpoint = level.checkpoints[i];
        const dx = state.pos.x - checkpoint.pos[0];
        const dz = state.pos.z - checkpoint.pos[2];
        if (Math.hypot(dx, dz) <= checkpoint.radius) {
          progress.checkpoint = i;
          progress.message = '';
          setHud();
          break;
        }
      }

      const finish = level.finish;
      if (
        Math.hypot(
          state.pos.x - finish.pos[0],
          state.pos.z - finish.pos[2],
        ) <= finish.radius
      ) {
        progress.finished = true;
        progress.message = '';
        setHud();
      }
    },
    dispose() {
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
