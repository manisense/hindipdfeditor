/**
 * Thin WebAssembly wrapper over `harfbuzzjs` (`harfbuzz.wasm` for OpenType shaping and
 * `harfbuzz-subset.wasm` for TrueType subsetting + variable-font axis instancing).
 *
 * Loaded lazily only when the Plan B vector-text export switch is enabled, so default Plan A
 * exports never download or compile either WASM binary. Both binaries are served from the app's
 * own origin via Vite static asset URLs, complying with the strict Content-Security-Policy.
 */
import harfbuzzSubsetWasmUrl from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url';
import harfbuzzWasmUrl from 'harfbuzzjs/dist/harfbuzz.wasm?url';

export type ShapedGlyph = {
  /** Font Glyph ID (GID). */
  gid: number;
  /** UTF-16 code unit index in the shaped run string (Level 0 monotone grapheme cluster). */
  cluster: number;
  /** Cluster-local UTF-16 offset within `ShapedCluster.text` (from Level 2 character clusters). */
  charCluster: number;
  /** Horizontal advance in font design units (unitsPerEm). */
  xAdvance: number;
  /** Vertical advance in font design units (unitsPerEm). */
  yAdvance: number;
  /** Horizontal offset from current pen position in font design units. */
  xOffset: number;
  /** Vertical offset from current pen position in font design units. */
  yOffset: number;
};

export type ShapedCluster = {
  /** Exact logical Unicode text represented by these shaped glyphs. */
  text: string;
  /** Glyphs in visual drawing order. */
  glyphs: ShapedGlyph[];
};

export type ScriptRun = {
  text: string;
  script: 'Deva' | 'Latn';
  language: string;
};

export type HarfBuzzWasmBytes = {
  shapeWasm: ArrayBuffer | Uint8Array;
  subsetWasm: ArrayBuffer | Uint8Array;
};

type ShapeExports = {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_get_upem(face: number): number;
  hb_font_create(face: number): number;
  hb_font_destroy(font: number): void;
  hb_font_set_scale(font: number, xScale: number, yScale: number): void;
  hb_font_set_variations(font: number, variations: number, length: number): void;
  hb_font_get_nominal_glyph(font: number, unicode: number, glyphOut: number): number;
  hb_buffer_create(): number;
  hb_buffer_destroy(buffer: number): void;
  hb_buffer_add_utf16(buffer: number, text: number, textLength: number, itemOffset: number, itemLength: number): void;
  hb_buffer_set_direction(buffer: number, direction: number): void;
  hb_buffer_set_script(buffer: number, script: number): void;
  hb_buffer_set_language(buffer: number, language: number): void;
  hb_buffer_set_cluster_level(buffer: number, level: number): void;
  hb_buffer_get_length(buffer: number): number;
  hb_buffer_get_glyph_infos(buffer: number, lengthOut: number): number;
  hb_buffer_get_glyph_positions(buffer: number, lengthOut: number): number;
  hb_script_from_string(str: number, len: number): number;
  hb_language_from_string(str: number, len: number): number;
  hb_shape(font: number, buffer: number, features: number, numFeatures: number): void;
};

type SubsetExports = {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_length(blob: number): number;
  hb_blob_get_data(blob: number, lengthOut: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_glyph_set(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_input_pin_axis_location(input: number, face: number, axisTag: number, axisValue: number): number;
  hb_subset_input_pin_axis_to_default(input: number, face: number, axisTag: number): number;
  hb_set_add(set: number, value: number): void;
  hb_subset_or_fail(face: number, input: number): number;
};

export type HarfBuzzEngine = {
  shape: ShapeExports;
  subset: SubsetExports;
};

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_DIRECTION_LTR = 4;
const HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES = 0;
const HB_BUFFER_CLUSTER_LEVEL_CHARACTERS = 2;
const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x00000002;

const STRONG_LATIN_RE = /[A-Za-z0-9]/;

function isDevanagariChar(ch: string): boolean {
  const cp = ch.charCodeAt(0);
  return (
    (cp >= 0x0900 && cp <= 0x097f) ||
    (cp >= 0x1cd0 && cp <= 0x1cff) ||
    (cp >= 0xa8e0 && cp <= 0xa8ff)
  );
}

function hbTag(tag: string): number {
  return (
    ((tag.charCodeAt(0) & 0xff) << 24) |
    ((tag.charCodeAt(1) & 0xff) << 16) |
    ((tag.charCodeAt(2) & 0xff) << 8) |
    (tag.charCodeAt(3) & 0xff)
  );
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

/** Instantiates both HarfBuzz shaping and subsetting WASM modules from raw bytes. */
export async function instantiateHarfBuzz(bytes: HarfBuzzWasmBytes): Promise<HarfBuzzEngine> {
  let shapeMemory: WebAssembly.Memory | null = null;
  const shapeResult = await WebAssembly.instantiate(toArrayBuffer(bytes.shapeWasm), {
    wasi_snapshot_preview1: {
      proc_exit(code: number) {
        throw new Error(`harfbuzz.wasm exited with status ${code}`);
      },
    },
    env: {
      _emscripten_runtime_keepalive_clear() {
        /* no-op */
      },
      _abort_js() {
        throw new Error('harfbuzz.wasm aborted');
      },
      _setitimer_js() {
        return 0;
      },
      emscripten_resize_heap(requestedSize: number) {
        if (!shapeMemory) return 0;
        const current = shapeMemory.buffer.byteLength;
        if (requestedSize <= current) return 1;
        const pages = Math.ceil((requestedSize - current) / 65536);
        try {
          shapeMemory.grow(pages);
          return 1;
        } catch {
          return 0;
        }
      },
    },
  });
  const shape = shapeResult.instance.exports as unknown as ShapeExports;
  shapeMemory = shape.memory;

  const subsetResult = await WebAssembly.instantiate(toArrayBuffer(bytes.subsetWasm));
  const subset = subsetResult.instance.exports as unknown as SubsetExports;

  return { shape, subset };
}

let cachedEngine: Promise<HarfBuzzEngine> | null = null;

/** Loads and caches the browser HarfBuzz WASM engine from same-origin bundled assets. */
export function loadHarfBuzzEngine(): Promise<HarfBuzzEngine> {
  if (!cachedEngine) {
    cachedEngine = (async () => {
      const [shapeRes, subsetRes] = await Promise.all([
        fetch(harfbuzzWasmUrl),
        fetch(harfbuzzSubsetWasmUrl),
      ]);
      if (!shapeRes.ok) throw new Error(`Failed to fetch harfbuzz.wasm (${shapeRes.status})`);
      if (!subsetRes.ok) throw new Error(`Failed to fetch harfbuzz-subset.wasm (${subsetRes.status})`);
      const [shapeWasm, subsetWasm] = await Promise.all([
        shapeRes.arrayBuffer(),
        subsetRes.arrayBuffer(),
      ]);
      return instantiateHarfBuzz({ shapeWasm, subsetWasm });
    })().catch((err) => {
      cachedEngine = null;
      throw err;
    });
  }
  return cachedEngine;
}

/**
 * Splits a line of text into script runs (Devanagari vs Latin) so HarfBuzz shapes every Devanagari
 * run with the `Deva` script and `hi` language even when preceded by Latin characters. Neutral
 * punctuation and spaces remain attached to their surrounding run to preserve kerning and word gaps.
 */
export function splitScriptRuns(text: string): ScriptRun[] {
  if (!text) return [];
  let defaultScript: 'Deva' | 'Latn' = 'Latn';
  for (const ch of text) {
    if (isDevanagariChar(ch)) {
      defaultScript = 'Deva';
      break;
    }
    if (STRONG_LATIN_RE.test(ch)) {
      defaultScript = 'Latn';
      break;
    }
  }

  const runs: ScriptRun[] = [];
  let currentScript: 'Deva' | 'Latn' = defaultScript;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let nextScript: 'Deva' | 'Latn' | null = null;
    if (isDevanagariChar(ch)) nextScript = 'Deva';
    else if (STRONG_LATIN_RE.test(ch)) nextScript = 'Latn';

    if (nextScript && nextScript !== currentScript) {
      if (i > start) {
        runs.push({
          text: text.slice(start, i),
          script: currentScript,
          language: currentScript === 'Deva' ? 'hi' : 'en',
        });
      }
      start = i;
      currentScript = nextScript;
    }
  }
  if (start < text.length) {
    runs.push({
      text: text.slice(start),
      script: currentScript,
      language: currentScript === 'Deva' ? 'hi' : 'en',
    });
  }
  return runs;
}

function allocAscii(ex: ShapeExports, text: string): number {
  const ptr = ex.malloc(text.length + 1);
  const heap = new Uint8Array(ex.memory.buffer);
  for (let i = 0; i < text.length; i++) heap[ptr + i] = text.charCodeAt(i) & 0xff;
  heap[ptr + text.length] = 0;
  return ptr;
}

/**
 * Reusable shaped-font session for a single `(fontBytes, weight)` pair. Avoids re-parsing the
 * OpenType tables for every line on a page; call `destroy()` when export finishes.
 */
export class HarfBuzzShaperFont {
  private readonly ex: ShapeExports;
  private readonly fontPtr: number;
  private readonly blobPtr: number;
  private readonly facePtr: number;
  private readonly hbFontPtr: number;
  public readonly upem: number;
  private destroyed = false;

  constructor(engine: HarfBuzzEngine, fontBytes: Uint8Array, weight: number) {
    const ex = engine.shape;
    this.ex = ex;
    this.fontPtr = ex.malloc(fontBytes.byteLength);
    new Uint8Array(ex.memory.buffer).set(fontBytes, this.fontPtr);
    this.blobPtr = ex.hb_blob_create(this.fontPtr, fontBytes.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
    this.facePtr = ex.hb_face_create(this.blobPtr, 0);
    this.upem = ex.hb_face_get_upem(this.facePtr);
    this.hbFontPtr = ex.hb_font_create(this.facePtr);
    ex.hb_font_set_scale(this.hbFontPtr, this.upem, this.upem);

    // Apply wght variation (no-op for static fonts without a wght axis).
    const varPtr = ex.malloc(8);
    const view = new DataView(ex.memory.buffer);
    view.setUint32(varPtr, hbTag('wght'), true);
    view.setFloat32(varPtr + 4, weight, true);
    ex.hb_font_set_variations(this.hbFontPtr, varPtr, 1);
    ex.free(varPtr);
  }

  /** Looks up the nominal GID for a single Unicode code point, or 0 if absent. */
  nominalGlyph(codePoint: number): number {
    if (this.destroyed) throw new Error('HarfBuzzShaperFont already destroyed');
    const outPtr = this.ex.malloc(4);
    try {
      const ok = this.ex.hb_font_get_nominal_glyph(this.hbFontPtr, codePoint, outPtr);
      if (!ok) return 0;
      return new DataView(this.ex.memory.buffer).getUint32(outPtr, true);
    } finally {
      this.ex.free(outPtr);
    }
  }

  private shapeRaw(run: ScriptRun, clusterLevel: number): Omit<ShapedGlyph, 'charCluster'>[] {
    const ex = this.ex;
    const buf = ex.hb_buffer_create();
    const textPtr = ex.malloc(run.text.length * 2);
    const scriptPtr = allocAscii(ex, run.script);
    const langPtr = allocAscii(ex, run.language);
    try {
      const u16 = new Uint16Array(ex.memory.buffer, textPtr, run.text.length);
      for (let i = 0; i < run.text.length; i++) u16[i] = run.text.charCodeAt(i);

      ex.hb_buffer_add_utf16(buf, textPtr, run.text.length, 0, run.text.length);
      ex.hb_buffer_set_direction(buf, HB_DIRECTION_LTR);
      ex.hb_buffer_set_script(buf, ex.hb_script_from_string(scriptPtr, run.script.length));
      ex.hb_buffer_set_language(buf, ex.hb_language_from_string(langPtr, run.language.length));
      ex.hb_buffer_set_cluster_level(buf, clusterLevel);
      ex.hb_shape(this.hbFontPtr, buf, 0, 0);

      const length = ex.hb_buffer_get_length(buf);
      if (length === 0) return [];

      const infosPtr = ex.hb_buffer_get_glyph_infos(buf, 0);
      const posPtr = ex.hb_buffer_get_glyph_positions(buf, 0);
      const view = new DataView(ex.memory.buffer);

      const rawGlyphs: Omit<ShapedGlyph, 'charCluster'>[] = new Array(length);
      for (let i = 0; i < length; i++) {
        const infoBase = infosPtr + i * 20;
        const posBase = posPtr + i * 20;
        rawGlyphs[i] = {
          gid: view.getUint32(infoBase, true),
          cluster: view.getUint32(infoBase + 8, true),
          xAdvance: view.getInt32(posBase, true),
          yAdvance: view.getInt32(posBase + 4, true),
          xOffset: view.getInt32(posBase + 8, true),
          yOffset: view.getInt32(posBase + 12, true),
        };
      }
      return rawGlyphs;
    } finally {
      ex.free(langPtr);
      ex.free(scriptPtr);
      ex.free(textPtr);
      ex.hb_buffer_destroy(buf);
    }
  }

  /** Shapes a single script run into monotone grapheme clusters with exact glyph positions. */
  shapeRun(run: ScriptRun): ShapedCluster[] {
    if (this.destroyed) throw new Error('HarfBuzzShaperFont already destroyed');
    if (run.text.length === 0) return [];

    const rawL0 = this.shapeRaw(run, HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES);
    if (rawL0.length === 0) return [];

    // Group contiguous glyphs sharing the same UTF-16 cluster index (monotone LTR).
    const groups: { start: number; indices: number[] }[] = [];
    for (let i = 0; i < rawL0.length; i++) {
      const last = groups[groups.length - 1];
      if (last && last.start === rawL0[i].cluster) {
        last.indices.push(i);
      } else {
        groups.push({ start: rawL0[i].cluster, indices: [i] });
      }
    }

    // For runs with multi-glyph clusters (conjunct + matra, reph, pre-base ि), also read Level 2
    // character-level cluster indices so each glyph maps to its own characters in ToUnicode.
    const rawL2 = groups.some((g) => g.indices.length > 1)
      ? this.shapeRaw(run, HB_BUFFER_CLUSTER_LEVEL_CHARACTERS)
      : null;
    const hasMatchingL2 = rawL2 !== null && rawL2.length === rawL0.length;

    const clusters: ShapedCluster[] = [];
    for (let i = 0; i < groups.length; i++) {
      const start = groups[i].start;
      const end = i + 1 < groups.length ? groups[i + 1].start : run.text.length;
      const text = run.text.slice(start, Math.max(start, end));
      const maxOffset = Math.max(0, text.length - 1);
      const glyphs: ShapedGlyph[] = groups[i].indices.map((idx) => {
        const g = rawL0[idx];
        const rawLocal = hasMatchingL2 ? rawL2[idx].cluster - start : 0;
        const charCluster = Math.max(0, Math.min(maxOffset, rawLocal));
        return { ...g, charCluster };
      });
      clusters.push({ text, glyphs });
    }
    return clusters;
  }

  /** Shapes a full line (splitting Devanagari and Latin runs automatically). */
  shapeLine(text: string): ShapedCluster[] {
    const clusters: ShapedCluster[] = [];
    for (const run of splitScriptRuns(text)) {
      clusters.push(...this.shapeRun(run));
    }
    return clusters;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ex.hb_font_destroy(this.hbFontPtr);
    this.ex.hb_face_destroy(this.facePtr);
    this.ex.hb_blob_destroy(this.blobPtr);
    this.ex.free(this.fontPtr);
  }
}

/**
 * Subsets a TrueType font to the specified GIDs (retaining original GIDs so `CIDToGIDMap /Identity`
 * maps directly to HarfBuzz GIDs) and pins the `wght` variation axis when variable, producing a
 * compact static TrueType font safe for all PDF viewers (Poppler, pdf.js, Acrobat, Preview).
 */
export function subsetAndInstanceFont(
  engine: HarfBuzzEngine,
  fontBytes: Uint8Array,
  usedGids: Iterable<number>,
  weight: number,
  variationAxes: readonly string[],
): Uint8Array {
  const ex = engine.subset;
  const fontPtr = ex.malloc(fontBytes.byteLength);
  let blob = 0;
  let face = 0;
  let input = 0;
  let outFace = 0;
  let outBlob = 0;
  try {
    new Uint8Array(ex.memory.buffer).set(fontBytes, fontPtr);
    blob = ex.hb_blob_create(fontPtr, fontBytes.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
    face = ex.hb_face_create(blob, 0);
    input = ex.hb_subset_input_create_or_fail();
    if (!input) throw new Error('harfbuzz-subset: failed to create subset input');

    ex.hb_subset_input_set_flags(input, HB_SUBSET_FLAGS_RETAIN_GIDS);
    for (const axis of variationAxes) {
      if (axis === 'wght') {
        ex.hb_subset_input_pin_axis_location(input, face, hbTag('wght'), weight);
      } else {
        ex.hb_subset_input_pin_axis_to_default(input, face, hbTag(axis));
      }
    }

    const glyphSet = ex.hb_subset_input_glyph_set(input);
    ex.hb_set_add(glyphSet, 0); // Always retain .notdef (GID 0).
    for (const gid of usedGids) {
      if (gid >= 0 && gid <= 0xffff) ex.hb_set_add(glyphSet, gid);
    }

    outFace = ex.hb_subset_or_fail(face, input);
    if (!outFace) throw new Error('harfbuzz-subset: hb_subset_or_fail returned null');

    outBlob = ex.hb_face_reference_blob(outFace);
    const outLen = ex.hb_blob_get_length(outBlob);
    const outPtr = ex.hb_blob_get_data(outBlob, 0);
    if (outLen === 0 || outPtr === 0) throw new Error('harfbuzz-subset: empty subset output');

    return new Uint8Array(ex.memory.buffer, outPtr, outLen).slice();
  } finally {
    if (outBlob) ex.hb_blob_destroy(outBlob);
    if (outFace) ex.hb_face_destroy(outFace);
    if (input) ex.hb_subset_input_destroy(input);
    if (face) ex.hb_face_destroy(face);
    if (blob) ex.hb_blob_destroy(blob);
    ex.free(fontPtr);
  }
}
