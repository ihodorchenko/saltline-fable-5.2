import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dist, root, writeSingleFile } from './build-html.mjs';

await rm(dist, { recursive: true, force: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: [resolve(root, 'src/game/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'info',
});

const js = result.outputFiles[0];
if (!js) {
  throw new Error('esbuild produced no JavaScript output');
}

const bytes = await writeSingleFile(js.text);
console.log(`built dist/index.html (${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
