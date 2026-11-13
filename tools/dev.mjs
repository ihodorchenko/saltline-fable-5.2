import { context } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dist, root, writeSingleFile } from './build-html.mjs';

const PORT = Number(process.env.PORT || 5173);

await mkdir(dist, { recursive: true });

/**
 * Rebuild dist/index.html after each esbuild rebuild. There is no HMR yet:
 * the browser needs a manual reload.
 */
const inlineHtmlPlugin = {
  name: 'inline-html',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return;
      try {
        const js = await readFile(resolve(dist, 'game.js'), 'utf8');
        const bytes = await writeSingleFile(js);
        console.log(`[dev] dist/index.html (${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
      } catch (error) {
        console.error('[dev] failed to write dist/index.html:', error);
      }
    });
  },
};

const ctx = await context({
  absWorkingDir: root,
  entryPoints: [resolve(root, 'src/game/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: resolve(dist, 'game.js'),
  logLevel: 'info',
  plugins: [inlineHtmlPlugin],
});

await ctx.watch();

const server = await ctx.serve({
  host: '127.0.0.1',
  port: PORT,
  servedir: dist,
});

console.log(`[dev] http://127.0.0.1:${server.port}/ (reload the browser after changes)`);

const stop = async () => {
  await ctx.dispose();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
