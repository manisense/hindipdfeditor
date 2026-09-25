import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SITE_ORIGIN = 'https://hindipdfeditor.com';

function htmlPages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) htmlPages(full, out);
    else if (name === 'index.html') out.push(full);
  }
  return out;
}

/**
 * Fails the build when a published page's canonical is not its own URL, or when an
 * hreflang alternate is missing, lacks a self-reference, or does not link back.
 */
export function checkSeo(distDir) {
  const pages = new Map();
  for (const file of htmlPages(distDir)) {
    const rel = path.relative(distDir, path.dirname(file)).split(path.sep).join('/');
    if (rel === 'edit' || rel.startsWith('edit/')) continue;
    const html = readFileSync(file, 'utf8');
    const alternates = Object.fromEntries(
      [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)]
        .map((m) => [m[1], m[2]])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    pages.set(`${SITE_ORIGIN}/${rel ? `${rel}/` : ''}`, { alternates, canonical });
  }

  const problems = [];
  for (const [url, { alternates, canonical }] of pages) {
    if (canonical !== url) problems.push(`${url}: canonical is ${canonical}`);
    const targets = Object.values(alternates);
    if (targets.length === 0) continue;
    if (!targets.includes(url)) problems.push(`${url}: hreflang has no self-reference`);
    for (const target of targets) {
      const other = pages.get(target);
      if (!other) problems.push(`${url}: hreflang target ${target} is not published`);
      else if (JSON.stringify(other.alternates) !== JSON.stringify(alternates)) {
        problems.push(`${url}: hreflang set differs from ${target}`);
      }
    }
  }
  if (problems.length) throw new Error(`check-seo:\n  ${problems.join('\n  ')}`);
  console.log(`check-seo: ${pages.size} pages, canonicals and hreflang consistent`);
}
