import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkSeo } from './check-seo.mjs';

const webAppRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webAppRoot, 'dist');
const editDir = path.join(webAppRoot, 'edit');
const ssrEntry = path.join(webAppRoot, 'editor', 'dist-ssr', 'entry-server.js');

const STATIC_ENTRIES = [
  '404.html',
  '2cb0e0db8ff34e8eb3666ac4ec72525a.txt',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  '_headers',
  '_redirects',
  'assets',
  'articles',
  'privacy',
  'support',
  'terms',
  'data-safety',
  'hi',
];

/** Sets each article's sitemap <lastmod> to the dateModified in its own JSON-LD. */
function syncArticleLastmod() {
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const sitemap = readFileSync(sitemapPath, 'utf8').replace(
    /(<loc>https:\/\/hindipdfeditor\.com\/articles\/([^<]+)\/<\/loc>\s*<lastmod>)[^<]*(<\/lastmod>)/g,
    (whole, open, slug, close) => {
      const file = path.join(distDir, 'articles', slug, 'index.html');
      if (!existsSync(file)) return whole;
      const modified = readFileSync(file, 'utf8').match(/"dateModified":\s*"([^"]+)"/)?.[1];
      return modified ? `${open}${modified}${close}` : whole;
    },
  );
  writeFileSync(sitemapPath, sitemap);
}

function copyEntry(name) {
  const from = path.join(webAppRoot, name);
  if (!existsSync(from)) {
    throw new Error(`prepare-publish: missing required path ${name}`);
  }
  cpSync(from, path.join(distDir, name), { recursive: true });
}

for (const required of [path.join(editDir, 'index.html'), ssrEntry]) {
  if (!existsSync(required)) {
    throw new Error(
      `prepare-publish: ${path.relative(webAppRoot, required)} is missing. Run the editor build first (npm --prefix editor run build).`,
    );
  }
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of STATIC_ENTRIES) {
  copyEntry(entry);
}

// The editor bundle is served from /edit/assets; its index.html is only the prerender template.
cpSync(editDir, path.join(distDir, 'edit'), {
  recursive: true,
  filter: (src) => src !== path.join(editDir, 'index.html'),
});

const template = readFileSync(path.join(editDir, 'index.html'), 'utf8');
for (const marker of ['<!--app-lang-->', '<!--app-head-->', '<!--app-html-->']) {
  if (!template.includes(marker)) throw new Error(`prepare-publish: template lacks ${marker}`);
}

const { renderAllRoutes } = await import(pathToFileURL(ssrEntry).href);
for (const page of renderAllRoutes()) {
  const html = template
    .replace('<!--app-lang-->', page.lang)
    .replace('<!--app-head-->', page.head)
    .replace('<!--app-html-->', page.html);
  const outDir = path.join(distDir, page.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`prepare-publish: prerendered ${page.path} (${Buffer.byteLength(html)} bytes)`);
}

console.log(`prepare-publish: wrote ${distDir} (${statSync(path.join(distDir, 'index.html')).size} bytes at /)`);

syncArticleLastmod();
checkSeo(distDir);
