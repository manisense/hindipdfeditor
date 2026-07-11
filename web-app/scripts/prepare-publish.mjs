import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webAppRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webAppRoot, 'dist');
const editDir = path.join(webAppRoot, 'edit');

const STATIC_ENTRIES = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  '_headers',
  '_redirects',
  'assets',
  'privacy',
  'support',
  'terms',
  'data-safety',
];

function copyEntry(name) {
  const from = path.join(webAppRoot, name);
  if (!existsSync(from)) {
    throw new Error(`prepare-publish: missing required path ${name}`);
  }
  cpSync(from, path.join(distDir, name), { recursive: true });
}

if (!existsSync(editDir) || !existsSync(path.join(editDir, 'index.html'))) {
  throw new Error(
    'prepare-publish: web-app/edit/ is missing. Run the Vite editor build first (npm --prefix editor run build).',
  );
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of STATIC_ENTRIES) {
  copyEntry(entry);
}

cpSync(editDir, path.join(distDir, 'edit'), { recursive: true });

const bytes = statSync(path.join(distDir, 'index.html')).size;
console.log(`prepare-publish: wrote ${distDir} (index.html ${bytes} bytes)`);
