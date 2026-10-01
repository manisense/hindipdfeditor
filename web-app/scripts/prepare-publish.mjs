import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import routes from "../tool-routes.json" with { type: "json" };

const webAppRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(webAppRoot, "dist");
const editDir = path.join(webAppRoot, "edit");

const STATIC_ENTRIES = [
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  "SEO_GEO_AEO_PLAYBOOK.md",
  "_headers",
  "_redirects",
  "assets",
  "articles",
  "privacy",
  "support",
  "terms",
  "data-safety",
  "hi",
  "about",
  "2cb0e0db8ff34e8eb3666ac4ec72525a.txt",
];

function copyEntry(name) {
  const from = path.join(webAppRoot, name);
  if (!existsSync(from)) {
    throw new Error(`prepare-publish: missing required path ${name}`);
  }
  cpSync(from, path.join(distDir, name), { recursive: true });
}

if (!existsSync(editDir) || !existsSync(path.join(editDir, "index.html"))) {
  throw new Error(
    "prepare-publish: web-app/edit/ is missing. Run the Vite editor build first (npm --prefix editor run build).",
  );
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of STATIC_ENTRIES) {
  copyEntry(entry);
}

cpSync(editDir, path.join(distDir, "edit"), { recursive: true });

// Keep asset URLs under /edit/assets while publishing task-specific entry documents.
const editorHtml = readFileSync(path.join(editDir, "index.html"), "utf8");
const { renderHome, seoForHome, siteGraphJsonLd } =
  await import("../editor/.prerender/prerender.js");
for (const language of ["en", "hi"]) {
  const canonical = `https://hindipdfeditor.com${language === "hi" ? "/hi/" : "/"}`;
  const directory = language === "hi" ? path.join(distDir, "hi") : distDir;
  mkdirSync(directory, { recursive: true });
  const metadata = seoForHome(language);
  const html = editorHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${metadata.title}</title>`)
    .replace(
      /<meta\s+(?:name|property)="(description|og:description|twitter:description)"[\s\S]*?\/>/g,
      (_, key) =>
        `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${metadata.description}" />`,
    )
    .replace(
      /<meta\s+(?:name|property)="(og:title|twitter:title)"[\s\S]*?\/>/g,
      (_, key) =>
        `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${metadata.title}" />`,
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${canonical}" />`,
    )
    .replace(
      /<meta property="og:locale"[^>]*>/,
      `<meta property="og:locale" content="${language === "hi" ? "hi_IN" : "en_IN"}" />`,
    )
    .replace(
      "</head>",
      `<script type="application/ld+json" id="seo-site-graph">${JSON.stringify(siteGraphJsonLd(language)).replace(/</g, "\\u003c")}</script></head>`,
    )
    .replace('<html lang="en">', `<html lang="${language}">`)
    .replace(/<link[^>]*rel="alternate"[^>]*>/g, "")
    .replace(
      /<link[^>]*rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${canonical}" /><link rel="alternate" hreflang="en" href="https://hindipdfeditor.com/" /><link rel="alternate" hreflang="hi" href="https://hindipdfeditor.com/hi/" /><link rel="alternate" hreflang="x-default" href="https://hindipdfeditor.com/" />`,
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-prerendered="home">${renderHome(language)}</div>`,
    );
  writeFileSync(path.join(directory, "index.html"), html);
}
const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
for (const tool of routes) {
  const url = `https://hindipdfeditor.com${tool.path}`;
  const title = `${tool.title} | Hindi PDF Editor`;
  const graph = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#app`,
    name: tool.title,
    url,
    description: tool.description,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
  };
  const html = editorHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link[^>]*rel="alternate"[^>]*>/g, "")
    .replace(
      /<link[^>]*rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta\s+(?:name|property)="(description|og:description|twitter:description)"[\s\S]*?\/>/g,
      (_, key) =>
        `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHtml(tool.description)}" />`,
    )
    .replace(
      /<meta\s+(?:name|property)="(og:title|twitter:title)"[\s\S]*?\/>/g,
      (_, key) =>
        `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHtml(title)}" />`,
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${url}" />`,
    )
    .replace(
      /<\/head>/,
      `<script type="application/ld+json" id="seo-tool-graph">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script></head>`,
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main class="tool-entry"><h1>${escapeHtml(tool.title)}</h1><p>${escapeHtml(tool.description)}</p><p>Loading the PDF tool…</p><noscript>Enable JavaScript to open and process PDFs on your device.</noscript><a href="/">All Hindi PDF tools</a> · <a href="/privacy/">Privacy details</a></main></div>`,
    );
  const directory = path.join(distDir, tool.path);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "index.html"), html);
}

// Advanced-mode Pages worker handles only the retired landing/query URLs.
const worker = readFileSync(
  path.join(webAppRoot, "scripts/migration-worker.mjs"),
  "utf8",
).replace(
  /import routes from ["']\.\.\/tool-routes\.json["'] with \{ type: ["']json["'] \};/,
  `const routes = ${JSON.stringify(routes)};`,
);
writeFileSync(path.join(distDir, "_worker.js"), worker);
writeFileSync(
  path.join(distDir, "_routes.json"),
  JSON.stringify(
    {
      version: 1,
      include: [
        "/",
        "/edit",
        "/edit/",
        "/edit/index.html",
        ...routes.flatMap((route) => [
          route.path.replace("/tools", ""),
          "/hi" + route.path.replace("/tools", ""),
        ]),
      ],
      exclude: [],
    },
    null,
    2,
  ),
);
writeFileSync(
  path.join(distDir, "404.html"),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found | Hindi PDF Editor</title><main><h1>Page not found</h1><p>This link may be outdated.</p><a href="/">Open Hindi PDF Editor</a></main></html>',
);

// Replace retired tool entries while retaining the public article/legal inventory.
const sitemapPath = path.join(distDir, "sitemap.xml");
let sitemap = readFileSync(sitemapPath, "utf8").replace(
  /\s*<url>\s*<loc>https:\/\/hindipdfeditor\.com\/(?:edit\/[^<]*|llms(?:-full)?\.txt)<\/loc>[\s\S]*?<\/url>/g,
  "",
);
sitemap = sitemap.replace(
  "</urlset>",
  `${routes.map((tool) => `  <url><loc>https://hindipdfeditor.com${tool.path}</loc></url>`).join("\n")}\n</urlset>`,
);
writeFileSync(sitemapPath, sitemap);

if (!sitemap.includes("https://hindipdfeditor.com/hi/")) {
  writeFileSync(
    sitemapPath,
    readFileSync(sitemapPath, "utf8").replace(
      "</urlset>",
      "<url><loc>https://hindipdfeditor.com/hi/</loc></url></urlset>",
    ),
  );
}
const bytes = statSync(path.join(distDir, "index.html")).size;
console.log(`prepare-publish: wrote ${distDir} (index.html ${bytes} bytes)`);
