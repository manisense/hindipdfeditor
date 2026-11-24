import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderSiteHeader, SITE_TOOL_GROUPS } from "./site-header.mjs";
import { INFO_PAGES, withSiteHeader } from "./sync-site-headers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("tools match the homepage catalog, in order, with the homepage names", () => {
  const catalog = read("editor/src/home/toolCatalog.ts");
  const homepage = [...catalog.matchAll(/id: "([a-z-]+)",\s*icon: \w+,\s*nameKey: "([\w.]+)",\s*detailKey: "([\w.]+)"/g)];
  const ours = SITE_TOOL_GROUPS.flatMap((g) => g.tools);
  assert.deepEqual(ours.map((t) => t[0]), homepage.map((m) => m[1]));

  const translations = read("editor/src/home/translations.ts");
  const hiStart = translations.indexOf('"nav.howItWorks": "कैसे');
  const value = (key, hi) => {
    const re = new RegExp(`"${key.replace(".", "\\.")}": "([^"]+)"`, "g");
    const all = [...translations.matchAll(re)];
    return all.find((m) => (hi ? m.index > hiStart : m.index < hiStart))?.[1];
  };
  homepage.forEach(([, id, nameKey, detailKey], i) => {
    const [, , en, enSub, hi, hiSub] = ours[i];
    assert.deepEqual([en, enSub, hi, hiSub], [value(nameKey, false), value(detailKey, false), value(nameKey, true), value(detailKey, true)], id);
  });
});

test("every tool route is in the menu", () => {
  const routes = JSON.parse(read("tool-routes.json")).map((r) => r.id).sort();
  assert.deepEqual(SITE_TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t[0])).sort(), routes);
});

test("Hindi header is Hindi and links tools with ?lang=hi", () => {
  const hi = renderSiteHeader({ lang: "hi", current: "about", alternateHref: "/about/" });
  assert.ok(hi.includes("सभी टूल्स"));
  assert.ok(hi.includes('href="/tools/merge-pdf/?lang=hi"'));
  assert.ok(hi.includes('href="/hi/about/" aria-current="page"'));
  assert.ok(!/>(Tools|Guides|About|Support)</.test(hi));
  const en = renderSiteHeader({ lang: "en" });
  assert.ok(!en.includes("?lang=hi"));
  assert.ok(!en.includes('hreflang="hi"'), "no language switch without an alternate page");
});

test("info pages carry the current header", () => {
  for (const page of INFO_PAGES) {
    const html = read(page.file);
    assert.equal(withSiteHeader(html, page), html, `${page.file}: run node scripts/sync-site-headers.mjs`);
    assert.equal((html.match(/data-site-header/g) || []).length, 1, page.file);
  }
});
