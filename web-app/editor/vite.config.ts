import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const siteAssetsDir = path.resolve(rootDir, '../assets');

/** Serves `web-app/assets` at `/assets/*` during `vite` so hub images resolve like production. */
function serveSiteAssets(): Plugin {
  return {
    name: 'serve-site-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/assets/')) {
          next();
          return;
        }
        const rel = decodeURIComponent(req.url.slice('/assets/'.length).split('?')[0] ?? '');
        const file = path.resolve(siteAssetsDir, rel);
        if (!file.startsWith(siteAssetsDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader('Content-Type', guessType(file));
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

function guessType(file: string): string {
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.js')) return 'application/javascript';
  if (file.endsWith('.css')) return 'text/css';
  return 'application/octet-stream';
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveSiteAssets()],
  base: '/edit/',
  build: {
    outDir: '../edit',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/@huggingface/transformers') ||
            id.includes('node_modules/onnxruntime-web')
          ) {
            return 'transformers';
          }
        },
      },
    },
  },
  // Transformers.js pulls ONNX Runtime WASM at runtime; keep it out of Vite pre-bundling.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: ['src/test/setupCanvas.ts'],
  },
});
