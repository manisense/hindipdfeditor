// Generates our own 3-page two-column PDF fixture and its ground-truth reading-order text:
//   mobile-app/fixtures/two-column-structure-fixture.pdf
//   mobile-app/fixtures/two-column-structure-truth.txt
//
// Features covered:
// - 3 A4 pages with a running header (top 12%) and running footer with page numbers (bottom 12%)
// - Two columns (x = 50..275 and x = 320..545, 45 pt gutter) on every page
// - Full-width title above columns on page 1; full-width ruled table and unique closing note below
//   columns on page 3
// - At least one Hindi paragraph per page taken from mobile-app/fixtures/devanagari-fixture.pdf,
//   shaped via HarfBuzz with bundled Noto Sans Devanagari (Type0/CIDFontType2/Identity-H +
//   ToUnicode + /ActualText; never pdf-lib string drawText() for Devanagari)
//
//   node web-app/scripts/make-two-column-fixture.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const editorDir = path.join(here, "../editor");
const fixturesDir = path.join(here, "../../mobile-app/fixtures");
const require = createRequire(path.join(editorDir, "package.json"));
const {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  StandardFonts,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setFillingRgbColor,
  setFontAndSize,
  setTextMatrix,
} = require("@cantoo/pdf-lib");

const NOTO_PATH = path.join(editorDir, "public/fonts/NotoSansDevanagari-Variable.ttf");
const HB_WASM_PATH = path.join(editorDir, "node_modules/harfbuzzjs/dist/harfbuzz.wasm");
const DEVANAGARI_FIXTURE_PATH = path.join(fixturesDir, "devanagari-fixture.pdf");
const NL = String.fromCharCode(10);

export const RUNNING_HEADER = "Regional Engineering Bulletin - Quarterly Issue 2026";
export const RUNNING_FOOTER_FOR_PAGE = (pageNum, total) =>
  `Internal Circulation Copy - Page ${pageNum} of ${total}`;

function hex4(n) {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function encodeUtf16Be(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) out += hex4(text.charCodeAt(i));
  return out;
}

function unpackSfnt(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4, false);
  const tables = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const base = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(base),
      view.getUint8(base + 1),
      view.getUint8(base + 2),
      view.getUint8(base + 3),
    );
    const offset = view.getUint32(base + 8, false);
    const length = view.getUint32(base + 12, false);
    tables.set(tag, bytes.slice(offset, offset + length));
  }
  return tables;
}

function packSfnt(tablesMap) {
  const entries = [...tablesMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const numTables = entries.length;
  const headerSize = 12 + numTables * 16;
  let totalSize = headerSize;
  for (const [, b] of entries) totalSize += (b.byteLength + 3) & ~3;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000, false);
  view.setUint16(4, numTables, false);
  const searchRange = 1 << (Math.floor(Math.log2(numTables)) + 4);
  view.setUint16(6, searchRange, false);
  view.setUint16(8, Math.floor(Math.log2(numTables)), false);
  view.setUint16(10, numTables * 16 - searchRange, false);

  let dataOffset = headerSize;
  for (let i = 0; i < numTables; i += 1) {
    const [tag, b] = entries[i];
    const dirBase = 12 + i * 16;
    for (let k = 0; k < 4; k += 1) out[dirBase + k] = tag.charCodeAt(k);
    view.setUint32(dirBase + 4, 0, false);
    view.setUint32(dirBase + 8, dataOffset, false);
    view.setUint32(dirBase + 12, b.byteLength, false);
    out.set(b, dataOffset);
    dataOffset += (b.byteLength + 3) & ~3;
  }
  return out;
}

function collectCompositeComponents(glyf, getOffset, gid, keep) {
  const start = getOffset(gid);
  const end = getOffset(gid + 1);
  if (end - start < 10) return;
  const view = new DataView(glyf.buffer, glyf.byteOffset, glyf.byteLength);
  const contours = view.getInt16(start, false);
  if (contours >= 0) return;
  let pos = start + 10;
  while (pos + 4 <= end) {
    const flags = view.getUint16(pos, false);
    const compGid = view.getUint16(pos + 2, false);
    pos += 4;
    if (!keep.has(compGid)) {
      keep.add(compGid);
      collectCompositeComponents(glyf, getOffset, compGid, keep);
    }
    pos += flags & 0x0001 ? 4 : 2;
    if (flags & 0x0008) pos += 2;
    else if (flags & 0x0040) pos += 4;
    else if (flags & 0x0080) pos += 8;
    if (!(flags & 0x0020)) break;
  }
}

function subsetOutlinesPreservingGsub(fontBytes, seedGids) {
  const tables = unpackSfnt(fontBytes);
  const head = tables.get("head");
  const maxp = tables.get("maxp");
  const loca = tables.get("loca");
  const glyf = tables.get("glyf");
  const headView = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const indexToLocFormat = headView.getInt16(50, false);
  const numGlyphs = new DataView(maxp.buffer, maxp.byteOffset, maxp.byteLength).getUint16(4, false);
  const locaView = new DataView(loca.buffer, loca.byteOffset, loca.byteLength);
  const getOffset = (g) =>
    indexToLocFormat === 0 ? locaView.getUint16(g * 2, false) * 2 : locaView.getUint32(g * 4, false);

  const keep = new Set([0, ...seedGids]);
  for (const g of [...keep]) collectCompositeComponents(glyf, getOffset, g, keep);

  const parts = [];
  const offsets = new Uint32Array(numGlyphs + 1);
  let cursor = 0;
  for (let g = 0; g < numGlyphs; g += 1) {
    offsets[g] = cursor;
    if (!keep.has(g)) continue;
    const s = getOffset(g);
    const e = getOffset(g + 1);
    const slice = glyf.slice(s, e);
    const padded = new Uint8Array((slice.byteLength + 3) & ~3);
    padded.set(slice);
    parts.push(padded);
    cursor += padded.byteLength;
  }
  offsets[numGlyphs] = cursor;

  const newGlyf = new Uint8Array(cursor);
  let p = 0;
  for (const part of parts) {
    newGlyf.set(part, p);
    p += part.byteLength;
  }
  const newLoca = new Uint8Array((numGlyphs + 1) * 4);
  const newLocaView = new DataView(newLoca.buffer);
  for (let g = 0; g <= numGlyphs; g += 1) newLocaView.setUint32(g * 4, offsets[g], false);
  const newHead = head.slice();
  new DataView(newHead.buffer).setInt16(50, 1, false);
  tables.set("head", newHead);
  tables.set("glyf", newGlyf);
  tables.set("loca", newLoca);
  return packSfnt(tables);
}

function readHmtxAdvances(fontBytes) {
  const tables = unpackSfnt(fontBytes);
  const numHMetrics = new DataView(tables.get("hhea").buffer).getUint16(34, false);
  const numGlyphs = new DataView(tables.get("maxp").buffer).getUint16(4, false);
  const hmtx = new DataView(tables.get("hmtx").buffer);
  const advances = new Uint16Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < Math.min(numHMetrics, numGlyphs); g += 1) {
    last = hmtx.getUint16(g * 4, false);
    advances[g] = last;
  }
  for (let g = numHMetrics; g < numGlyphs; g += 1) advances[g] = last;
  return advances;
}

async function createDevanagariShaper(fontBytes) {
  let mem = null;
  const wasmBytes = readFileSync(HB_WASM_PATH);
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    wasi_snapshot_preview1: { proc_exit(c) { throw new Error("exit " + c); } },
    env: {
      _emscripten_runtime_keepalive_clear() {},
      _abort_js() { throw new Error("abort"); },
      _setitimer_js() { return 0; },
      emscripten_resize_heap(req) {
        if (!mem) return 0;
        const cur = mem.buffer.byteLength;
        if (req <= cur) return 1;
        mem.grow(Math.ceil((req - cur) / 65536));
        return 1;
      },
    },
  });
  const ex = instance.exports;
  mem = ex.memory;
  const allocAscii = (s) => {
    const p = ex.malloc(s.length + 1);
    const u8 = new Uint8Array(ex.memory.buffer);
    for (let i = 0; i < s.length; i += 1) u8[p + i] = s.charCodeAt(i);
    u8[p + s.length] = 0;
    return p;
  };

  const fontPtr = ex.malloc(fontBytes.byteLength);
  new Uint8Array(ex.memory.buffer).set(fontBytes, fontPtr);
  const blob = ex.hb_blob_create(fontPtr, fontBytes.byteLength, 2, 0, 0);
  const face = ex.hb_face_create(blob, 0);
  const upem = ex.hb_face_get_upem(face);
  const font = ex.hb_font_create(face);
  ex.hb_font_set_scale(font, upem, upem);

  const nominal = new Map();
  const outPtr = ex.malloc(4);
  for (let cp = 0x20; cp <= 0x7e; cp += 1) {
    if (ex.hb_font_get_nominal_glyph(font, cp, outPtr)) {
      nominal.set(new DataView(ex.memory.buffer).getUint32(outPtr, true), String.fromCodePoint(cp));
    }
  }
  for (let cp = 0x0900; cp <= 0x097f; cp += 1) {
    if (ex.hb_font_get_nominal_glyph(font, cp, outPtr)) {
      nominal.set(new DataView(ex.memory.buffer).getUint32(outPtr, true), String.fromCodePoint(cp));
    }
  }
  ex.free(outPtr);

  const scriptPtr = allocAscii("Deva");
  const langPtr = allocAscii("hi");
  const scriptTag = ex.hb_script_from_string(scriptPtr, 4);
  const langTag = ex.hb_language_from_string(langPtr, 2);

  function shape(text) {
    const buf = ex.hb_buffer_create();
    const textPtr = ex.malloc(text.length * 2);
    const u16 = new Uint16Array(ex.memory.buffer, textPtr, text.length);
    for (let i = 0; i < text.length; i += 1) u16[i] = text.charCodeAt(i);
    ex.hb_buffer_add_utf16(buf, textPtr, text.length, 0, text.length);
    ex.hb_buffer_set_direction(buf, 4);
    ex.hb_buffer_set_script(buf, scriptTag);
    ex.hb_buffer_set_language(buf, langTag);
    ex.hb_buffer_set_cluster_level(buf, 0);
    ex.hb_shape(font, buf, 0, 0);

    const len = ex.hb_buffer_get_length(buf);
    const infos = ex.hb_buffer_get_glyph_infos(buf, 0);
    const posPtr = ex.hb_buffer_get_glyph_positions(buf, 0);
    const view = new DataView(ex.memory.buffer);
    const glyphs = [];
    for (let i = 0; i < len; i += 1) {
      glyphs.push({
        gid: view.getUint32(infos + i * 20, true),
        cluster: view.getUint32(infos + i * 20 + 8, true),
        xAdvance: view.getInt32(posPtr + i * 20, true),
        xOffset: view.getInt32(posPtr + i * 20 + 8, true),
      });
    }
    ex.free(textPtr);
    ex.hb_buffer_destroy(buf);
    return glyphs;
  }

  function destroy() {
    ex.free(langPtr);
    ex.free(scriptPtr);
    ex.hb_font_destroy(font);
    ex.hb_face_destroy(face);
    ex.hb_blob_destroy(blob);
    ex.free(fontPtr);
  }

  return { upem, nominal, shape, destroy };
}

/** Reads the two canonical Devanagari sentences from mobile-app/fixtures/devanagari-fixture.pdf. */
function readHindiSentencesFromFixture() {
  const extracted = execFileSync("pdftotext", [DEVANAGARI_FIXTURE_PATH, "-"], { encoding: "utf8" })
    .normalize("NFC");
  const sentences = extracted
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^[\u0900-\u097F].*।$/u.test(line));
  if (sentences.length < 2) {
    throw new Error(`Expected two Devanagari sentences in devanagari-fixture.pdf, got: ${JSON.stringify(sentences)}`);
  }
  return sentences.slice(0, 2);
}

/** Word-wraps Latin text to fit maxWidthPt using the embedded pdf-lib font metrics. */
function wrapLatin(text, font, size, maxWidthPt) {
  const words = text.split(/\s+/u);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidthPt) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Word-wraps Devanagari text to fit maxWidthPt using HarfBuzz advance widths. */
function wrapDevanagari(text, shaper, size, maxWidthPt) {
  const words = text.split(/\s+/u);
  const measure = (s) =>
    shaper.shape(s).reduce((sum, g) => sum + (g.xAdvance / shaper.upem) * size, 0);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidthPt) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildContentSpec(hindiSentences) {
  const [s1, s2] = hindiSentences;
  const hiPara1 = `${s1} ${s2} ${s1}`;
  const hiPara2 = `${s2} ${s1} ${s2}`;
  const hiPara3 = `${s1} ${s2}`;

  return [
    {
      title: "Quarterly Operations and Hindi Documentation Review",
      left: [
        { kind: "heading", text: "1. Digital Archive Standards" },
        {
          kind: "latin",
          text: "Regional engineering offices maintain archival PDF copies of technical notices, field bulletins, and bilingual inspection reports for public verification across all zones.",
        },
        { kind: "heading", text: "2. Devanagari Preservation" },
        { kind: "hindi", text: hiPara1 },
      ],
      right: [
        { kind: "heading", text: "3. Column Layout Verification" },
        {
          kind: "latin",
          text: "Multi-column bulletins must read strictly down the left column before moving to the right column so independent sections never merge across the central gutter.",
        },
        { kind: "heading", text: "4. Release Sign-off Checklist" },
        {
          kind: "latin",
          text: "Every exported Word document is reviewed for intact conjuncts, clean paragraph breaks, readable tables, and zero repeated running headers inside the main text body.",
        },
      ],
    },
    {
      left: [
        { kind: "heading", text: "5. Field Station Notes" },
        {
          kind: "latin",
          text: "Station coordinators submit monthly telemetry summaries in standardized two-column templates so archival reviewers can scan operational metrics quickly without reformatting.",
        },
        {
          kind: "latin",
          text: "Backup copies are stored locally on departmental workstations and checked before quarterly consolidation to confirm that headings stay aligned with their paragraphs.",
        },
      ],
      right: [
        { kind: "heading", text: "6. Regional Language Note" },
        { kind: "hindi", text: hiPara2 },
        {
          kind: "latin",
          text: "Unicode normalization ensures Hindi sentences copied from converted Word files match canonical spelling and remain searchable in office software.",
        },
      ],
    },
    {
      left: [
        { kind: "heading", text: "7. Summary of Findings" },
        {
          kind: "latin",
          text: "All participating divisions completed the structural audit on schedule and confirmed that tabular figures remain separate from surrounding column prose.",
        },
      ],
      right: [
        { kind: "heading", text: "8. Hindi Verification Sample" },
        { kind: "hindi", text: hiPara3 },
      ],
      table: [
        ["Zone", "Completed", "Pending"],
        ["North Division", "42", "3"],
        ["South Division", "38", "5"],
      ],
      closing: "End of quarterly bulletin. Retain this copy for audit review.",
    },
  ];
}

export async function generateTwoColumnFixture() {
  const hindiSentences = await readHindiSentencesFromFixture();
  const pagesSpec = buildContentSpec(hindiSentences);

  const notoBytes = new Uint8Array(readFileSync(NOTO_PATH));
  const shaper = await createDevanagariShaper(notoBytes);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const LEFT_X = 50;
  const RIGHT_X = 320;
  const COL_W = 225;
  const BODY_SIZE = 10.5;
  const HEADING_SIZE = 12.5;
  const LINE_STEP = 15;
  const PARA_GAP = 24;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Pre-wrap all Hindi paragraphs so we can collect every GID used across all 3 pages into one
  // shared embedded Noto Sans Devanagari Type0 font object.
  const wrappedHindiMap = new Map();
  const usedGids = new Set();
  for (const spec of pagesSpec) {
    for (const block of [...spec.left, ...spec.right]) {
      if (block.kind !== "hindi") continue;
      const lines = wrapDevanagari(block.text, shaper, BODY_SIZE, COL_W);
      const shapedLines = lines.map((lineText) => {
        const glyphs = shaper.shape(lineText);
        for (const g of glyphs) usedGids.add(g.gid);
        return { text: lineText, glyphs };
      });
      wrappedHindiMap.set(block, shapedLines);
    }
  }

  const subsetFontBytes = subsetOutlinesPreservingGsub(notoBytes, usedGids);
  const advances = readHmtxAdvances(subsetFontBytes);
  const scale = 1000 / shaper.upem;

  // Build ToUnicode CMap for every used GID (nominal cmap entries + fallback).
  const toUnicode = new Map();
  for (const gid of usedGids) {
    if (gid > 0 && shaper.nominal.has(gid)) toUnicode.set(gid, shaper.nominal.get(gid));
  }
  for (const gid of usedGids) {
    if (gid > 0 && !toUnicode.has(gid)) toUnicode.set(gid, "\u0915");
  }
  const bfchar = [...toUnicode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gid, s]) => `<${hex4(gid)}> <${encodeUtf16Be(s)}>`)
    .join(NL);
  const cmap = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    `${toUnicode.size} beginbfchar`,
    bfchar,
    "endbfchar",
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join(NL);

  const ctx = doc.context;
  const fontFileRef = ctx.register(
    ctx.flateStream(subsetFontBytes, { Length1: subsetFontBytes.byteLength }),
  );
  const baseName = "HPEFIX+NotoSansDevanagari";
  const fdRef = ctx.register(
    ctx.obj({
      Type: "FontDescriptor",
      FontName: PDFName.of(baseName),
      Flags: 4,
      FontBBox: [-500, -300, 1200, 1000],
      ItalicAngle: 0,
      Ascent: 900,
      Descent: -250,
      CapHeight: 700,
      StemV: 80,
      FontFile2: fontFileRef,
    }),
  );
  const wArr = PDFArray.withContext(ctx);
  for (const gid of [...usedGids].sort((a, b) => a - b)) {
    const inner = PDFArray.withContext(ctx);
    inner.push(PDFNumber.of(Math.round(advances[gid] * scale)));
    wArr.push(PDFNumber.of(gid));
    wArr.push(inner);
  }
  const cidRef = ctx.register(
    ctx.obj({
      Type: "Font",
      Subtype: "CIDFontType2",
      BaseFont: PDFName.of(baseName),
      CIDSystemInfo: {
        Registry: PDFString.of("Adobe"),
        Ordering: PDFString.of("Identity"),
        Supplement: 0,
      },
      FontDescriptor: fdRef,
      W: wArr,
      CIDToGIDMap: "Identity",
    }),
  );
  const toUniRef = ctx.register(ctx.flateStream(cmap));
  const type0Ref = ctx.register(
    ctx.obj({
      Type: "Font",
      Subtype: "Type0",
      BaseFont: PDFName.of(baseName),
      Encoding: "Identity-H",
      DescendantFonts: [cidRef],
      ToUnicode: toUniRef,
    }),
  );

  function drawDevanagariLine(page, fontKey, shaped, xPt, topYFromTop, size) {
    const pdfBaselineY = PAGE_H - topYFromTop;
    const tjArr = PDFArray.withContext(ctx);
    for (const g of shaped.glyphs) {
      const declared = Math.round(advances[g.gid] * scale);
      const xo = Math.round(g.xOffset * scale);
      const xa = Math.round(g.xAdvance * scale);
      if (xo !== 0) tjArr.push(PDFNumber.of(-xo));
      tjArr.push(PDFHexString.of(hex4(g.gid)));
      const post = declared + xo - xa;
      if (post !== 0) tjArr.push(PDFNumber.of(post));
    }
    page.pushOperators(
      pushGraphicsState(),
      setFillingRgbColor(0.08, 0.08, 0.08),
      beginText(),
      setFontAndSize(fontKey, size),
      setTextMatrix(1, 0, 0, 1, xPt, pdfBaselineY),
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of("Span"),
        `<< /ActualText <FEFF${encodeUtf16Be(shaped.text)}> >>`,
      ]),
      PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [tjArr]),
      PDFOperator.of(PDFOperatorNames.EndMarkedContent),
      endText(),
      popGraphicsState(),
    );
  }

  function drawColumn(page, fontKey, blocks, colX, startTopY) {
    let y = startTopY;
    for (const block of blocks) {
      if (block.kind === "heading") {
        page.drawText(block.text, {
          x: colX,
          y: PAGE_H - y,
          size: HEADING_SIZE,
          font: fontBold,
          color: rgb(0.08, 0.08, 0.08),
        });
        y += 20;
      } else if (block.kind === "latin") {
        const lines = wrapLatin(block.text, fontRegular, BODY_SIZE, COL_W);
        for (const lineText of lines) {
          page.drawText(lineText, {
            x: colX,
            y: PAGE_H - y,
            size: BODY_SIZE,
            font: fontRegular,
            color: rgb(0.08, 0.08, 0.08),
          });
          y += LINE_STEP;
        }
        y += PARA_GAP - LINE_STEP;
      } else if (block.kind === "hindi") {
        const shapedLines = wrappedHindiMap.get(block);
        for (const shaped of shapedLines) {
          drawDevanagariLine(page, fontKey, shaped, colX, y, BODY_SIZE);
          y += LINE_STEP;
        }
        y += PARA_GAP - LINE_STEP;
      }
    }
    return y;
  }

  const truthLines = [];
  const totalPages = pagesSpec.length;

  pagesSpec.forEach((spec, pageIndex) => {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const hindiFontKey = page.node.newFontDictionary("FDeva", type0Ref);

    // Running header inside top 12% (y = 36 pt from top -> 4.3%).
    page.drawText(RUNNING_HEADER, {
      x: LEFT_X,
      y: PAGE_H - 36,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    });

    // Running footer inside bottom 12% (y = 804 pt from top -> 95.5%).
    page.drawText(RUNNING_FOOTER_FOR_PAGE(pageIndex + 1, totalPages), {
      x: LEFT_X,
      y: PAGE_H - 804,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    });

    let colStartY = 128;
    if (spec.title) {
      page.drawText(spec.title, {
        x: LEFT_X,
        y: PAGE_H - 118,
        size: 16,
        font: fontBold,
        color: rgb(0.08, 0.08, 0.08),
      });
      truthLines.push(spec.title);
      colStartY = 158;
    }

    const leftEndY = drawColumn(page, hindiFontKey, spec.left, LEFT_X, colStartY);
    const rightEndY = drawColumn(page, hindiFontKey, spec.right, RIGHT_X, colStartY);
    for (const b of spec.left) truthLines.push(b.text);
    for (const b of spec.right) truthLines.push(b.text);

    let cursorY = Math.max(leftEndY, rightEndY) + 26;
    if (spec.table) {
      const xs = [LEFT_X, 260, 405, 545];
      const rowH = 26;
      const topPdfY = PAGE_H - cursorY;
      const ys = spec.table.map((_, idx) => topPdfY - idx * rowH);
      ys.push(topPdfY - spec.table.length * rowH);

      for (const y of ys) {
        page.drawLine({
          start: { x: xs[0], y },
          end: { x: xs[xs.length - 1], y },
          thickness: 0.75,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
      for (const x of xs) {
        page.drawLine({
          start: { x, y: ys[0] },
          end: { x, y: ys[ys.length - 1] },
          thickness: 0.75,
          color: rgb(0.2, 0.2, 0.2),
        });
      }

      spec.table.forEach((row, r) => {
        row.forEach((cellText, c) => {
          page.drawText(cellText, {
            x: xs[c] + 8,
            y: ys[r] - 17,
            size: 10.5,
            font: r === 0 ? fontBold : fontRegular,
            color: rgb(0.08, 0.08, 0.08),
          });
        });
        truthLines.push(row.join(" "));
      });
      cursorY += spec.table.length * rowH + 34;
    }

    if (spec.closing) {
      page.drawText(spec.closing, {
        x: LEFT_X,
        y: PAGE_H - cursorY,
        size: 10.5,
        font: fontRegular,
        color: rgb(0.08, 0.08, 0.08),
      });
      truthLines.push(spec.closing);
    }
  });

  shaper.destroy();
  const pdfBytes = await doc.save();
  const truthText = truthLines.join(NL) + NL;
  return { pdfBytes, truthText };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pdfBytes, truthText } = await generateTwoColumnFixture();
  const pdfOut = path.join(fixturesDir, "two-column-structure-fixture.pdf");
  const truthOut = path.join(fixturesDir, "two-column-structure-truth.txt");
  writeFileSync(pdfOut, pdfBytes);
  writeFileSync(truthOut, truthText, "utf8");
  console.log(`Wrote ${pdfOut} (${pdfBytes.byteLength} bytes) and ${truthOut}`);
}
