import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import routes from "../tool-routes.json" with { type: "json" };

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const canonicalFor = (html) =>
  html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
assert.equal(new Set(routes.map((tool) => tool.path)).size, 5);
for (const route of routes) {
  const html = readFileSync(path.join(root, route.path, "index.html"), "utf8");
  assert.equal(canonicalFor(html), `https://hindipdfeditor.com${route.path}`);
  assert.ok(html.includes(`id="seo-tool-graph"`));
  assert.ok(html.includes("<h1>"));
  assert.ok(
    !html.includes("hreflang="),
    "Tools have no fictitious translated page alternates",
  );
  for (const [, asset] of html.matchAll(
    /(?:src|href)="(\/edit\/assets\/[^\"]+)"/g,
  )) {
    assert.ok(
      existsSync(path.join(root, asset)),
      `Missing built asset: ${asset}`,
    );
  }
}
for (const locale of ["/", "/hi/"]) {
  const html = readFileSync(path.join(root, locale, "index.html"), "utf8");
  assert.equal(canonicalFor(html), `https://hindipdfeditor.com${locale}`);
  assert.ok(html.includes('data-prerendered="home"'));
  assert.ok(
    html.includes("<!--$-->"),
    "SSR/client Suspense boundary must agree",
  );
  assert.ok(!html.includes("location.replace("));
  assert.ok(
    !/<link[^>]*modulepreload[^>]*(?:pdf-lib|jspdf|html2canvas)/.test(html),
    "Homepage must not eagerly preload PDF libraries",
  );
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  assert.ok(html.includes('id="seo-site-graph"'));
}
const worker = readFileSync(path.join(root, "_worker.js"), "utf8");
assert.ok(
  !worker.includes("import routes"),
  "Deploy artifact must embed the route manifest",
);
const sitemap = readFileSync(path.join(root, "sitemap.xml"), "utf8");
assert.ok(!sitemap.includes("/edit/"));
assert.ok(sitemap.includes("https://hindipdfeditor.com/hi/"));
assert.ok(existsSync(path.join(root, "404.html")));
for (const stylesheet of [
  "assets/brand-tokens.css",
  ...readFileSync(path.join(root, "index.html"), "utf8").matchAll(
    /href="(\/edit\/assets\/[^"]+\.css)"/g,
  ),
].map((entry) => (typeof entry === "string" ? entry : entry[1]))) {
  const cssPath = path.join(root, stylesheet);
  const css = readFileSync(cssPath, "utf8");
  for (const [, font] of css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) {
    const fontPath = font.startsWith("/")
      ? path.join(root, font)
      : path.resolve(path.dirname(cssPath), font);
    assert.ok(existsSync(fontPath), `Missing deployed UI font: ${font}`);
  }
}
console.log(
  "Publish artifact checks passed: root/locales, 5 tools, assets, worker, sitemap, 404.",
);
