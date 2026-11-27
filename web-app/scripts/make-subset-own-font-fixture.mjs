// Generates a synthetic single-page PDF whose Hindi line ("नमस्ते भारत") is drawn with a
// retained-GID subset of our bundled Noto Sans Devanagari font: GSUB (deva/dev2) and cmap stay
// intact, while glyf/loca keep outlines ONLY for the glyphs of "नमस्ते भारत". Editing that line
// to text needing other glyphs must detect the missing outlines and fall back to bundled Noto
// Plan B (web ADR 0021 amendment, own-solutions idea 5).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const editorDir = path.join(here, "../editor");
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
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setFontAndSize,
  setTextMatrix,
} = require("@cantoo/pdf-lib");

const NOTO_PATH = path.join(editorDir, "public/fonts/NotoSansDevanagari-Variable.ttf");
const HB_WASM_PATH = path.join(editorDir, "node_modules/harfbuzzjs/dist/harfbuzz.wasm");

export const SUBSET_FIXTURE_ORIGINAL_LINE = "कमल भारत का नाम है";

function hex4(n) {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function encodeUtf16Be(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) out += hex4(text.charCodeAt(i));
  return out;
}

function unpackSfnt(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4, false);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
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
  for (let i = 0; i < numTables; i++) {
    const [tag, b] = entries[i];
    const dirBase = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[dirBase + k] = tag.charCodeAt(k);
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
  const head = tables.get("head").slice();
  const headView = new DataView(head.buffer);
  const indexToLocFormat = headView.getInt16(50, false);
  const numGlyphs = new DataView(tables.get("maxp").buffer).getUint16(4, false);
  const oldLoca = tables.get("loca");
  const oldLocaView = new DataView(oldLoca.buffer, oldLoca.byteOffset, oldLoca.byteLength);
  const oldGlyf = tables.get("glyf");
  const getOffset = (gid) =>
    indexToLocFormat === 0
      ? oldLocaView.getUint16(gid * 2, false) * 2
      : oldLocaView.getUint32(gid * 4, false);

  const keep = new Set([0, ...seedGids]);
  for (const gid of [...keep]) collectCompositeComponents(oldGlyf, getOffset, gid, keep);

  const chunks = [];
  const newOffsets = new Uint32Array(numGlyphs + 1);
  let cursor = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    newOffsets[gid] = cursor;
    if (keep.has(gid)) {
      const start = getOffset(gid);
      const end = getOffset(gid + 1);
      if (end > start) {
        const slice = oldGlyf.slice(start, end);
        chunks.push(slice);
        cursor += slice.byteLength;
        const pad = (4 - (cursor % 4)) % 4;
        if (pad > 0) {
          chunks.push(new Uint8Array(pad));
          cursor += pad;
        }
      }
    }
  }
  newOffsets[numGlyphs] = cursor;

  const newGlyf = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    newGlyf.set(c, pos);
    pos += c.byteLength;
  }
  headView.setInt16(50, 1, false);
  const newLoca = new Uint8Array((numGlyphs + 1) * 4);
  const newLocaView = new DataView(newLoca.buffer);
  for (let i = 0; i <= numGlyphs; i++) newLocaView.setUint32(i * 4, newOffsets[i], false);

  tables.set("head", head);
  tables.set("loca", newLoca);
  tables.set("glyf", newGlyf);
  return packSfnt(tables);
}

async function shapeDevanagari(fontBytes, text) {
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
    for (let i = 0; i < s.length; i++) u8[p + i] = s.charCodeAt(i);
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

  const buf = ex.hb_buffer_create();
  const textPtr = ex.malloc(text.length * 2);
  const u16 = new Uint16Array(ex.memory.buffer, textPtr, text.length);
  for (let i = 0; i < text.length; i++) u16[i] = text.charCodeAt(i);
  const scriptPtr = allocAscii("Deva");
  const langPtr = allocAscii("hi");
  ex.hb_buffer_add_utf16(buf, textPtr, text.length, 0, text.length);
  ex.hb_buffer_set_direction(buf, 4);
  ex.hb_buffer_set_script(buf, ex.hb_script_from_string(scriptPtr, 4));
  ex.hb_buffer_set_language(buf, ex.hb_language_from_string(langPtr, 2));
  ex.hb_buffer_set_cluster_level(buf, 0);
  ex.hb_shape(font, buf, 0, 0);

  const len = ex.hb_buffer_get_length(buf);
  const infos = ex.hb_buffer_get_glyph_infos(buf, 0);
  const posPtr = ex.hb_buffer_get_glyph_positions(buf, 0);
  const view = new DataView(ex.memory.buffer);
  const glyphs = [];
  for (let i = 0; i < len; i++) {
    glyphs.push({
      gid: view.getUint32(infos + i * 20, true),
      cluster: view.getUint32(infos + i * 20 + 8, true),
      xAdvance: view.getInt32(posPtr + i * 20, true),
      xOffset: view.getInt32(posPtr + i * 20 + 8, true),
    });
  }

  const nominal = new Map();
  const outPtr = ex.malloc(4);
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    if (ex.hb_font_get_nominal_glyph(font, cp, outPtr)) {
      nominal.set(new DataView(ex.memory.buffer).getUint32(outPtr, true), String.fromCodePoint(cp));
    }
  }
  for (let cp = 0x0900; cp <= 0x097f; cp++) {
    if (ex.hb_font_get_nominal_glyph(font, cp, outPtr)) {
      nominal.set(new DataView(ex.memory.buffer).getUint32(outPtr, true), String.fromCodePoint(cp));
    }
  }

  ex.free(outPtr);
  ex.free(langPtr);
  ex.free(scriptPtr);
  ex.free(textPtr);
  ex.hb_buffer_destroy(buf);
  ex.hb_font_destroy(font);
  ex.hb_face_destroy(face);
  ex.hb_blob_destroy(blob);
  ex.free(fontPtr);
  return { upem, glyphs, nominal };
}

function readHmtxAdvances(fontBytes) {
  const tables = unpackSfnt(fontBytes);
  const numHMetrics = new DataView(tables.get("hhea").buffer).getUint16(34, false);
  const numGlyphs = new DataView(tables.get("maxp").buffer).getUint16(4, false);
  const hmtx = new DataView(tables.get("hmtx").buffer);
  const advances = new Uint16Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < Math.min(numHMetrics, numGlyphs); g++) {
    last = hmtx.getUint16(g * 4, false);
    advances[g] = last;
  }
  for (let g = numHMetrics; g < numGlyphs; g++) advances[g] = last;
  return advances;
}

export async function buildSubsetOwnFontFixtureBytes(text = SUBSET_FIXTURE_ORIGINAL_LINE) {
  const notoBytes = new Uint8Array(readFileSync(NOTO_PATH));
  const { upem, glyphs, nominal } = await shapeDevanagari(notoBytes, text);
  const usedGids = new Set(glyphs.map((g) => g.gid));
  const subsetFontBytes = subsetOutlinesPreservingGsub(notoBytes, usedGids);
  const advances = readHmtxAdvances(subsetFontBytes);
  const scale = 1000 / upem;

  // Build ToUnicode for used GIDs.
  const toUnicode = new Map();
  for (const g of glyphs) {
    if (g.gid > 0 && nominal.has(g.gid)) toUnicode.set(g.gid, nominal.get(g.gid));
  }
  for (const g of glyphs) {
    if (g.gid > 0 && !toUnicode.has(g.gid)) toUnicode.set(g.gid, "\u0938\u094D");
  }
  const bfchar = [...toUnicode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gid, s]) => `<${hex4(gid)}> <${encodeUtf16Be(s)}>`)
    .join("\n");
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
  ].join("\n");

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const ctx = doc.context;

  const fontFileRef = ctx.register(
    ctx.flateStream(subsetFontBytes, { Length1: subsetFontBytes.byteLength }),
  );
  const baseName = "SUBSET+CustomDevanagari";
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
  const fontKey = page.node.newFontDictionary("FSub", type0Ref);

  const tjArr = PDFArray.withContext(ctx);
  for (const g of glyphs) {
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
    setFillingRgbColor(0, 0, 0),
    beginText(),
    setFontAndSize(fontKey, 16),
    setTextMatrix(1, 0, 0, 1, 72, 700),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
      PDFName.of("Span"),
      `<< /ActualText <FEFF${encodeUtf16Be(text)}> >>`,
    ]),
    PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [tjArr]),
    PDFOperator.of(PDFOperatorNames.EndMarkedContent),
    endText(),
    popGraphicsState(),
  );

  return doc.save();
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2]) {
  const bytes = await buildSubsetOwnFontFixtureBytes();
  writeFileSync(process.argv[2], bytes);
}
