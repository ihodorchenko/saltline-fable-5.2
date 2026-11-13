import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The source entry lives in src/ while the legacy playable single file stays
  // at the repository root until parity is proven.
  root: resolve(root, 'src'),
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
