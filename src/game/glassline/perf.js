// @ts-check
// Optional GLASSLINE performance overlay. Enable with ?stats=1 or toggle with F3.

/**
 * @param {import('../../../types/engine').GameContext} game
 */
export function createPerfHud(game) {
  const params = new URLSearchParams(location.search);
  let visible = params.get('stats') === '1';
  let accumulator = 0;
  let frames = 0;
  let smoothMs = 0;

  const panel = document.createElement('div');
  panel.id = 'glassline-perf';
  panel.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:55;padding:10px 12px;' +
    'background:rgba(8,12,16,.82);border:1px solid #465258;color:#dce6e2;' +
    'font:11px/1.5 "IBM Plex Mono",monospace;letter-spacing:.04em;white-space:pre;' +
    'pointer-events:none;display:none;';
  document.body.appendChild(panel);

  function setVisible(value) {
    visible = !!value;
    panel.style.display = visible ? 'block' : 'none';
  }
  setVisible(visible);

  function update(dt) {
    if (!visible) return;
    frames += 1;
    accumulator += dt;
    smoothMs += (dt * 1000 - smoothMs) * 0.12;
    if (accumulator < 0.35) return;
    const fps = frames / accumulator;
    const stats =
      (typeof window.__stats === 'function' ? window.__stats() : null) ||
      (game.render && game.render.stats ? game.render.stats() : {});
    const resolution = stats.res || [0, 0];
    panel.textContent = [
      'GLASSLINE PERF',
      `FPS      ${fps.toFixed(1)}  (${smoothMs.toFixed(1)} ms)`,
      `QUALITY  ${String(stats.quality || game.quality?.name || '-').toUpperCase()}`,
      `CALLS    ${stats.calls ?? '-'}   TRIS ${stats.tris ?? '-'}`,
      `GEOMETRY ${stats.geos ?? '-'}   TEXTURES ${stats.tex ?? '-'}`,
      `BUFFER   ${resolution[0]}x${resolution[1]}   SCALE ${stats.scale ?? '-'}`,
      `PIPELINE ${stats.advanced ? 'HDR' : 'forward'}   SHADOWS ${stats.softShadows ? 'soft' : 'basic'}`,
      `ERRORS   ${(window.__errors || []).length}   FATAL ${window.__fatal ? 'YES' : 'no'}`,
      'F3 toggle',
    ].join('\n');
    accumulator = 0;
    frames = 0;
  }

  function onKeyDown(event) {
    if (event.code === 'F3') {
      event.preventDefault();
      setVisible(!visible);
    }
  }
  addEventListener('keydown', onKeyDown);

  return {
    update,
    setVisible,
    get visible() {
      return visible;
    },
    dispose() {
      removeEventListener('keydown', onKeyDown);
      panel.remove();
    },
  };
}
