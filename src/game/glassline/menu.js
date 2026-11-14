// @ts-check
// Original GLASSLINE title/pause/complete shell. Kept separate from the player
// controller so UI state cannot leak into movement state.

import { BINDING_ACTIONS, formatKey, saveBindings } from './bindings.js';

export const SENSITIVITY_KEY = 'glassline.sensitivity.v1';

function loadSensitivity() {
  try {
    const value = Number(localStorage.getItem(SENSITIVITY_KEY));
    return Number.isFinite(value) && value >= 0.5 && value <= 2 ? value : 1;
  } catch {
    return 1;
  }
}

function saveSensitivity(value) {
  try {
    localStorage.setItem(SENSITIVITY_KEY, String(value));
  } catch {
    /* storage is optional */
  }
}

/**
 * @param {{
 *   level: any,
 *   canvas: HTMLCanvasElement|null,
 *   onStart: () => void,
 *   onResume: () => void,
 *   onRestart: () => void,
 *   onSensitivity: (value: number) => void,
 *   audio?: any,
 *   bindings?: any,
 * }} options
 */
export function createTutorialMenu(options) {
  const {
    level,
    canvas,
    onStart,
    onResume,
    onRestart,
    onSensitivity,
    audio,
    bindings,
  } = options;
  const root = document.createElement('div');
  root.id = 'glassline-menu';
  root.style.cssText =
    'position:fixed;inset:0;z-index:60;display:flex;align-items:center;' +
    'justify-content:center;background:radial-gradient(circle at 50% 42%,' +
    'rgba(15,22,27,.58),rgba(4,7,9,.94) 68%);backdrop-filter:blur(3px);' +
    'font:13px/1.55 "IBM Plex Mono",monospace;color:#eef1ef;';
  document.body.appendChild(root);

  let current = 'start';
  let settingsReturn = 'start';
  let visible = true;
  let sensitivity = loadSensitivity();
  let listeningAction = null;
  let bindError = '';

  const actionLabels = {
    forward: 'FORWARD',
    back: 'BACK',
    left: 'LEFT',
    right: 'RIGHT',
    sprint: 'SPRINT',
    jump: 'JUMP / VAULT',
    slide: 'SLIDE / ROLL',
    retry: 'RETRY',
    restart: 'RESTART',
  };

  function controlsMarkup() {
    if (!bindings) return '';
    return [
      ['forward', 'move'],
      ['sprint', 'sprint'],
      ['jump', 'jump / vault / mantle'],
      ['slide', 'slide / roll'],
      ['retry', 'retry checkpoint'],
    ]
      .map(
        ([action, label]) =>
          `<div style="display:flex;gap:12px"><span style="min-width:112px;color:#d23a39">${bindings.label(action)}</span><span style="color:#aeb8bc">${label}</span></div>`,
      )
      .join('');
  }

  function statsMarkup(stats = {}) {
    return (
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 22px;border-top:1px solid #30383c;border-bottom:1px solid #30383c;padding:12px 0">` +
      `<div><div style="color:#707b80">TIME</div><div style="font-size:22px">${stats.time || '--:--'}</div></div>` +
      `<div><div style="color:#707b80">BEST</div><div style="font-size:22px">${stats.best || '--:--'}</div></div>` +
      `<div><div style="color:#707b80">RESPAWNS</div><div style="font-size:22px">${stats.respawns ?? 0}</div></div>` +
      '</div>'
    );
  }

  function sensitivityMarkup() {
    return (
      `<label style="display:grid;grid-template-columns:1fr 150px;gap:12px;align-items:center;margin:14px 0 18px;color:#aeb8bc">` +
      `<span>MOUSE SENSITIVITY <span id="glm-sens-value" style="color:#eef1ef">${sensitivity.toFixed(1)}×</span></span>` +
      `<input id="glm-sens" type="range" min="0.5" max="2" step="0.1" value="${sensitivity}" style="accent-color:#d23a39">` +
      '</label>'
    );
  }

  function audioMarkup() {
    if (!audio) return '';
    return (
      `<div style="display:grid;grid-template-columns:1fr 150px;gap:12px;align-items:center;margin:0 0 18px;color:#aeb8bc">` +
      `<button id="glm-mute" data-action="mute" style="padding:8px 10px;background:${audio.muted ? '#1a2226' : '#253036'};color:#eef1ef;border:1px solid #465258;font:700 11px 'IBM Plex Mono',monospace;cursor:pointer">SOUND ${audio.muted ? 'OFF' : 'ON'}</button>` +
      `<input id="glm-vol" type="range" min="0" max="1" step="0.05" value="${audio.volume}" style="accent-color:#d23a39">` +
      '</div>'
    );
  }

  function settingsMarkup() {
    if (!bindings) {
      return '<div style="color:#aeb8bc">Bindings unavailable.</div>';
    }
    const rows = BINDING_ACTIONS.map(
      (action) =>
        `<div style="display:grid;grid-template-columns:1fr 130px;gap:10px;align-items:center;margin:4px 0">` +
        `<span style="color:#aeb8bc">${actionLabels[action] || action}</span>` +
        `<button data-action="bind" data-binding="${action}" style="padding:5px 8px;background:#131b1f;color:#eef1ef;border:1px solid #465258;font:700 11px 'IBM Plex Mono',monospace;cursor:pointer">${listeningAction === action ? 'PRESS KEY' : bindings.label(action)}</button>` +
        '</div>',
    ).join('');
    return (
      `<div style="margin:12px 0 4px;color:#707b80">CONTROLS</div>` +
      rows +
      `<div style="display:flex;gap:8px;margin-top:10px"><button data-action="reset-bindings" style="flex:1;padding:8px;background:#1a2226;color:#eef1ef;border:1px solid #465258;font:700 11px 'IBM Plex Mono',monospace;cursor:pointer">RESET KEYS</button><button data-action="back-settings" style="flex:1;padding:8px;background:#d23a39;color:#fff;border:0;font:700 11px 'IBM Plex Mono',monospace;cursor:pointer">BACK</button></div>` +
      (bindError ? `<div style="color:#ff8a80;margin-top:8px">${bindError}</div>` : '')
    );
  }

  function actionsMarkup() {
    if (current === 'start') {
      return (
        '<button data-action="start" style="width:100%;padding:14px;background:#d23a39;color:#fff;border:0;font:700 14px \'IBM Plex Mono\',monospace;letter-spacing:.14em;cursor:pointer">START RUN</button>' +
        '<div style="display:flex;justify-content:space-between;margin-top:10px"><button data-action="settings" style="padding:6px 10px;background:#1a2226;color:#eef1ef;border:1px solid #465258;font:700 11px \'IBM Plex Mono\',monospace;cursor:pointer">SETTINGS</button><a href="?show=glassline-editor&q=low" style="color:#aeb8bc">LEVEL INSPECTOR</a><span style="color:#707b80">CLICK TO CAPTURE MOUSE</span></div>'
      );
    }
    if (current === 'pause') {
      return (
        '<div style="display:flex;gap:8px"><button data-action="resume" style="flex:1;padding:13px;background:#d23a39;color:#fff;border:0;font:700 13px \'IBM Plex Mono\',monospace;cursor:pointer">RESUME</button>' +
        '<button data-action="restart" style="flex:1;padding:13px;background:#1a2226;color:#eef1ef;border:1px solid #465258;font:700 13px \'IBM Plex Mono\',monospace;cursor:pointer">RESTART</button>' +
        '<button data-action="settings" style="flex:1;padding:13px;background:#1a2226;color:#eef1ef;border:1px solid #465258;font:700 13px \'IBM Plex Mono\',monospace;cursor:pointer">SETTINGS</button></div>' +
        '<div style="margin-top:12px"><a href="?show=glassline-editor&q=low" style="color:#aeb8bc">LEVEL INSPECTOR</a></div>'
      );
    }
    if (current === 'settings') {
      return settingsMarkup();
    }
    return (
      '<div style="display:flex;gap:8px"><button data-action="restart" style="flex:1;padding:13px;background:#d23a39;color:#fff;border:0;font:700 13px \'IBM Plex Mono\',monospace;cursor:pointer">RUN AGAIN</button>' +
      '<a href="?show=glassline-editor&q=low" style="flex:1;display:grid;place-items:center;padding:13px;border:1px solid #465258;color:#eef1ef;text-decoration:none">INSPECTOR</a></div>'
    );
  }

  function render(stats = {}) {
    const isStart = current === 'start';
    const isPause = current === 'pause';
    const isSettings = current === 'settings';
    const title = isStart
      ? 'GLASSLINE'
      : isSettings
        ? 'SETTINGS'
        : current === 'pause'
          ? 'PAUSED'
          : 'RUN COMPLETE';
    const kicker = isStart
      ? 'PHASE 2 / PARKOUR'
      : isSettings
        ? 'SYSTEM'
        : current === 'pause'
          ? 'RUN SUSPENDED'
          : 'COURSE COMPLETE';
    const subtitle = isStart
      ? level.name
      : isSettings
        ? 'Input, audio and sensitivity.'
        : current === 'pause'
          ? 'The rooftop is waiting.'
          : 'Rooftop induction cleared.';
    root.innerHTML =
      `<div style="width:min(660px,90vw);padding:34px 36px 28px;background:rgba(8,12,16,.9);border-top:2px solid #d23a39;border-bottom:1px solid rgba(255,255,255,.3)">` +
      `<div style="color:#d23a39;letter-spacing:.18em;font-size:11px">${kicker}</div>` +
      `<div style="font:700 clamp(54px,9vw,92px)/.92 'Arial Narrow','Helvetica Neue',sans-serif;letter-spacing:-.02em;margin:10px 0 4px">${title}</div>` +
      `<div style="color:#aeb8bc;letter-spacing:.12em">${subtitle}</div>` +
      `<div style="color:#707b80;margin-top:8px">${level.acts.length} ACTS · ${level.checkpoints.length} CHECKPOINTS · ${level.pacing.targetMinutes[0]}–${level.pacing.targetMinutes[1]} MIN TARGET</div>` +
      (isStart
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 22px;margin:22px 0 10px">${controlsMarkup()}</div>`
        : isSettings
          ? ''
          : statsMarkup(stats)) +
      sensitivityMarkup() +
      audioMarkup() +
      actionsMarkup() +
      (isPause ? '<div style="color:#707b80;margin-top:10px">Backspace restarts from the beginning.</div>' : '') +
      '</div>';
    root.style.display = 'flex';
    visible = true;
    const slider = root.querySelector('#glm-sens');
    const valueEl = root.querySelector('#glm-sens-value');
    slider?.addEventListener('input', () => {
      sensitivity = Number(slider.value) || 1;
      if (valueEl) valueEl.textContent = `${sensitivity.toFixed(1)}×`;
      saveSensitivity(sensitivity);
      onSensitivity(sensitivity);
    });
    const volumeSlider = root.querySelector('#glm-vol');
    volumeSlider?.addEventListener('input', () => {
      audio?.setVolume(Number(volumeSlider.value));
    });
  }

  function hide() {
    visible = false;
    root.style.display = 'none';
  }

  function lock() {
    if (!canvas || !canvas.requestPointerLock) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    } catch {
      /* pointer lock is optional */
    }
  }

  function onBindKey(event) {
    if (!listeningAction) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      listeningAction = null;
      window.removeEventListener('keydown', onBindKey, true);
      render();
      return;
    }
    const action = listeningAction;
    const result = bindings?.set(action, event.code);
    if (!result?.ok) {
      bindError = result?.conflict
        ? `${formatKey(event.code)} is already bound to ${actionLabels[result.conflict] || result.conflict}.`
        : 'Could not bind that key.';
    } else {
      saveBindings(bindings);
      bindError = '';
    }
    listeningAction = null;
    window.removeEventListener('keydown', onBindKey, true);
    render();
  }

  root.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement|null} */ (event.target);
    const button = target?.closest?.('[data-action]');
    const action = button?.getAttribute('data-action');
    if (!action) return;
    if (action === 'settings') {
      settingsReturn = current;
      current = 'settings';
      bindError = '';
      render();
      return;
    }
    if (action === 'back-settings') {
      current = settingsReturn;
      bindError = '';
      render();
      return;
    }
    if (action === 'reset-bindings') {
      bindings?.reset();
      saveBindings(bindings);
      bindError = '';
      render();
      return;
    }
    if (action === 'bind') {
      listeningAction = button?.getAttribute('data-binding') || null;
      bindError = '';
      render();
      window.addEventListener('keydown', onBindKey, true);
      return;
    }
    if (action === 'mute') {
      audio?.setMuted(!audio.muted);
      const muteButton = root.querySelector('#glm-mute');
      if (muteButton) {
        muteButton.textContent = `SOUND ${audio?.muted ? 'OFF' : 'ON'}`;
        muteButton.style.background = audio?.muted ? '#1a2226' : '#253036';
      }
      return;
    }
    if (action === 'start') {
      hide();
      onStart();
      lock();
    } else if (action === 'resume') {
      hide();
      onResume();
      lock();
    } else if (action === 'restart') {
      hide();
      onRestart();
      lock();
    }
  });

  function showStart() {
    current = 'start';
    render();
  }

  function showPause() {
    current = 'pause';
    render();
  }

  function showComplete(stats) {
    current = 'complete';
    render(stats);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  showStart();
  onSensitivity(sensitivity);

  return {
    showStart,
    showPause,
    showComplete,
    hide,
    dispose() {
      root.remove();
    },
    get visible() {
      return visible;
    },
    get mode() {
      return current;
    },
  };
}
