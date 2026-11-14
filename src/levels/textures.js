// @ts-check
// Procedural surface atlas for the rooftop level. Everything is generated at
// runtime; no external image assets are loaded.

function mulberry(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Per-pixel grain amplitude (0-255 scale). High-key surfaces must read as clean
// ceramic and concrete; heavy grain reads as fabric. Guarded by textures.test.js.
export const GRAIN = { concrete: 7, concreteDark: 10, side: 6, facade: 10, roof: 6, metal: 9 };

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
  context.arc(x, y, radius, 0, Math.PI * 2);
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
function seamHighlights(context, size, step, color) {
  context.fillStyle = color;
  for (let i = 0; i <= size; i += step) {
    context.fillRect(i + 1, 0, 1, size);
    context.fillRect(0, i + 1, size, 1);
  }
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
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + (options.dark ? 91 : 7));
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, options.dark ? GRAIN.concreteDark : GRAIN.concrete);
    stain(context, size * 0.2, size * 0.16, size * 0.22, '45, 52, 52', 0.05);
    stain(context, size * 0.78, size * 0.64, size * 0.3, '70, 72, 62', 0.06);
    stain(context, size * 0.42, size * 0.94, size * 0.2, '24, 32, 34', 0.06);
    panelSeams(context, size, 128, 'rgba(42, 50, 50, .2)', 1);
    seamHighlights(context, size, 128, 'rgba(255, 255, 255, .16)');
    const texture = finish(canvas, [2, 2]);
    cache.set(key, texture);
    return texture;
  };

  const side = (hex = 0x566a72) => {
    const key = `side-${hex}`;
    if (cache.has(key)) return cache.get(key);
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + 31);
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.side, [0, 1, 1]);
    // Clean cast panels: wide seams with a soft light edge, no tie holes or cracks.
    for (let x = 0; x < size; x += 128) {
      context.fillStyle = 'rgba(16, 26, 30, .24)';
      context.fillRect(x, 0, 2, size);
      context.fillStyle = 'rgba(210, 228, 230, .12)';
      context.fillRect(x + 2, 0, 1, size);
    }
    for (let i = 0; i < 4; i += 1) {
      stain(context, random() * size, random() * size, 40 + random() * 90, '24, 38, 40', 0.05);
    }
    const texture = finish(canvas, [1, 2]);
    cache.set(key, texture);
    return texture;
  };

  const facade = (hex = 0xd8e4e4) => {
    const key = `facade-${hex}`;
    if (cache.has(key)) return cache.get(key);
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(hex + 57);
    context.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
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
        // Broad curtain-wall panes; real window bands are geometric in city.js,
        // so the texture must not bake a second, differently-scaled window grid.
        const tint = random() > 0.78 ? 'rgba(38, 73, 84, .42)' : 'rgba(164, 210, 216, .26)';
        const glass = context.createLinearGradient(x, y, x + cellW, y + cellH);
        glass.addColorStop(0, 'rgba(118, 172, 181, .34)');
        glass.addColorStop(0.52, tint);
        glass.addColorStop(1, 'rgba(50, 93, 104, .36)');
        context.fillStyle = glass;
        context.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
        context.fillStyle = 'rgba(240, 249, 248, .12)';
        context.fillRect(x + 4, y + 4, cellW - 8, 2);
      }
    }
    for (let row = 0; row <= rows; row += 1) {
      context.fillStyle = 'rgba(58, 80, 84, .34)';
      context.fillRect(0, row * cellH - 2, size, 4);
      context.fillStyle = 'rgba(248, 244, 232, .28)';
      context.fillRect(0, row * cellH, size, 1);
    }
    for (let col = 0; col <= cols; col += 1) {
      context.fillStyle = 'rgba(248, 244, 232, .3)';
      context.fillRect(col * cellW - 1, 0, 3, size);
    }
    stain(context, size * 0.2, size * 0.8, 120, '30, 45, 48', 0.08);
    const texture = finish(canvas, [1, 1]);
    cache.set(key, texture);
    return texture;
  };

  const glassFacade = () => {
    const key = 'glass-facade';
    if (cache.has(key)) return cache.get(key);
    const size = 512;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#86c6dd');
    gradient.addColorStop(0.48, '#c8eaf2');
    gradient.addColorStop(1, '#e9f8fa');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    // Broad curtain-wall bays, not a grid of tiny punched windows.
    for (let x = 0; x < size; x += 64) {
      context.fillStyle = 'rgba(255, 255, 255, .5)';
      context.fillRect(x, 0, 3, size);
      context.fillStyle = 'rgba(40, 89, 104, .16)';
      context.fillRect(x + 3, 0, 2, size);
    }
    for (let y = 0; y < size; y += 64) {
      context.fillStyle = 'rgba(255, 255, 255, .65)';
      context.fillRect(0, y, size, 4);
      context.fillStyle = 'rgba(35, 78, 93, .18)';
      context.fillRect(0, y + 4, size, 2);
    }
    // Soft reflected-sky streaks.
    for (let i = 0; i < 4; i += 1) {
      const x = 40 + i * 112;
      const streak = context.createLinearGradient(x, 0, x + 50, size);
      streak.addColorStop(0, 'rgba(255,255,255,0)');
      streak.addColorStop(0.45, 'rgba(255,255,255,.22)');
      streak.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = streak;
      context.fillRect(x, 0, 50, size);
    }
    const texture = finish(canvas, [1, 1]);
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
    addNoise(context, size, random, GRAIN.roof);
    panelSeams(context, size, 64, 'rgba(60, 67, 62, .13)', 1);
    panelSeams(context, size, 256, 'rgba(44, 52, 52, .3)', 2);
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
    const texture = finish(canvas, [1, 1]);
    cache.set(key, texture);
    return texture;
  };

  const metal = () => {
    if (cache.has('metal')) return cache.get('metal');
    const size = 256;
    const canvas = canvasOf(size);
    const context = canvas.getContext('2d');
    const random = mulberry(8221);
    context.fillStyle = '#6d7a7e';
    context.fillRect(0, 0, size, size);
    addNoise(context, size, random, GRAIN.metal, [0, 1, 2]);
    for (let x = 0; x < size; x += 3) {
      context.fillStyle = `rgba(225, 236, 234, ${0.015 + random() * 0.03})`;
      context.fillRect(x, 0, 1, size);
    }
    for (let i = 0; i < 8; i += 1) {
      stain(context, random() * size, random() * size, 8 + random() * 30, '58, 74, 80', 0.07);
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
    const size = 128;
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

  return { concrete, side, facade, glassFacade, roof, metal, asphalt, red };
}
