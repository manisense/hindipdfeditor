import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderArticle, renderArticlesHub } from "./article-template.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articles = JSON.parse(
  readFileSync(path.join(root, "scripts/seo-keyword-queue.json"), "utf8"),
).filter((a) => a.status === "published");
assert.equal(new Set(articles.map((a) => a.slug)).size, articles.length);
for (const a of articles) {
  const html = readFileSync(
    path.join(root, "articles", a.slug, "index.html"),
    "utf8",
  );
  assert.equal(
    html,
    renderArticle(a, articles),
    "Generated article drift: " + a.slug,
  );
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.ok(!html.includes('href="/edit/'));
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), "Emoji in article UI");
  for (const slug of a.relatedSlugs || [])
    assert.ok(
      articles.some((a) => a.slug === slug),
      "Missing related guide",
    );
  if (a.alternateSlug) {
    const other = articles.find((x) => x.slug === a.alternateSlug);
    assert.equal(other?.alternateSlug, a.slug);
    assert.notEqual(other.language, a.language);
  }
  for (const [, href] of html.matchAll(/href="(\/[^"#?]+)"/g)) {
    if (href.startsWith("/tools/") || href === "/" || href === "/hi/") continue;
    const target = path.join(
      root,
      href,
      href.endsWith("/") ? "index.html" : "",
    );
    assert.ok(existsSync(target), "Missing article link " + href);
  }
}
assert.equal(
  readFileSync(path.join(root, "articles/index.html"), "utf8"),
  renderArticlesHub(articles),
);
console.log(
  "Content checks passed: " +
    articles.length +
    " guides, source/output parity, canonicals, language pairs and links.",
);
