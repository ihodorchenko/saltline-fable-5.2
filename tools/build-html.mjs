import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dist = resolve(root, 'dist');

const ENTRY = '<script type="module" src="/game/main.js"></script>';

/**
 * Inline the bundled game script into the HTML shell and write dist/index.html.
 * @param {string} js bundled JavaScript
 * @returns {Promise<number>} bytes written
 */
export async function writeSingleFile(js) {
  const source = await readFile(resolve(root, 'src/index.html'), 'utf8');
  if (!source.includes(ENTRY)) {
    throw new Error(`build entry not found in src/index.html: ${ENTRY}`);
  }

  // A literal </script> inside the bundle would terminate the inline script tag.
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = source.replace(ENTRY, () => `<script>\n${safeJs}\n</script>`);

  await mkdir(dist, { recursive: true });
  await writeFile(resolve(dist, 'index.html'), html);
  return Buffer.byteLength(html);
}
