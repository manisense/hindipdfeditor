// Submits every URL in sitemap.xml to IndexNow (Bing, Yandex, Seznam, Naver share submissions).
// Run after a deploy that adds or changes pages: `node web-app/scripts/indexnow.mjs`.
// The key is public by design: it must also be served at https://hindipdfeditor.com/<key>.txt.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'hindipdfeditor.com';
const KEY = '2cb0e0db8ff34e8eb3666ac4ec72525a';
const webAppRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sitemap = readFileSync(path.join(webAppRoot, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
// 200 = accepted, 202 = accepted but key not yet verified; anything else is an error.
console.log(`IndexNow: submitted ${urlList.length} URLs -> HTTP ${response.status}`);
if (!response.ok) {
  console.error(await response.text());
  process.exitCode = 1;
}
