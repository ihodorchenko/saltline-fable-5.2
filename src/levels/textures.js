// @ts-check
// Procedural surface atlas for the rooftop level. Everything is generated at
// runtime; no external image assets are loaded.
//
// Each family is generated twice: an albedo canvas (colour, weathering, panel
// joints, stains) and a grayscale *relief* canvas (a height field of the same
// joint/pit/trowel pattern). Normal maps and roughness maps are derived from the
// relief, so micro-shading and specular breakup stay coherent with the visible
// joints instead of being independent noise. That is what stops the pale
// concrete from reading as painted plastic and lets the glass read as reflective
// bays between raised mullions.

function mulberry(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Per-pixel grain amplitude (0-255 scale). High-key surfaces must read as clean
// ceramic and concrete; heavy grain reads as fabric. Guarded by textures.test.js.
// Per-panel brightness spread (fraction of full white/ink overlay). Low-frequency
// tone breaks up flat floors without reintroducing grain. Guarded by textures.test.js.
export const TONE = { panel: 0.05 };

export const GRAIN = { concrete: 7, concreteDark: 10, side: 6, facade: 10, roof: 6, metal: 9 };

const TAU = Math.PI * 2;

function canvasOf(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function addNoise(context, size, random, amount, tint) {
  const image = context.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n + (tint?.[0] || 0)));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n + (tint?.[1] || 0)));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n + (tint?.[2] || 0)));
  }
  context.putImageData(image, 0, 0);
}

function stain(context, x, y, radius, color, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(0.45, `rgba(${color},${alpha * 0.55})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();
}

function panelSeams(context, size, step, color, width = 1) {
  context.strokeStyle = color;
  context.lineWidth = width;
  for (let i = 0; i <= size; i += step) {
    context.beginPath();
    context.moveTo(i + 0.5, 0);
    context.lineTo(i + 0.5, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i + 0.5);
    context.lineTo(size, i + 0.5);
    context.stroke();
  }
}

// Light edge on the far side of each seam so panels read as separate slabs.
function panelTones(context, size, step, random, amount) {
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const shade = (random() * 2 - 1) * amount;
      context.fillStyle = shade >= 0 ? `rgba(255, 255, 255, ${shade})` : `rgba(20, 28, 30, ${-shade})`;
      context.fillRect(x, y, step, step);
    }
  }
}

function seamHighlights(context, size, step, color) {
  context.fillStyle = color;
  for (let i = 0; i <= size; i += step) {
    context.fillRect(i + 1, 0, 1, size);
    context.fillRect(0, i + 1, size, 1);
  }
}

// ---------------------------------------------------------------------------
// Relief (height field) helpers. Values live in 0-255 grey; 128 is the neutral
// surface. `raise` blobs are highlights on the height map (brighter = raised).
// ---------------------------------------------------------------------------

function reliefCanvas(size) {
  const canvas = canvasOf(size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, size, size);
  return { canvas, context };
}

/**
 * Soft round height bump. `squash` < 1 stretches the bump along X (trowel
 * stroke), > 1 stretches it along Y (weather streak).
 * @param {CanvasRenderingContext2D} context
 * @param {number} x @param {number} y @param {number} radius
 * @param {number} alpha height shift strength (0-1)
 * @param {boolean} raise brighten (raised) or darken (dug) the height field
 * @param {number} [squash]
 */
function reliefBlob(context, x, y, radius, alpha, raise, squash = 1) {
  const color = raise ? '255,255,255' : '10,10,10';
  context.save();
  context.translate(x, y);
  context.scale(1, squash);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(0.55, `rgba(${color},${alpha * 0.45})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.restore();
}

/**
 * A linear groove (dark) with a light lip on one side: a cast-panel joint.
 * @param {CanvasRenderingContext2D} context
 * @param {{x1: number, y1: number, x2: number, y2: number, width?: number,
 *   depth?: string, lip?: number}} options
 */
function reliefSeam(context, options) {
  const { x1, y1, x2, y2, width = 3, depth = 'rgba(24,24,24,0.8)', lip = 1.4 } = options;
  context.strokeStyle = depth;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  if (lip > 0) {
    // A bright 1px edge on the +X/+Y side reads as the rounded panel arris.
    const dx = x2 === x1 ? lip : 0;
    const dy = y2 === y1 ? lip : 0;
    context.strokeStyle = 'rgba(225,225,225,0.55)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x1 + dx, y1 + dy);
    context.lineTo(x2 + dx, y2 + dy);
    context.stroke();
  }
}

/** Scatter of small pores/holes in the height field. */
function reliefPits(context, size, random, count, maxRadius, alpha) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.4 + random() * maxRadius;
    context.fillStyle = `rgba(8,8,8,${alpha * (0.35 + random() * 0.65)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }
}

/**
 * Cast-concrete relief: trowel mottling, four cast panels per tile, a heavier
 * joint at the tile edge, formwork tie holes, pores and the odd hairline crack.
 * Generated once per family and shared by every colour variant, so the same
 * panel layout underpins albedo, normals and roughness.
 * @returns {HTMLCanvasElement}
 */
function concreteRelief() {
  const size = 512;
  const { canvas, context } = reliefCanvas(size);
  const random = mulberry(1471);
  const panel = size / 4;
  // Broad trowel/wear patches: the low-frequency height variation that breaks up
  // specular on a sunlit slab. Kept shallow so it reads as skin, not blobs.
  for (let i = 0; i < 30; i += 1) {
    reliefBlob(
      context,
      random() * size,
      random() * size,
      30 + random() * 110,
      0.035 + random() * 0.045,
      random() > 0.42,
      0.5 + random() * 1.1,
    );
  }
  // Trowel strokes: short, flattened bumps crossing in loose diagonals.
  for (let i = 0; i < 80; i += 1) {
    reliefBlob(
      context,
      random() * size,
      random() * size,
      8 + random() * 26,
      0.035 + random() * 0.035,
      random() > 0.35,
      0.16 + random() * 0.26,
    );
  }
  // Cast-panel joints (4 per tile), plus the heavier tile-edge joint.
  for (let i = 1; i < 4; i += 1) {
    const line = i * panel;
    reliefSeam(context, { x1: line + 0.5, y1: 0, x2: line + 0.5, y2: size, width: 3, lip: 1.5 });
    reliefSeam(context, { x1: 0, y1: line + 0.5, x2: size, y2: line + 0.5, width: 3, lip: 1.5 });
  }
  reliefSeam(context, { x1: 2, y1: 0, x2: 2, y2: size, width: 5, depth: 'rgba(14,14,14,0.85)', lip: 2 });
  reliefSeam(context, { x1: 0, y1: 2, x2: size, y2: 2, width: 5, depth: 'rgba(14,14,14,0.85)', lip: 2 });
  // Formwork tie holes at panel intersections: the small indentations that make
  // poured concrete read as poured rather than painted.
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * panel;
      const y = row * panel;
      reliefBlob(context, x, y, 3.2, 0.55, false);
      context.fillStyle = 'rgba(235,235,235,0.35)';
      context.beginPath();
      context.arc(x + 1.4, y + 1.4, 1.1, 0, TAU);
      context.fill();
    }
  }
  // Pores and a handful of hairline cracks.
  reliefPits(context, size, random, 240, 1.0, 0.16);
  context.strokeStyle = 'rgba(20,20,20,0.22)';
  context.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    let x = random() * size;
    let y = random() * size;
    context.beginPath();
    context.moveTo(x, y);
    for (let step = 0; step < 5; step += 1) {
      x += (random() - 0.4) * 22;
      y += (random() - 0.5) * 18;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  return canvas;
}

/**
 * Cast/board-marked concrete for slab sides: vertical formwork panels with a
 * horizontal pour joint, tie holes and run-off streaks.
 * @returns {HTMLCanvasElement}
 */
function sideRelief() {
  const size = 512;
  const { canvas, context } = reliefCanvas(size);
  const random = mulberry(613);
  for (let i = 0; i < 12; i += 1) {
    reliefBlob(context, random() * size, random() * size, 50 + random() * 130, 0.04, random() > 0.5, 1.4);
  }
  for (let i = 0; i < 60; i += 1) {
    reliefBlob(context, random() * size, random() * size, 10 + random() * 30, 0.04, random() > 0.5, 0.14);
  }
  for (let i = 1; i < 4; i += 1) {
    const line = (i * size) / 4;
    reliefSeam(context, { x1: line, y1: 0, x2: line, y2: size, width: 3, lip: 1.5 });
  }
  reliefSeam(context, { x1: 0, y1: size / 2, x2: size, y2: size / 2, width: 4, lip: 2 });
  reliefSeam(context, { x1: 2, y1: 0, x2: 2, y2: size, width: 5, depth: 'rgba(14,14,14,0.8)', lip: 2 });
  reliefPits(context, size, random, 200, 1.2, 0.24);
  return canvas;
}

/**
 * Curtain-wall glass relief: four bays per tile, raised pale mullion frames and
 * recessed panel edges. The normal map derived from this is what makes the
 * facade catch the probe reflections bay by bay instead of mirroring as a sheet.
 * @returns {HTMLCanvasElement}
 */
function glassRelief() {
  const size = 512;
  const { canvas, context } = reliefCanvas(size);
  const cell = size / 4;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * cell;
      const y = row * cell;
      // Recessed pane: darker border inside each bay.
      context.fillStyle = 'rgba(20,20,20,0.35)';
      context.fillRect(x + 7, y + 7, cell - 14, cell - 14);
      // Raised frame around the recess.
      context.fillStyle = 'rgba(240,240,240,0.5)';
      context.fillRect(x + 2, y + 2, cell - 4, 4);
      context.fillRect(x + 2, y + 2, 4, cell - 4);
    }
  }
  return canvas;
}

/**
 * Backdrop facade relief: a punched window grid recessed into a plaster panel.
 * @returns {HTMLCanvasElement}
 */
function facadeRelief() {
  const size = 512;
  const { canvas, context } = reliefCanvas(size);
  const random = mulberry(9137);
  const cols = 6;
  const rows = 9;
  const cellW = size / cols;
  const cellH = size / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cellW;
      const y = row * cellH;
      context.fillStyle = 'rgba(16,16,16,0.42)';
      context.fillRect(x + 5, y + 5, cellW - 10, cellH - 10);
      context.fillStyle = 'rgba(235,235,235,0.32)';
      context.fillRect(x + 5, y + 5, cellW - 10, 2);
    }
  }
  reliefPits(context, size, random, 260, 1.4, 0.2);
  return canvas;
}

/**
 * Brushed-metal relief: streaks along U (rolled sheet direction), a couple of
 * scratches and a panel seam. Roughness derived from this gives the ducts and
 * fascias brushed variation instead of a constant plastic sheen.
 * @returns {HTMLCanvasElement}
 */
function metalRelief() {
  const size = 512;
  const { canvas, context } = reliefCanvas(size);
  const random = mulberry(8221);
  for (let i = 0; i < 900; i += 1) {
    const y = random() * size;
    const length = 30 + random() * 240;
    const x = random() * size;
    context.strokeStyle =
      random() > 0.5
        ? `rgba(255,255,255,${0.03 + random() * 0.07})`
        : `rgba(0,0,0,${0.03 + random() * 0.08})`;
    context.lineWidth = random() > 0.7 ? 1.6 : 0.8;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y + (random() - 0.5) * 0.8);
    context.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    const y = random() * size;
    context.strokeStyle = 'rgba(8,8,8,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
    context.strokeStyle = 'rgba(255,255,255,0.4)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, y + 2);
    context.lineTo(size, y + 2);
    context.stroke();
  }
  reliefSeam(context, { x1: 2, y1: 0, x2: 2, y2: size, width: 4, lip: 2 });
  reliefSeam(context, { x1: 0, y1: 2, x2: size, y2: 2, width: 4, lip: 2 });
  reliefPits(context, size, random, 120, 0.9, 0.16);
  return canvas;
}

function canvasTexture(THREE, canvas, repeat = [1, 1], colorSpace = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ---------------------------------------------------------------------------
// Derived maps: normal and roughness, generated from the family relief canvases
// so surfaces catch the sun at close range and stop reading as flat painted
// panels. The albedo canvases stay the colour source; relief is the height
// source, which keeps joints aligned with the grooves that shade them.
// ---------------------------------------------------------------------------

/**
 * Tangent-space normal map from the luminance of a square canvas (Sobel, wrapping
 * so the result stays tileable).
 * @param {HTMLCanvasElement} source
 * @param {number} [strength]
 * @param {number} [size] output resolution (normals do not need albedo resolution)
 * @returns {HTMLCanvasElement}
 */
function normalCanvas(source, strength = 2, size = 512) {
  const sourceSize = source.width;
  const src = source.getContext('2d').getImageData(0, 0, sourceSize, sourceSize).data;
  const step = sourceSize / size;
  const lum = (x, y) => {
    const sx = Math.min(sourceSize - 1, Math.max(0, Math.round(x * step)));
    const sy = Math.min(sourceSize - 1, Math.max(0, Math.round(y * step)));
    const i = (sy * sourceSize + sx) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  const canvas = canvasOf(size);
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (lum(xp, y) - lum(xm, y)) * strength;
      const dy = (lum(x, yp) - lum(x, ym)) * strength;
      const length = Math.sqrt(dx * dx + dy * dy + 1);
      const index = (y * size + x) * 4;
      data[index] = ((-dx / length) * 0.5 + 0.5) * 255;
      data[index + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      data[index + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Roughness map from the luminance of a square canvas: bright pixels become
 * rougher when `invert` is false, dark pixels rougher when `invert` is true.
 * @param {HTMLCanvasElement} source
 * @param {{base?: number, range?: number, invert?: boolean}} [options]
 * @param {number} [size]
 * @returns {HTMLCanvasElement}
 */
function roughnessCanvas(source, options = {}, size = 256) {
  const { base = 0.25, range = 0.4, invert = false } = options;
  const sourceSize = source.width;
  const src = source.getContext('2d').getImageData(0, 0, sourceSize, sourceSize).data;
  const step = sourceSize / size;
  const canvas = canvasOf(size);
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(sourceSize - 1, Math.round(x * step));
      const sy = Math.min(sourceSize - 1, Math.round(y * step));
      const i = (sy * sourceSize + sx) * 4;
      const l = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
      const value = base + (invert ? 1 - l : l) * range;
      const index = (y * size + x) * 4;
      const byte = Math.max(0, Math.min(255, value * 255));
      data[index] = byte;
      data[index + 1] = byte;
      data[index + 2] = byte;
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * @param {any} game
 */
export function createTextureFactory(game) {
  const { THREE } = game;
  const cache = new Map();
  const maxAniso = game.renderer?.capabilities?.getMaxAnisotropy?.() || 4;

  const finish = (canvas, repeat = [1, 1], colorSpace = true) => {
    const texture = canvasTexture(THREE, canvas, repeat, colorSpace);
    texture.anisotropy = Math.min(8, maxAniso);
    return texture;
  };

  const concrete = (hex, options = {}) => {
    const key = `concrete-${hex}-${options.dark ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);
    const size = 1024;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + (options.dark ? 91 : 7));
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    // Warm plaster wash: the reference concrete is warm white, not blue-white.
    context.fillStyle = 'rgba(246, 232, 210, 0.055)';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, options.dark ? GRAIN.concreteDark : GRAIN.concrete, [2, 1, -2]);
    // Large-scale weathering: broad damp/soot patches and sun-bleached areas.
    stain(context, size * 0.18, size * 0.14, size * 0.34, '58, 62, 58', 0.055);
    stain(context, size * 0.78, size * 0.62, size * 0.4, '96, 92, 78', 0.045);
    stain(context, size * 0.45, size * 0.95, size * 0.26, '24, 32, 34', 0.05);
    stain(context, size * 0.62, size * 0.22, size * 0.24, '252, 250, 242', 0.05);
    stain(context, size * 0.12, size * 0.7, size * 0.18, '252, 250, 244', 0.03);
    // Vertical run-off streaks from joints and parapets.
    for (let i = 0; i < 7; i += 1) {
      const x = random() * size;
      const width = 6 + random() * 22;
      const gradient = context.createLinearGradient(x, 0, x, size);
      const alpha = 0.025 + random() * 0.035;
      gradient.addColorStop(0, `rgba(38, 44, 42, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(38, 44, 42, ${alpha * 0.5})`);
      gradient.addColorStop(1, 'rgba(38, 44, 42, 0)');
      context.fillStyle = gradient;
      context.fillRect(x, 0, width, size);
    }
    // Cast panels on the same 4-per-tile grid as the relief, so the painted joint
    // and the normal groove sit on top of each other.
    panelTones(context, size, 256, random, TONE.panel);
    panelSeams(context, size, 256, 'rgba(40, 46, 44, 0.3)', 2);
    seamHighlights(context, size, 256, 'rgba(255, 252, 244, 0.18)');
    context.fillStyle = 'rgba(32, 38, 38, 0.4)';
    context.fillRect(0, 0, size, 4);
    context.fillRect(0, 0, 4, size);
    context.fillStyle = 'rgba(255, 252, 244, 0.22)';
    context.fillRect(4, 0, 2, size);
    context.fillRect(0, 4, size, 2);
    // Albedo pores and small patch repairs keep close-ups from going flat. Kept
    // sparse and low-contrast: dense dark specks read as sandpaper, not concrete.
    for (let i = 0; i < 220; i += 1) {
      const radius = 0.4 + random() * 1.2;
      context.fillStyle = `rgba(44, 50, 48, ${0.02 + random() * 0.035})`;
      context.beginPath();
      context.arc(random() * size, random() * size, radius, 0, TAU);
      context.fill();
    }
    for (let i = 0; i < 3; i += 1) {
      stain(context, random() * size, random() * size, 18 + random() * 34, '150, 148, 136', 0.12);
    }
    const texture = finish(canvas);
    cache.set(key, texture);
    return texture;
  };

  const side = (hex = 0x6b8092) => {
    const key = `side-${hex}`;
    if (cache.has(key)) return cache.get(key);
    const size = 1024;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + 31);
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    context.fillStyle = 'rgba(246, 232, 210, 0.05)';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.side, [2, 1, -2]);
    // Clean cast panels: wide seams with a soft light edge, plus one pour joint.
    for (let x = 0; x < size; x += 256) {
      context.fillStyle = 'rgba(16, 26, 30, 0.3)';
      context.fillRect(x, 0, 3, size);
      context.fillStyle = 'rgba(214, 228, 228, 0.24)';
      context.fillRect(x + 3, 0, 2, size);
    }
    context.fillStyle = 'rgba(16, 26, 30, 0.26)';
    context.fillRect(0, size / 2, size, 3);
    context.fillStyle = 'rgba(214, 228, 228, 0.2)';
    context.fillRect(0, size / 2 + 3, size, 2);
    // Broad tone variation between cast panels.
    for (let i = 0; i < 12; i += 1) {
      stain(
        context,
        random() * size,
        random() * size,
        40 + random() * 150,
        random() > 0.5 ? '24, 38, 40' : '250, 250, 240',
        0.04,
      );
    }
    for (let i = 0; i < 4; i += 1) {
      stain(context, random() * size, random() * size, 90 + random() * 180, '24, 38, 40', 0.045);
    }
    const texture = finish(canvas);
    cache.set(key, texture);
    return texture;
  };

  const facade = (hex = 0xd8e4e4) => {
    const key = `facade-${hex}`;
    if (cache.has(key)) return cache.get(key);
    const size = 1024;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + 57);
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    context.fillStyle = 'rgba(246, 232, 210, 0.06)';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.facade);
    const cols = 6;
    const rows = 9;
    const cellW = size / cols;
    const cellH = size / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * cellW;
        const y = row * cellH;
        // Punched windows: dark glazing with a pale sill line, not a second grid
        // of curtain-wall panes. Real window bands are geometric in city.js.
        const pane = context.createLinearGradient(x, y, x, y + cellH);
        pane.addColorStop(0, 'rgba(34, 58, 68, 0.82)');
        pane.addColorStop(0.55, 'rgba(52, 88, 100, 0.78)');
        pane.addColorStop(1, 'rgba(22, 40, 48, 0.85)');
        context.fillStyle = pane;
        context.fillRect(x + 6, y + 7, cellW - 12, cellH - 14);
        context.fillStyle = 'rgba(250, 248, 240, 0.34)';
        context.fillRect(x + 5, y + cellH - 8, cellW - 10, 3);
        context.fillStyle = 'rgba(250, 248, 240, 0.16)';
        context.fillRect(x + 6, y + 7, 2, cellH - 14);
      }
    }
    for (let row = 0; row <= rows; row += 1) {
      context.fillStyle = 'rgba(58, 60, 54, 0.24)';
      context.fillRect(0, row * cellH - 2, size, 3);
      context.fillStyle = 'rgba(250, 248, 240, 0.26)';
      context.fillRect(0, row * cellH, size, 1);
    }
    for (let col = 0; col <= cols; col += 1) {
      context.fillStyle = 'rgba(250, 248, 240, 0.2)';
      context.fillRect(col * cellW - 1, 0, 3, size);
    }
    stain(context, size * 0.2, size * 0.8, 150, '30, 45, 48', 0.07);
    stain(context, size * 0.7, size * 0.3, 120, '250, 248, 238', 0.05);
    const texture = finish(canvas);
    cache.set(key, texture);
    return texture;
  };

  const glassFacade = () => {
    const key = 'glass-facade';
    if (cache.has(key)) return cache.get(key);
    const size = 1024;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(2008);
    // Vertical tone: deep navy at street level, a lighter blue-grey where the
    // top of the tower meets the sky. This is the big value ramp the reference
    // towers get from reflected sky.
    const base = context.createLinearGradient(0, 0, 0, size);
    base.addColorStop(0, '#263947');
    base.addColorStop(0.45, '#1e2d3a');
    base.addColorStop(1, '#141d26');
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    const cols = 4;
    const rows = 4;
    const cellW = size / cols;
    const cellH = size / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * cellW;
        const y = row * cellH;
        const roll = random();
        const skew = random();
        if (roll < 0.2) {
          // Bay catching sky/neighbour: a pale blue reflected panel. These bright
          // bays next to near-black ones are most of the glass read.
          const pane = context.createLinearGradient(x, y, x + cellW * 0.4, y + cellH);
          pane.addColorStop(0, '#b9d9e6');
          pane.addColorStop(0.42, '#7fb0c6');
          pane.addColorStop(1, '#3e6474');
          context.fillStyle = pane;
          context.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
        } else if (roll < 0.42) {
          // Mid-tone panel: grey-blue with a soft diagonal falloff.
          const pane = context.createLinearGradient(x, y, x + cellW, y + cellH);
          pane.addColorStop(0, '#3b5565');
          pane.addColorStop(1, '#22323d');
          context.fillStyle = pane;
          context.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
        } else if (roll < 0.52) {
          // Interior/blackout panel.
          context.fillStyle = '#121a20';
          context.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
          for (let l = 0; l < 7; l += 1) {
            context.fillStyle = `rgba(180, 200, 206, ${0.02 + random() * 0.03})`;
            context.fillRect(x + 16, y + 22 + l * 24, cellW - 32, 2);
          }
        } else {
          // Dark reflective pane, variation per pane (0.85-1.15) so no two bays
          // are the same value.
          const factor = 0.82 + skew * 0.42;
          const pane = context.createLinearGradient(x, y, x, y + cellH);
          pane.addColorStop(
            0,
            `rgba(${Math.round(46 * factor)}, ${Math.round(66 * factor)}, ${Math.round(80 * factor)}, 1)`,
          );
          pane.addColorStop(
            1,
            `rgba(${Math.round(24 * factor)}, ${Math.round(37 * factor)}, ${Math.round(47 * factor)}, 1)`,
          );
          context.fillStyle = pane;
          context.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
          // A thin streak of a reflected skyline across some dark panes.
          if (random() < 0.3) {
            const streak = context.createLinearGradient(x + 8, y, x + cellW - 8, y + cellH);
            streak.addColorStop(0, 'rgba(170, 206, 220, 0)');
            streak.addColorStop(0.5, 'rgba(170, 206, 220, 0.24)');
            streak.addColorStop(1, 'rgba(170, 206, 220, 0)');
            context.fillStyle = streak;
            context.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
          }
        }
      }
    }
    // Pale mullion frames, the brightest thing on the facade: a 3px raised frame
    // with a dark reveal on one side. The contrast against the dark bays is what
    // makes the curtain wall read as glass.
    for (let i = 0; i <= cols; i += 1) {
      const x = i * cellW;
      context.fillStyle = 'rgba(9, 14, 18, 0.55)';
      context.fillRect(x - 4, 0, 4, size);
      context.fillStyle = 'rgba(216, 228, 231, 0.9)';
      context.fillRect(x - 2, 0, 3, size);
      context.fillStyle = 'rgba(255, 255, 255, 0.35)';
      context.fillRect(x + 1, 0, 1, size);
    }
    for (let i = 0; i <= rows; i += 1) {
      const y = i * cellH;
      context.fillStyle = 'rgba(9, 14, 18, 0.5)';
      context.fillRect(0, y - 5, size, 5);
      context.fillStyle = 'rgba(224, 234, 236, 0.85)';
      context.fillRect(0, y - 3, size, 4);
      context.fillStyle = 'rgba(255, 255, 255, 0.3)';
      context.fillRect(0, y + 1, size, 1);
    }
    // Thin spandrel band below each floor frame: the dark shadow gap between
    // floors keeps the horizontal rhythm crisp at a distance.
    for (let i = 0; i < rows; i += 1) {
      context.fillStyle = 'rgba(6, 10, 13, 0.34)';
      context.fillRect(0, i * cellH + cellH - 14, size, 5);
    }
    // Broad sky reflection gradient: brighter toward the top of every tile.
    const sheen = context.createLinearGradient(0, 0, 0, size);
    sheen.addColorStop(0, 'rgba(196, 226, 238, 0.16)');
    sheen.addColorStop(0.45, 'rgba(196, 226, 238, 0.04)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
    context.fillStyle = sheen;
    context.fillRect(0, 0, size, size);
    const texture = finish(canvas);
    cache.set(key, texture);
    return texture;
  };

  const roof = (hex = 0xe5e4d9) => {
    const key = `roof-${hex}`;
    if (cache.has(key)) return cache.get(key);
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + 11);
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    context.fillStyle = 'rgba(246, 232, 210, 0.06)';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.roof);
    panelTones(context, size, 128, random, 0.035);
    panelSeams(context, size, 64, 'rgba(60, 67, 62, .16)', 1);
    panelSeams(context, size, 256, 'rgba(44, 52, 52, .34)', 2);
    for (let i = 0; i < 6; i += 1) {
      stain(context, random() * size, random() * size, 10 + random() * 50, '52, 58, 52', 0.06);
    }
    // A few drainage grates.
    for (let i = 0; i < 4; i += 1) {
      const x = 40 + random() * (size - 80);
      const y = 40 + random() * (size - 80);
      context.fillStyle = 'rgba(36, 46, 46, .65)';
      context.fillRect(x, y, 18, 10);
      context.fillStyle = 'rgba(160, 176, 176, .35)';
      for (let k = 0; k < 4; k += 1) context.fillRect(x + 3 + k * 4, y + 2, 2, 6);
    }
    const texture = finish(canvas);
    cache.set(key, texture);
    return texture;
  };

  const metal = () => {
    if (cache.has('metal')) return cache.get('metal');
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(8221);
    context.fillStyle = '#7c8a8e';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.metal, [0, 1, 2]);
    // Rolled/brushed streaks: long pale and dark hairlines along U.
    for (let i = 0; i < 700; i += 1) {
      const y = random() * size;
      const x = random() * size;
      const length = 20 + random() * 180;
      const light = random() > 0.5;
      context.fillStyle = light
        ? `rgba(232, 242, 240, ${0.02 + random() * 0.05})`
        : `rgba(44, 58, 62, ${0.02 + random() * 0.06})`;
      context.fillRect(x, y, length, random() > 0.75 ? 1.6 : 0.8);
    }
    // Sheet-metal seams: dark groove + light fold.
    for (let i = 0; i < size; i += 256) {
      context.fillStyle = 'rgba(28, 38, 40, 0.4)';
      context.fillRect(i, 0, 2, size);
      context.fillStyle = 'rgba(226, 236, 234, 0.28)';
      context.fillRect(i + 2, 0, 1, size);
    }
    for (let i = 0; i < size; i += 256) {
      context.fillStyle = 'rgba(28, 38, 40, 0.3)';
      context.fillRect(0, i, size, 2);
    }
    for (let i = 0; i < 10; i += 1) {
      stain(context, random() * size, random() * size, 8 + random() * 34, '58, 74, 80', 0.08);
    }
    const texture = finish(canvas, [2, 2]);
    cache.set('metal', texture);
    return texture;
  };

  const asphalt = () => {
    if (cache.has('asphalt')) return cache.get('asphalt');
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(992);
    context.fillStyle = '#27363a';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, 30, [0, 1, 1]);
    for (let i = 0; i < 40; i += 1) {
      stain(context, random() * size, random() * size, 6 + random() * 28, '12, 20, 22', 0.12);
    }
    // Street grid and faint lane paint.
    context.strokeStyle = 'rgba(206, 218, 215, .18)';
    context.lineWidth = 2;
    for (let i = 0; i < size; i += 128) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, size);
      context.stroke();
      context.beginPath();
      context.moveTo(0, i);
      context.lineTo(size, i);
      context.stroke();
    }
    context.setLineDash([22, 20]);
    context.strokeStyle = 'rgba(228, 198, 132, .22)';
    for (let i = 64; i < size; i += 128) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, size);
      context.stroke();
    }
    context.setLineDash([]);
    const texture = finish(canvas, [5, 7]);
    cache.set('asphalt', texture);
    return texture;
  };

  const red = () => {
    if (cache.has('red')) return cache.get('red');
    const size = 256;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(32);
    context.fillStyle = '#b51f2a';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, 18, [8, 0, 0]);
    for (let i = 0; i < 12; i += 1) {
      context.fillStyle = `rgba(255, 180, 160, ${random() * 0.08})`;
      context.fillRect(random() * size, 0, 1, size);
    }
    const texture = finish(canvas, [2, 8]);
    cache.set('red', texture);
    return texture;
  };

  // ---- relief canvases -----------------------------------------------------
  // One height field per family, generated lazily and shared across colour
  // variants: the same panel layout drives albedo joints, normal grooves and
  // roughness patches, so the detail reads as one surface.
  const reliefCache = new Map();
  /** @param {string} key @param {() => HTMLCanvasElement} build */
  const reliefFor = (key, build) => {
    if (!reliefCache.has(key)) reliefCache.set(key, build());
    return reliefCache.get(key);
  };

  const normalCache = new Map();
  const roughnessCache = new Map();
  const bundleCache = new Map();
  const tiledCache = new Map();

  /**
   * Textures are shared per bundle, but different consumers need different tiling
   * (world-space UV slabs vs. instanced unit boxes). Clone on demand so each
   * repeat variant keeps its own wrap settings without re-rendering the canvas.
   * @param {any} texture
   * @param {[number, number]} [repeat]
   */
  const tiled = (texture, repeat) => {
    if (!repeat || (repeat[0] === 1 && repeat[1] === 1)) return texture;
    const key = `${texture.uuid}:${repeat[0]}x${repeat[1]}`;
    if (!tiledCache.has(key)) {
      const clone = texture.clone();
      clone.repeat.set(repeat[0], repeat[1]);
      clone.needsUpdate = true;
      tiledCache.set(key, clone);
    }
    return tiledCache.get(key);
  };

  /**
   * @param {string} key
   * @param {HTMLCanvasElement} canvas
   * @param {number} strength
   * @param {number} [size]
   */
  const normalFor = (key, canvas, strength, size = 512) => {
    if (!normalCache.has(key)) {
      const texture = canvasTexture(THREE, normalCanvas(canvas, strength, size), [1, 1], false);
      texture.anisotropy = Math.min(8, maxAniso);
      normalCache.set(key, texture);
    }
    return normalCache.get(key);
  };

  /**
   * @param {string} key
   * @param {HTMLCanvasElement} canvas
   * @param {{base?: number, range?: number, invert?: boolean}} options
   */
  const roughnessFor = (key, canvas, options) => {
    if (!roughnessCache.has(key)) {
      const texture = canvasTexture(THREE, roughnessCanvas(canvas, options), [1, 1], false);
      texture.anisotropy = Math.min(8, maxAniso);
      roughnessCache.set(key, texture);
    }
    return roughnessCache.get(key);
  };

  /**
   * @param {string} key
   * @param {() => any} build
   */
  const bundle = (key, build) => {
    if (!bundleCache.has(key)) bundleCache.set(key, build());
    return bundleCache.get(key);
  };

  /**
   * @param {number} hex @param {{dark?: boolean, repeat?: [number, number]}} [options]
   */
  const concreteMaps = (hex, options = {}) => {
    const repeat = options.repeat || [1, 1];
    return bundle(`concrete-maps-${hex}-${options.dark ? 1 : 0}-${repeat[0]}x${repeat[1]}`, () => {
      const map = concrete(hex, options);
      const relief = reliefFor('concrete', concreteRelief);
      return {
        map: tiled(map, repeat),
        normalMap: tiled(normalFor('concrete', relief, 3.1), repeat),
        roughnessMap: tiled(
          roughnessFor('concrete', relief, { base: 0.79, range: 0.16, invert: true }),
          repeat,
        ),
      };
    });
  };

  /** @param {number} [hex] @param {{repeat?: [number, number]}} [options] */
  const sideMaps = (hex = 0x566a72, options = {}) => {
    const repeat = options.repeat || [1, 2];
    return bundle(`side-maps-${hex}-${repeat[0]}x${repeat[1]}`, () => {
      const map = side(hex);
      const relief = reliefFor('side', sideRelief);
      return {
        map: tiled(map, repeat),
        normalMap: tiled(normalFor('side', relief, 2.6), repeat),
        roughnessMap: tiled(roughnessFor('side', relief, { base: 0.8, range: 0.14, invert: true }), repeat),
      };
    });
  };

  /** @param {number} [hex] @param {{repeat?: [number, number]}} [options] */
  const facadeMaps = (hex = 0xd8e4e4, options = {}) => {
    const repeat = options.repeat || [1, 1];
    return bundle(`facade-maps-${hex}-${repeat[0]}x${repeat[1]}`, () => {
      const map = facade(hex);
      const relief = reliefFor('facade', facadeRelief);
      return {
        map: tiled(map, repeat),
        normalMap: tiled(normalFor('facade', relief, 2.4), repeat),
        roughnessMap: tiled(roughnessFor('facade', relief, { base: 0.82, range: 0.1, invert: true }), repeat),
      };
    });
  };

  /** @param {{repeat?: [number, number]}} [options] */
  const glassMaps = (options = {}) => {
    const repeat = options.repeat || [1, 1];
    return bundle(`glass-maps-${repeat[0]}x${repeat[1]}`, () => {
      const map = glassFacade();
      const relief = reliefFor('glass', glassRelief);
      return {
        map: tiled(map, repeat),
        normalMap: tiled(normalFor('glass', relief, 3.4), repeat),
        // Roughness follows the relief, not the albedo: the raised mullion frames
        // are the rough part, every recessed pane stays mirror-smooth so the scene
        // probe reflects crisply out of the bays.
        roughnessMap: tiled(roughnessFor('glass', relief, { base: 0.06, range: 0.3 }), repeat),
      };
    });
  };

  /** @param {{repeat?: [number, number]}} [options] */
  const metalMaps = (options = {}) => {
    const repeat = options.repeat || [2, 2];
    return bundle(`metal-maps-${repeat[0]}x${repeat[1]}`, () => {
      const map = metal();
      const relief = reliefFor('metal', metalRelief);
      return {
        map: tiled(map, repeat),
        normalMap: tiled(normalFor('metal', relief, 2.2), repeat),
        roughnessMap: tiled(roughnessFor('metal', relief, { base: 0.26, range: 0.42, invert: true }), repeat),
      };
    });
  };

  const redMaps = () =>
    bundle('red-maps', () => {
      const map = red();
      return {
        map,
        normalMap: normalFor('red', map.image, 1.6),
        roughnessMap: roughnessFor('red', map.image, { base: 0.42, range: 0.2 }),
      };
    });

  return {
    concrete,
    concreteMaps,
    side,
    sideMaps,
    facade,
    facadeMaps,
    glassFacade,
    glassMaps,
    roof,
    metal,
    metalMaps,
    asphalt,
    red,
    redMaps,
  };
}
