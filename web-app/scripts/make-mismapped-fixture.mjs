// Builds mobile-app/fixtures/mismapped-tounicode-fixture.pdf: a PDF whose Hindi is drawn with an
// embedded Noto Sans Devanagari CID font that is intact, but whose ToUnicode map names the wrong
// letters, the way Word files passed through iLovePDF do (pre-base ि read as "व", letters
// swapped). /ActualText is removed so nothing but the font itself can give the right text.
// Plan B subsets drop GSUB while Word keeps it, so the subset is replaced by the full bundled
// Noto Sans Devanagari (same glyph ids: the subset keeps them), whose GSUB names the ligatures.
// The editor must read the two edited lines exactly (web ADR 0022).
//
//   node web-app/scripts/make-mismapped-fixture.mjs <plan-b-export.pdf>
//
// The input is a Plan B export (web ADR 0021) of mobile-app/fixtures/devanagari-fixture.pdf with
// its two Hindi lines replaced by MISMAPPED_FIXTURE_LINES, so the fixture holds only our own text.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../editor/package.json"));
const { PDFDocument, PDFDict, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = require("@cantoo/pdf-lib");

export const MISMAPPED_FIXTURE_LINES = [
  "सूर्य, धर्म और क्षेत्र में गुरुजी ने ज्ञान प्रकृति दिया।",
  "किताब, विद्यालय में सूर्य की रोशनी क्षितिज है।",
];

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");
const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
const utf16 = (text) => [...text].map((c) => hex4(c.charCodeAt(0))).join("");

function parseBfchar(cmap) {
  const map = new Map();
  for (const [, code, text] of cmap.matchAll(/<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]+)>/g)) {
    let value = "";
    for (let i = 0; i < text.length; i += 4) value += String.fromCharCode(parseInt(text.slice(i, i + 4), 16));
    map.set(parseInt(code, 16), value);
  }
  return map;
}

/** Names the pre-base ि glyph "व" and rotates every other single consonant to its neighbour's letter. */
function corrupt(map) {
  const consonants = [...map].filter(([, t]) => /^[क-ह]$/u.test(t)).sort((a, b) => a[0] - b[0]);
  const out = new Map(map);
  for (const [gid, text] of map) if (text === "ि") out.set(gid, "व");
  for (let i = 0; i + 1 < consonants.length; i += 2) {
    out.set(consonants[i][0], consonants[i + 1][1]);
    out.set(consonants[i + 1][0], consonants[i][1]);
  }
  return out;
}

const input = process.argv[2];
if (!input) throw new Error("usage: make-mismapped-fixture.mjs <plan-b-export.pdf>");
const doc = await PDFDocument.load(readFileSync(input), { updateMetadata: false });
const fullFont = doc.context.register(
  doc.context.flateStream(readFileSync(path.join(here, "../editor/public/fonts/NotoSansDevanagari-Variable.ttf"))),
);
let fonts = 0;
for (const [, object] of doc.context.enumerateIndirectObjects()) {
  if (!(object instanceof PDFDict) || object.get(PDFName.of("Subtype")) !== PDFName.of("Type0")) continue;
  if (!String(object.get(PDFName.of("BaseFont"))).includes("NotoSansDevanagari")) continue;
  const stream = object.lookup(PDFName.of("ToUnicode"));
  const map = parseBfchar(latin1(decodePDFRawStream(stream).decode()));
  const lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def", "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"];
  const entries = [...corrupt(map)].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < entries.length; i += 100) {
    const block = entries.slice(i, i + 100);
    lines.push(`${block.length} beginbfchar`, ...block.map(([g, t]) => `<${hex4(g)}> <${utf16(t)}>`), "endbfchar");
  }
  lines.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
  object.set(PDFName.of("ToUnicode"), doc.context.register(doc.context.flateStream(lines.join("\n"))));
  const descendant = object.lookup(PDFName.of("DescendantFonts")).lookup(0);
  descendant.lookup(PDFName.of("FontDescriptor")).set(PDFName.of("FontFile2"), fullFont);
  fonts += 1;
}
if (fonts === 0) throw new Error("no embedded Noto Sans Devanagari CID font: is the input a Plan B export?");
for (const page of doc.getPages()) {
  const contents = page.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))];
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const text = latin1(decodePDFRawStream(stream).decode()).replace(/\/ActualText\s*<[0-9A-Fa-f]*>/g, "");
    doc.context.assign(ref, doc.context.flateStream(Uint8Array.from(text, (c) => c.charCodeAt(0))));
  }
}
const output = path.join(here, "../../mobile-app/fixtures/mismapped-tounicode-fixture.pdf");
writeFileSync(output, await doc.save({ useObjectStreams: false }));
console.log(`wrote ${output} (${fonts} font(s) mis-mapped, /ActualText removed)`);
