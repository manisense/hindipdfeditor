// The site header for static pages (guides, the guides hub, about, privacy, terms, support,
// data safety, 404). It mirrors the homepage header (`editor/src/home/Nav.tsx`): brand, a grouped
// Tools menu, page links, language switch and the editor button. Styles live in
// `assets/site-nav.css`, behaviour (open, Esc, focus, phone menu) in `assets/site-nav.js`.
//
// Info pages are hand-written HTML: `sync-site-headers.mjs` writes this header between their
// `<!-- site-header:start -->` and `<!-- site-header:end -->` markers. Articles get it from
// `article-template.mjs`.
import { readFileSync } from "node:fs";

const routes = JSON.parse(
  readFileSync(new URL("../tool-routes.json", import.meta.url), "utf8"),
);
const toolPath = (id) => {
  const route = routes.find((r) => r.id === id);
  if (!route) throw new Error("Unknown tool in site header: " + id);
  return route.path;
};

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.hindipdfeditor.app";

// Lucide icon bodies (24px grid, stroke icons), the same icons `toolCatalog.ts` uses.
const ICONS = {
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  signature:
    '<path d="m21 17-2.156-1.868A.5.5 0 0 0 18 15.5v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.545-3.991-3.97-8.5-4a1 1 0 0 0 0 5c4.153 0 4.745-11.295 5.708-13.5a2.5 2.5 0 1 1 3.31 3.284"/><path d="M3 21h18"/>',
  clipboardPen:
    '<path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M21.34 15.664a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><path d="M8 22H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  languages:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  fileType:
    '<path d="M12 22h6a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v6"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M3 16v-1.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5V16"/><path d="M6 22h2"/><path d="M7 14v8"/>',
  fileText:
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  type: '<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  split:
    '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
  layoutGrid:
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  fileArchive:
    '<path d="M13.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v11.5"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 12v-1"/><path d="M8 18v-2"/><path d="M8 7V6"/><circle cx="8" cy="20" r="2"/>',
  shieldCheck:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
};

const icon = (name, className, extra = "") =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${ICONS[name]}</svg>`;

/**
 * Every tool, grouped as on the homepage (`editor/src/home/toolCatalog.ts`, names from
 * `translations.ts`). `site-header.test.mjs` checks the ids and their order against both files.
 */
export const SITE_TOOL_GROUPS = [
  {
    id: "edit",
    en: "Edit & sign",
    hi: "एडिट और हस्ताक्षर",
    color: "#1843DD",
    tools: [
      ["edit", "pencil", "Edit Hindi PDF", "Live Devanagari shaping", "हिंदी पीडीएफ एडिट करें", "सही देवनागरी फॉन्ट और मात्राएं"],
      ["sign", "signature", "Sign PDF", "Any page, any spot", "पीडीएफ पर हस्ताक्षर", "किसी भी पेज पर, कहीं भी"],
      ["fill-form", "clipboardPen", "Fill PDF form", "Type answers in Hindi", "पीडीएफ फॉर्म भरें", "जवाब हिंदी में टाइप करें"],
    ],
  },
  {
    id: "convert",
    en: "Translate & convert",
    hi: "अनुवाद और कन्वर्ट",
    color: "#16A34A",
    tools: [
      ["translate", "languages", "Hindi ↔ English", "AI, after you approve", "हिंदी ↔ अंग्रेजी अनुवाद", "AI से, आपकी अनुमति के बाद"],
      ["pdf-to-word", "fileType", "PDF to Word", "Text, tables and pictures", "पीडीएफ से वर्ड", "टेक्स्ट, टेबल और तस्वीरें"],
      ["word-to-pdf", "fileText", "Word to PDF", "Hindi stays joined", "वर्ड से पीडीएफ", "हिंदी जुड़ी हुई रहे"],
      ["krutidev", "type", "KrutiDev to Unicode", "Old Hindi font to Word", "कृतिदेव से यूनिकोड", "पुराने फॉन्ट से वर्ड फाइल"],
    ],
  },
  {
    id: "organize",
    en: "Merge & split",
    hi: "जोड़ें और अलग करें",
    color: "#7C3AED",
    tools: [
      ["merge", "layers", "Merge PDF", "In the order you choose", "पीडीएफ जोड़ें", "अपने चुने क्रम में"],
      ["split", "split", "Split PDF", "Pick the pages you need", "पीडीएफ अलग करें", "सिर्फ जरूरी पेज निकालें"],
      ["organize", "layoutGrid", "Organize pages", "Turn, reorder, delete", "पेज व्यवस्थित करें", "घुमाएं, क्रम बदलें, हटाएं"],
    ],
  },
  {
    id: "optimize",
    en: "Compress",
    hi: "साइज कम करें",
    color: "#F0700F",
    tools: [
      ["compress", "fileArchive", "Compress PDF", "Shrink scanned files", "पीडीएफ साइज कम करें", "सरकारी पोर्टल के लिए छोटी फाइल"],
    ],
  },
];

const TOOL_COUNT = SITE_TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );

function toolGroups(hi, gridClass) {
  return `<div class="hpe-groups ${gridClass}">${SITE_TOOL_GROUPS.map(
    (g) =>
      `<div class="hpe-group"><p class="hpe-group__label"><span class="hpe-dot" style="background:${g.color}"></span>${esc(hi ? g.hi : g.en)}</p><ul>${g.tools
        .map(([id, ic, en, enSub, hiName, hiSub]) => {
          const href = toolPath(id) + (hi ? "?lang=hi" : "");
          return `<li><a class="hpe-tool" href="${href}">${icon(ic, "hpe-tool__icon", ` style="color:${g.color}"`)}<span><span class="hpe-tool__name">${esc(hi ? hiName : en)}</span><span class="hpe-tool__sub">${esc(hi ? hiSub : enSub)}</span></span></a></li>`;
        })
        .join("")}</ul></div>`,
  ).join("")}</div>`;
}

/**
 * Renders the site header.
 * @param {object} options
 * @param {"en"|"hi"} options.lang      page language; Hindi pages get Hindi labels and `?lang=hi` tool links
 * @param {"guides"|"about"|"support"|null} [options.current] the nav item to mark with `aria-current`
 * @param {string|null} [options.alternateHref] the same page in the other language; no switch when absent
 */
export function renderSiteHeader({ lang, current = null, alternateHref = null }) {
  if (lang !== "en" && lang !== "hi") throw new Error("Invalid header language");
  const hi = lang === "hi";
  const home = hi ? "/hi/" : "/";
  const links = [
    ["guides", "/articles/", hi ? "गाइड्स" : "Guides"],
    ["about", hi ? "/hi/about/" : "/about/", hi ? "हमारे बारे में" : "About"],
    ["support", hi ? "/hi/support/" : "/support/", hi ? "सहायता" : "Support"],
  ];
  const pageLink = (cls) => ([id, href, label]) =>
    `<a class="${cls}" href="${href}"${id === current ? ' aria-current="page"' : ""}>${esc(label)}</a>`;
  const playLabel = "Get Hindi PDF Editor on Google Play (opens in a new tab)";
  const editor = toolPath("edit") + (hi ? "?lang=hi" : "");

  return `<header class="hpe-header" data-site-header>
  <div class="hpe-header__bar">
    <a class="hpe-brand" href="${home}"><img src="/assets/logo-badge.png" width="32" height="32" alt="" /><span>Hindi PDF <span class="hpe-brand__accent">Editor</span></span></a>
    <nav class="hpe-nav" aria-label="${hi ? "मुख्य नेविगेशन" : "Primary navigation"}">
      <div class="hpe-tools" data-tools>
        <button class="hpe-pill hpe-tools__button" type="button" aria-expanded="false" aria-controls="hpe-tools-panel">${hi ? "सभी टूल्स" : "Tools"}${icon("chevronDown", "hpe-chevron")}</button>
        <div class="hpe-menu-panel hpe-tools__panel" id="hpe-tools-panel" data-open="false" inert>
          <div class="hpe-tools__card">
            ${toolGroups(hi, "hpe-groups--desktop")}
            <div class="hpe-tools__foot"><span>${icon("shieldCheck", "hpe-shield")}${hi ? `${TOOL_COUNT} टूल्स। ज़्यादातर ब्राउज़र में चलते हैं; AI सुविधाएं पहले अनुमति लेती हैं।` : `${TOOL_COUNT} tools. Most run in your browser; AI features ask first.`}</span><a href="${home}#how-it-works">${hi ? "कैसे काम करता है" : "How it works"}${icon("arrowRight", "hpe-arrow")}</a></div>
          </div>
        </div>
      </div>
      ${links.map(pageLink("hpe-pill hpe-pill--quiet")).join("")}
    </nav>
    <div class="hpe-actions">
      ${alternateHref ? `<a class="hpe-pill hpe-lang" href="${esc(alternateHref)}" hreflang="${hi ? "en" : "hi"}" lang="${hi ? "en" : "hi"}">${hi ? "English" : "हिन्दी"}</a>` : ""}
      <a class="hpe-pill hpe-play" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${playLabel}">${icon("play", "hpe-play__mark", ' fill="currentColor"')}${hi ? "एंड्रॉयड ऐप" : "Android app"}</a>
      <a class="hpe-cta" href="${editor}"><span class="hpe-cta__long">${hi ? "एडिटर खोलें" : "Open editor"}</span><span class="hpe-cta__short">${hi ? "एडिटर" : "Editor"}</span></a>
      <button class="hpe-menu-button" type="button" aria-expanded="false" aria-controls="hpe-mobile-menu" aria-label="Open navigation menu" data-label-open="Open navigation menu" data-label-close="Close navigation menu">${icon("menu", "hpe-menu-button__open")}${icon("x", "hpe-menu-button__close")}</button>
    </div>
  </div>
  <div class="hpe-menu-panel hpe-sheet" id="hpe-mobile-menu" data-open="false" inert>
    ${toolGroups(hi, "hpe-groups--phone")}
    <nav class="hpe-sheet__links" aria-label="${hi ? "साइट के पेज" : "Site pages"}"><a href="${home}">${hi ? "होम" : "Home"}</a>${links.map(pageLink("")).join("")}</nav>
    <a class="hpe-sheet__play" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${playLabel}">${icon("play", "hpe-play__mark", ' fill="currentColor"')}${hi ? "एंड्रॉयड ऐप डाउनलोड करें" : "Get the Android app"}${icon("arrowRight", "hpe-arrow hpe-arrow--end")}</a>
  </div>
</header>`;
}

/** The tags a page needs in its <head> for the header: its stylesheet and its script. */
export const SITE_HEADER_HEAD =
  '<link rel="stylesheet" href="/assets/site-nav.css" /><script src="/assets/site-nav.js" defer></script>';
