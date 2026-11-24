// Writes the shared site header (site-header.mjs) into the hand-written info pages.
//   node scripts/sync-site-headers.mjs          rewrite the pages
//   node scripts/sync-site-headers.mjs --check  exit 1 if any page differs (used by check-publish)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSiteHeader, SITE_HEADER_HEAD } from "./site-header.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const START = "<!-- site-header:start -->";
const END = "<!-- site-header:end -->";

const pairs = ["about", "privacy", "terms", "support", "data-safety"];
export const INFO_PAGES = [
  { file: "404.html", lang: "en", current: null, alternateHref: "/hi/" },
  ...pairs.flatMap((slug) => {
    const current = slug === "about" || slug === "support" ? slug : null;
    return [
      { file: `${slug}/index.html`, lang: "en", current, alternateHref: `/hi/${slug}/` },
      { file: `hi/${slug}/index.html`, lang: "hi", current, alternateHref: `/${slug}/` },
    ];
  }),
];

/** Returns the page HTML with the current header between the markers and its head tags present. */
export function withSiteHeader(html, page) {
  const block = `${START}\n${renderSiteHeader(page)}\n${END}`;
  let out;
  if (html.includes(START)) {
    const from = html.indexOf(START);
    const to = html.indexOf(END, from);
    if (to < 0) throw new Error(`${page.file}: header start marker without end marker`);
    out = html.slice(0, from) + block + html.slice(to + END.length);
  } else {
    const legacy = /<header class="site-header">[\s\S]*?<\/header>/;
    if (!legacy.test(html)) throw new Error(`${page.file}: no header to replace`);
    out = html.replace(legacy, block);
  }
  if (!out.includes("/assets/site-nav.css")) out = out.replace("</head>", `  ${SITE_HEADER_HEAD}\n  </head>`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const page of INFO_PAGES) {
    const file = path.join(root, page.file);
    const html = readFileSync(file, "utf8");
    const next = withSiteHeader(html, page);
    if (next === html) continue;
    stale++;
    if (check) console.error(`Site header out of date: ${page.file} (run node scripts/sync-site-headers.mjs)`);
    else writeFileSync(file, next);
  }
  if (check && stale) process.exit(1);
  console.log(check ? `Site headers current on ${INFO_PAGES.length} pages` : `Updated ${stale} of ${INFO_PAGES.length} pages`);
}
