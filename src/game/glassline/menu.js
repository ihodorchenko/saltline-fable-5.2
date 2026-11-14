// @ts-check
// GLASSLINE shell: a full-screen future-city title/pause/complete menu with
// separate Settings and Controls screens. UI state is kept out of the player.

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
 *   onStartOver?: () => void,
 *   runStarted?: boolean,
 *   resumeLabel?: string,
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
    onStartOver,
    runStarted = false,
    resumeLabel = '',
    onSensitivity,
    audio,
    bindings,
  } = options;

  const root = document.createElement('div');
  root.id = 'glassline-menu';
  root.style.cssText =
    'position:fixed;inset:0;z-index:45;display:flex;align-items:center;' +
    'justify-content:flex-start;padding:clamp(28px,7vw,110px);' +
    'background:linear-gradient(90deg,rgba(4,8,11,.98) 0%,rgba(4,8,11,.9) 32%,rgba(4,8,11,.52) 62%,rgba(4,8,11,.16) 100%);' +
    'backdrop-filter:blur(2px);font:13px/1.55 "IBM Plex Mono",monospace;color:#eef1ef;';
  root.innerHTML = `
    <style>
      #glassline-menu .glm-frame { width:min(610px,92vw); max-height:90vh; overflow:auto; padding:clamp(24px,4vw,42px); border-left:2px solid #d23a39; background:linear-gradient(135deg,rgba(11,18,22,.94),rgba(8,13,16,.8)); box-shadow:0 30px 90px rgba(0,0,0,.4); }
      #glassline-menu .glm-kicker { color:#d23a39; font:600 10px/1.3 "IBM Plex Mono",monospace; letter-spacing:.22em; text-transform:uppercase; }
      #glassline-menu .glm-title { margin:12px 0 3px; color:#f4f0e6; font:900 clamp(58px,10vw,112px)/.78 "Big Shoulders Display","Arial Narrow",sans-serif; letter-spacing:.03em; text-transform:uppercase; }
      #glassline-menu .glm-subtitle { color:#c8d3d2; font:500 13px/1.4 "Barlow Condensed","Arial Narrow",sans-serif; letter-spacing:.13em; text-transform:uppercase; }
      #glassline-menu .glm-meta { color:#7f9298; font:400 10px/1.6 "IBM Plex Mono",monospace; letter-spacing:.1em; margin-top:7px; text-transform:uppercase; }
      #glassline-menu .glm-premise { max-width:43ch; margin:25px 0 4px; color:#abb8bb; font:500 15px/1.4 "Barlow Condensed","Arial Narrow",sans-serif; letter-spacing:.02em; }
      #glassline-menu .glm-rule { height:1px; margin:22px 0 18px; background:#303b40; }
      #glassline-menu .glm-actions { display:flex; flex-wrap:wrap; gap:8px; }
      #glassline-menu .glm-primary { flex:1 1 190px; min-height:48px; padding:2px 18px 0; border:0; background:#d23a39; color:#fff; font:700 14px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; cursor:pointer; }
      #glassline-menu .glm-primary:hover { background:#ef4a48; }
      #glassline-menu .glm-secondary { min-height:42px; padding:2px 15px 0; border:1px solid #46545a; background:rgba(11,18,22,.65); color:#eef1ef; font:600 11px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; cursor:pointer; }
      #glassline-menu .glm-secondary:hover { border-color:#aebcbe; background:rgba(238,241,239,.08); }
      #glassline-menu .glm-nav { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; padding-top:14px; border-top:1px solid #2a353a; }
      #glassline-menu .glm-nav a, #glassline-menu .glm-link { color:#9eafb1; font:500 10px/1.4 "IBM Plex Mono",monospace; letter-spacing:.08em; text-decoration:none; }
      #glassline-menu .glm-nav a:hover, #glassline-menu .glm-link:hover { color:#f0ece2; }
      #glassline-menu .glm-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:18px 0 20px; border-top:1px solid #303b40; border-bottom:1px solid #303b40; padding:13px 0; }
      #glassline-menu .glm-stats span { display:block; color:#70858a; font:500 9px/1.4 "IBM Plex Mono",monospace; letter-spacing:.12em; }
      #glassline-menu .glm-stats b { display:block; margin-top:3px; color:#f0ece2; font:700 24px/1 "Big Shoulders Display","Arial Narrow",sans-serif; letter-spacing:.03em; }
      #glassline-menu .glm-section { margin:16px 0 4px; color:#70858a; font:600 9px/1.3 "IBM Plex Mono",monospace; letter-spacing:.16em; }
      #glassline-menu .glm-row { display:grid; grid-template-columns:1fr 155px; gap:12px; align-items:center; margin:7px 0; color:#aebcbe; font-size:11px; }
      #glassline-menu .glm-row input[type=range] { width:100%; accent-color:#d23a39; }
      #glassline-menu .glm-row button { padding:7px 9px; text-align:left; }
      #glassline-menu .glm-bindgrid { display:grid; grid-template-columns:1fr 145px; gap:6px 12px; align-items:center; }
      #glassline-menu .glm-bindgrid span { color:#aebcbe; font-size:11px; }
      #glassline-menu .glm-bindgrid button { padding:6px 9px; text-align:left; }
      #glassline-menu .glm-error { color:#ff8a80; font-size:10px; margin-top:8px; }
      #glassline-menu .glm-help { color:#74888c; font:400 10px/1.5 "IBM Plex Mono",monospace; margin-top:12px; }
      @media (max-width:700px) { #glassline-menu { align-items:flex-start; padding:26px 18px; } #glassline-menu .glm-frame { max-height:94vh; } }
    </style>
    <div class="glm-frame" id="glm-frame"></div>`;
  document.body.appendChild(root);

  const frame = root.querySelector('#glm-frame');
  let current = 'start';
  let returnScreen = 'start';
  let visible = true;
  let sensitivity = loadSensitivity();
  let listeningAction = null;
  let bindError = '';

  const labels = {
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

  const statsMarkup = (stats = {}) =>
    `<div class="glm-stats"><div><span>TIME</span><b>${stats.time || '--:--'}</b></div><div><span>BEST</span><b>${stats.best || '--:--'}</b></div><div><span>RESPAWNS</span><b>${stats.respawns ?? 0}</b></div></div>`;

  function sensitivityMarkup() {
    return (
      `<div class="glm-row"><span>MOUSE SENSITIVITY <b id="glm-sens-value" style="color:#f0ece2">${sensitivity.toFixed(1)}×</b></span>` +
      `<input id="glm-sens" type="range" min="0.5" max="2" step="0.1" value="${sensitivity}"></div>`
    );
  }

  function audioMarkup() {
    if (!audio) return '';
    return (
      `<div class="glm-row"><span>AUDIO</span><button id="glm-mute" data-action="mute" class="glm-secondary">SOUND ${audio.muted ? 'OFF' : 'ON'}</button></div>` +
      `<div class="glm-row"><span>VOLUME <b id="glm-vol-value">${Math.round(audio.volume * 100)}%</b></span><input id="glm-vol" type="range" min="0" max="1" step="0.05" value="${audio.volume}"></div>`
    );
  }

  function settingsMarkup() {
    return (
      '<div class="glm-section">DISPLAY + AUDIO</div>' +
      sensitivityMarkup() +
      audioMarkup() +
      '<div class="glm-help">Quality is set by URL: <span class="glm-link">?q=low|medium|high</span>. The engine adapts resolution automatically when needed.</div>'
    );
  }

  function controlsMarkup() {
    if (!bindings) return '<div class="glm-help">Bindings unavailable.</div>';
    const rows = BINDING_ACTIONS.map(
      (action) =>
        `<span>${labels[action] || action}</span>` +
        `<button data-action="bind" data-binding="${action}" class="glm-secondary">${listeningAction === action ? 'PRESS KEY' : bindings.label(action)}</button>`,
    ).join('');
    return (
      '<div class="glm-section">KEYBOARD</div>' +
      `<div class="glm-bindgrid">${rows}</div>` +
      (bindError ? `<div class="glm-error">${bindError}</div>` : '') +
      '<button data-action="reset-bindings" class="glm-secondary" style="margin-top:14px;width:100%">RESET KEYS</button>'
    );
  }

  function primaryMarkup() {
    if (current === 'start') {
      return runStarted
        ? '<button class="glm-primary" data-action="start">CONTINUE</button><button class="glm-secondary" data-action="start-over">START OVER</button>'
        : '<button class="glm-primary" data-action="start">START RUN</button>';
    }
    if (current === 'pause') {
      return '<button class="glm-primary" data-action="resume">RESUME</button><button class="glm-secondary" data-action="restart">RESTART RUN</button>';
    }
    if (current === 'complete') {
      return '<button class="glm-primary" data-action="restart">RUN AGAIN</button>';
    }
    return '<button class="glm-primary" data-action="back">BACK</button>';
  }

  function navMarkup() {
    if (current === 'settings' || current === 'controls') return '';
    return (
      '<div class="glm-nav">' +
      '<button data-action="settings" class="glm-secondary">SETTINGS</button>' +
      '<button data-action="controls" class="glm-secondary">CONTROLS</button>' +
      '<a href="?show=glassline-editor&q=high">LEVEL INSPECTOR</a>' +
      '</div>'
    );
  }

  function render(stats = {}) {
    const isStart = current === 'start';
    const isPause = current === 'pause';
    const isComplete = current === 'complete';
    const isSettings = current === 'settings';
    const isControls = current === 'controls';
    const title = isStart
      ? 'GLASSLINE'
      : isPause
        ? 'PAUSED'
        : isComplete
          ? 'RUN COMPLETE'
          : isSettings
            ? 'SETTINGS'
            : 'CONTROLS';
    const kicker = isStart
      ? runStarted
        ? 'RUN IN PROGRESS'
        : 'A CITY THAT NEVER TOUCHES THE GROUND'
      : isPause
        ? 'RUN SUSPENDED'
        : isComplete
          ? 'COURSE COMPLETE'
          : 'SYSTEM';
    const subtitle = isStart
      ? runStarted
        ? resumeLabel || 'YOUR LAST CHECKPOINT IS SAVED'
        : 'ROOFTOP INDUCTION'
      : isPause
        ? 'THE SKYLINE IS WAITING'
        : isComplete
          ? 'ROOFTOP INDUCTION CLEARED'
          : isSettings
            ? 'DISPLAY, AUDIO AND FEEDBACK'
            : 'BIND YOUR MOVEMENT';
    const body = isStart
      ? '<div class="glm-premise">A rooftop courier’s first ascent through the vertical city. Keep your flow, read the route, and do not look down.</div>' +
        `<div class="glm-meta">${level.acts.length} ACTS · ${level.checkpoints.length} CHECKPOINTS · ${level.pacing.targetMinutes[0]}–${level.pacing.targetMinutes[1]} MIN TARGET</div>`
      : isPause
        ? ''
        : isComplete
          ? statsMarkup(stats)
          : isSettings
            ? settingsMarkup()
            : controlsMarkup();
    frame.innerHTML =
      `<div class="glm-kicker">${kicker}</div>` +
      `<div class="glm-title">${title}</div>` +
      `<div class="glm-subtitle">${subtitle}</div>` +
      '<div class="glm-rule"></div>' +
      body +
      `<div class="glm-actions">${primaryMarkup()}</div>` +
      navMarkup() +
      (isPause
        ? '<div class="glm-help">R retry · Backspace restart</div>'
        : '');
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
    const volume = root.querySelector('#glm-vol');
    const volumeValue = root.querySelector('#glm-vol-value');
    volume?.addEventListener('input', () => {
      audio?.setVolume(Number(volume.value));
      if (volumeValue) volumeValue.textContent = `${Math.round(Number(volume.value) * 100)}%`;
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

  function openScreen(screen) {
    returnScreen = current;
    current = screen;
    render();
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
        ? `${formatKey(event.code)} is already bound to ${labels[result.conflict] || result.conflict}.`
        : 'Could not bind that key.';
    } else {
      bindError = '';
      saveBindings(bindings);
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
    if (action === 'settings') return openScreen('settings');
    if (action === 'controls') return openScreen('controls');
    if (action === 'back') {
      current = returnScreen;
      bindError = '';
      return render();
    }
    if (action === 'reset-bindings') {
      bindings?.reset();
      saveBindings(bindings);
      bindError = '';
      return render();
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
      if (muteButton) muteButton.textContent = `SOUND ${audio?.muted ? 'OFF' : 'ON'}`;
      return;
    }
    if (action === 'start') {
      hide();
      onStart();
      lock();
    } else if (action === 'start-over') {
      hide();
      onStartOver?.();
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
