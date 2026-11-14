// Gameplay HUD adapter: objectives, relay markers, interaction prompt,
// contact warnings and the small set of HUD calls used by the game flow.
// The engine HUD owns the DOM; this module owns Saltline presentation rules.

import { compassNames } from './content.js';

/**
 * @param {object|undefined} hud engine HUD
 * @returns {object} gameplay-facing HUD API
 */
export function createGameHud(hud) {
  const call = (name, ...args) => {
    if (hud && typeof hud[name] === 'function') return hud[name](...args);
    return undefined;
  };

  function objectiveText(run) {
    if (run.allCut) return 'Get to the boat';
    const remaining = run.relays.length - run.cut;
    if (run.cut === 0) return 'Cut the three uplink relays';
    if (remaining === 1) return 'Cut the last relay';
    return `Cut the remaining ${remaining} relays`;
  }

  function syncMarkers(run, level) {
    if (!hud || typeof hud.setMarkers !== 'function') return;
    const markers = run.relays
      .filter((relay) => !relay.cut)
      .map((relay) => ({
        id: relay.id,
        short: relay.short,
        label: relay.o.label || 'Relay ' + relay.short,
        pos: relay.o.pos,
        kind: 'relay',
      }));
    if (run.allCut && level.extraction) {
      markers.push({
        id: 'extract',
        short: 'EX',
        label: 'Boat',
        pos: level.extraction.pos,
        kind: 'extract',
      });
    }
    call('setMarkers', markers);
  }

  function prompt(relay) {
    if (relay && !relay.cut) call('setPrompt', 'Cut relay ' + relay.short, relay.t);
    else call('setPrompt', null);
  }

  function contact(dx, dz) {
    const angle = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const bearing = (angle + 360) % 360;
    call('warn', 'Contact \u2014 ' + compassNames[Math.round(bearing / 45) % 8], 3.4);
  }

  return {
    reset() {
      call('reset');
    },
    show(visible) {
      call('show', visible);
    },
    isVisible() {
      return !!(hud && hud.root && hud.root.classList.contains('on'));
    },
    setObjective(text) {
      call('setObjective', text);
    },
    objectiveText,
    setRelays(run) {
      call('setRelays', run.cut, run.relays.length);
    },
    syncMarkers,
    prompt,
    contact,
    message(...args) {
      call('message', ...args);
    },
    warn(...args) {
      call('warn', ...args);
    },
    radio(...args) {
      call('radio', ...args);
    },
    clearRadio() {
      call('clearRadio');
    },
    setPrompt(...args) {
      call('setPrompt', ...args);
    },
  };
}
