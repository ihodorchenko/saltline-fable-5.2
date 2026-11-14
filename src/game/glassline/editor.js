// @ts-check
// Level inspector/preview mode. It builds the tutorial data, shows an orbitable
// overview and lets a designer jump between checkpoints and export the JSON.
// It is a dev tool, not a shipping gameplay screen.

import { tutorialLevel } from '../../levels/tutorial.js';
import { buildLevel } from '../../levels/build.js';
import { validateLevel } from '../../levels/validate.js';

/**
 * @param {import('../../../types/engine').GameContext} game
 */
function hideShowcaseGround(game) {
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
}

function routeLength(level) {
  return level.checkpoints.reduce((sum, checkpoint, index) => {
    if (index === 0) return sum;
    const previous = level.checkpoints[index - 1];
    return (
      sum +
      Math.hypot(
        checkpoint.pos[0] - previous.pos[0],
        checkpoint.pos[2] - previous.pos[2],
      )
    );
  }, 0);
}

/**
 * @param {import('../../../types/engine').GameContext} game
 */
export async function showcaseEditor(game) {
  const level = tutorialLevel;
  hideShowcaseGround(game);
  const built = buildLevel(game, level);
  const errors = validateLevel(level);
  const meters = routeLength(level);
  const THREE = game.THREE;

  const panel = document.createElement('div');
  panel.id = 'glassline-editor';
  panel.style.cssText =
    'position:fixed;left:22px;top:22px;z-index:40;width:330px;padding:14px 16px;' +
    'background:rgba(8,12,16,.86);border:1px solid rgba(255,255,255,.36);color:#eef1ef;' +
    'font:12px/1.5 "IBM Plex Mono",monospace;letter-spacing:.04em;';
  const options = level.checkpoints
    .map(
      (checkpoint, index) =>
        `<option value="${index}">${String(index + 1).padStart(2, '0')} · ${checkpoint.stage}</option>`,
    )
    .join('');
  const actOptions = (level.acts || [])
    .map((act, index) => `<option value="${index}">${act.title}</option>`)
    .join('');
  panel.innerHTML =
    '<div style="color:#d23a39;font-weight:700;letter-spacing:.12em">LEVEL INSPECTOR</div>' +
    `<div style="margin-top:6px;color:#9aa4a8">${level.name} · ${meters.toFixed(0)} m · ${level.platforms.length} platforms · ${level.checkpoints.length} checkpoints</div>` +
    `<div style="margin-top:2px;color:#707b80">TARGET ${level.pacing.targetMinutes[0]}–${level.pacing.targetMinutes[1]} MIN · first playthrough</div>` +
    `<div style="margin-top:6px;color:${errors.length ? '#ff8a80' : '#8fbf9f'}">${errors.length ? errors.join(' · ') : 'format valid'}</div>` +
    '<div style="height:1px;background:#30383c;margin:10px 0"></div>' +
    '<label for="ed-checkpoint" style="color:#9aa4a8">CHECKPOINT</label>' +
    `<select id="ed-checkpoint" style="width:100%;margin:4px 0 8px;padding:4px;background:#11181c;color:#eef1ef;border:1px solid #465258">${options}</select>` +
    '<div style="display:flex;gap:6px"><button id="ed-focus" style="flex:1">Focus</button><button id="ed-overview" style="flex:1">Overview</button></div>' +
    `<select id="ed-act" style="width:100%;margin:8px 0 0;padding:4px;background:#11181c;color:#eef1ef;border:1px solid #465258">${actOptions}</select>` +
    '<div style="display:flex;gap:6px;margin-top:8px"><button id="ed-act-focus" style="flex:1">Focus act</button><button id="ed-play" style="flex:1">Play</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:8px"><button id="ed-export" style="flex:1">Export JSON</button><button id="ed-copy" style="flex:1">Copy summary</button></div>' +
    '<div id="ed-status" style="margin-top:8px;color:#707b80">Drag to orbit · wheel to zoom</div>';
  document.body.appendChild(panel);

  const stageInput = panel.querySelector('#ed-checkpoint');
  const actInput = panel.querySelector('#ed-act');
  const status = panel.querySelector('#ed-status');

  const view = {
    target: new THREE.Vector3(2, 1, -90),
    distance: 128,
    yaw: Math.PI * 0.2,
    pitch: 0.62,
    selected: 0,
  };

  function applyCamera() {
    const cos = Math.cos(view.pitch);
    game.camera.position.set(
      view.target.x + Math.sin(view.yaw) * cos * view.distance,
      view.target.y + Math.sin(view.pitch) * view.distance,
      view.target.z + Math.cos(view.yaw) * cos * view.distance,
    );
    game.camera.lookAt(view.target);
  }

  function focusCheckpoint(index) {
    const checkpoint = level.checkpoints[index];
    if (!checkpoint) return;
    view.selected = index;
    view.target.set(
      checkpoint.pos[0],
      checkpoint.pos[1] + 1,
      checkpoint.pos[2],
    );
    view.distance = 14;
    applyCamera();
    if (stageInput) stageInput.value = String(index);
    if (status) status.textContent = `Previewing ${checkpoint.stage}.`;
  }

  function focusAct(index) {
    const act = (level.acts || [])[index];
    if (!act) return;
    view.target.set(act.pos[0], act.pos[1], act.pos[2]);
    view.distance = 36;
    applyCamera();
    if (status) status.textContent = `Previewing ${act.title}.`;
  }

  function overview() {
    view.target.set(2, 1, -90);
    view.distance = 128;
    view.yaw = Math.PI * 0.2;
    view.pitch = 0.62;
    applyCamera();
    if (status) status.textContent = 'Overview: drag to orbit, wheel to zoom.';
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(level, null, 2)], {
      type: 'application/json',
    });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'glassline-tutorial.json';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    if (status) status.textContent = 'Exported glassline-tutorial.json.';
  }

  async function copySummary() {
    const summary = `${level.name}: ${level.checkpoints.length} checkpoints, ${level.platforms.length} platforms, ${meters.toFixed(0)} m`;
    try {
      await navigator.clipboard.writeText(summary);
      if (status) status.textContent = 'Summary copied.';
    } catch {
      if (status) status.textContent = summary;
    }
  }

  panel.querySelector('#ed-focus')?.addEventListener('click', () => {
    focusCheckpoint(Number(stageInput?.value || 0));
  });
  panel.querySelector('#ed-overview')?.addEventListener('click', overview);
  panel.querySelector('#ed-act-focus')?.addEventListener('click', () => {
    focusAct(Number(actInput?.value || 0));
  });
  panel.querySelector('#ed-play')?.addEventListener('click', () => {
    location.href = '/?show=glassline-tutorial&q=low';
  });
  panel.querySelector('#ed-export')?.addEventListener('click', downloadJson);
  panel.querySelector('#ed-copy')?.addEventListener('click', copySummary);
  stageInput?.addEventListener('change', () => {
    focusCheckpoint(Number(stageInput.value));
  });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = game.renderer.domElement;
  const onPointerDown = (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    view.yaw += (event.clientX - lastX) * 0.005;
    view.pitch = Math.max(
      0.08,
      Math.min(1.35, view.pitch + (event.clientY - lastY) * 0.004),
    );
    lastX = event.clientX;
    lastY = event.clientY;
    applyCamera();
  };
  const onPointerUp = () => {
    dragging = false;
  };
  const onWheel = (event) => {
    event.preventDefault();
    view.distance = Math.max(5, Math.min(220, view.distance + event.deltaY * 0.08));
    applyCamera();
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  overview();
  game.glassline = {
    root: built.root,
    level,
    editor: {
      view,
      focusCheckpoint,
      focusAct,
      overview,
    },
  };

  return {
    update() {},
    dispose() {
      panel.remove();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}

export const glasslineEditorMode = {
  /** @param {import('../../../types/engine').GameContext} game */
  create: async (game) => showcaseEditor(game),
  /** @param {import('../../../types/engine').GameContext} game */
  showcase: showcaseEditor,
};
