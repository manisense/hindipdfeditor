import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from '@cantoo/pdf-lib';

import { fontGlyphText, PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';

/**
 * Repairs a mis-mapped ToUnicode map from the embedded font itself, in a copy used only for
 * reading text (the original file is never changed). Some producers (Word files passed through
 * iLovePDF, seen on Railway Recruitment Board notices) write a ToUnicode map that names the
 * wrong letter for many Devanagari glyphs, while the embedded TrueType font still holds the right
 * answer in its cmap and GSUB tables (see `fontGlyphText`). A correct map has no reason to name
 * another letter than the font's own cmap, so a font is repaired when the two readings disagree
 * (after NFC) on at least {@link MIN_DISAGREEMENTS} single-letter glyphs and on at least
 * {@link MIN_DISAGREEMENT_SHARE} of those both name (Word + iLovePDF: 9 of 60), or when it names
 * a pre-base ि or reph glyph by its plain letter (text in drawing order, ligatures unmapped); fonts that agree, have no ToUnicode,
 * or cannot be read are left exactly as they are, so their text keeps its existing checks.
 *
 * Reordered glyphs (pre-base ि, reph) come out as marks; `reorderDevanagariMarks` puts them in
 * reading order. A map that names glyph 0, the font's empty box, as a letter has that entry
 * replaced by {@link MISSING_GLYPH_MARK}, so boxes never read as letters.
 */

/**
 * Stands for text drawn with a font's missing glyph (glyph 0), which shows as an empty box. A
 * private-use character, so text extraction drops it without judging the page unreadable (OCR
 * cannot read a box either).
 */
export const MISSING_GLYPH_MARK = '\uE0F2';

/**
 * Stands for a non-space Devanagari glyph whose ToUnicode was mapped to ASCII space (U+0020) as a
 * cluster filler by Microsoft Word 2021 (e.g. `स` in `सिंह` = `[ि→"स"][स→" "][ं→"िं"]` or `ा` in
 * `दिनांक` = `[ा→" "][ं→"ां"]`). Keeping a non-whitespace private-use code point lets pdf.js
 * advance the run's width and `prevTransform` across the glyph instead of emitting a fake space and
 * flushing the following GPOS-shifted zero-width combining mark into a separate, mis-sorted run;
 * `sanitizeEmbeddedText` drops it cleanly.
 */
export const CLUSTER_FILLER_MARK = '\uE0F3';

const MIN_DISAGREEMENTS = 3;
const MIN_DISAGREEMENT_SHARE = 0.05;
const DEVANAGARI = /[ऀ-ॿ]/u;
const DEVANAGARI_CONSONANT = /[\u0915-\u0939\u0958-\u095F\u0978-\u097F]/u;
const DEVANAGARI_VOWEL_OR_NASAL_SIGNS = /^[\u0901-\u0903\u093E-\u094C\u0955-\u0957]+$/u;
const RAKAR = '्र';
const REPH = 'र्';
const BFCHAR_BLOCK = 100;

export type ToUnicodeRepair = {
  /** Bytes to read text from: the input itself when nothing was repaired. */
  bytes: Uint8Array;
  /** Base font names whose ToUnicode was replaced. */
  repairedFonts: string[];
  /** Those whose map was only in drawing order, not naming wrong letters (see `inDrawingOrder`). */
  drawingOrderFonts: string[];
  /**
   * Pages (0-based) that use a font whose ToUnicode names its missing glyph (glyph 0) as a letter:
   * Word does this when it sets Hindi in a font without Devanagari, so the page shows empty boxes
   * and that text cannot be recovered from the file. A page may use the font without drawing the
   * box; its text then has no {@link MISSING_GLYPH_MARK}.
   */
  missingGlyphPages: number[];
};

/** Reads a ToUnicode CMap's bfchar and bfrange entries: character code → text. */
export function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const hexText = (hex: string) => {
    let text = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) text += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return text;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/gu)) {
    for (const [, code, text] of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/gu)) map.set(parseInt(code, 16), hexText(text));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/gu)) {
    for (const [, from, to, target] of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]*>|\[[^\]]*\])/gu)) {
      const start = parseInt(from, 16);
      const end = parseInt(to, 16);
      if (target.startsWith('[')) {
        [...target.matchAll(/<([0-9A-Fa-f]*)>/gu)].forEach(([, hex], i) => {
          if (start + i <= end) map.set(start + i, hexText(hex));
        });
      } else {
        const base = hexText(target.slice(1, -1));
        for (let code = start; code <= end && code - start < 0x10000; code++) {
          const last = base.charCodeAt(base.length - 1) + code - start;
          map.set(code, base.slice(0, -1) + String.fromCharCode(last));
        }
      }
    }
  }
  return map;
}

/** Writes a ToUnicode CMap for 2-byte codes. */
export function buildToUnicode(map: ReadonlyMap<number, string>): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  const entries = [...map].filter(([code, text]) => code <= 0xffff && text.length > 0).sort((a, b) => a[0] - b[0]);
  const lines = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
  ];
  for (let i = 0; i < entries.length; i += BFCHAR_BLOCK) {
    const block = entries.slice(i, i + BFCHAR_BLOCK);
    lines.push(`${block.length} beginbfchar`);
    for (const [code, text] of block) lines.push(`<${hex(code)}> <${[...text].map((c) => hex(c.charCodeAt(0))).join('')}>`);
    lines.push('endbfchar');
  }
  lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  return lines.join('\n');
}

function streamBytes(stream: unknown): Uint8Array | null {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  if (stream instanceof PDFStream) return stream.getContents();
  return null;
}

/**
 * Whether a map names a pre-base ि or reph glyph by its plain letter, so it gives text in drawing
 * order ("अनुसूिचत"). Such maps also tend to leave ligatures unmapped, so their letters vanish;
 * the font's own reading fills them in and orders ि and reph. Seen on Chrome output merged by
 * PDFsam (CEN 08/2024), which also leaves gaps inside words and draws its spaces.
 */
export function inDrawingOrder(existing: ReadonlyMap<number, string>, fromFont: ReadonlyMap<number, string>): boolean {
  return [...fromFont].some(([gid, letters]) => {
    const old = existing.get(gid)?.normalize('NFC');
    return (letters === PRE_BASE_MARK && old === 'ि') || (letters === REPH_MARK && old === 'र्');
  });
}

function isBackwardsRakar(old: string | undefined, letters: string): boolean {
  if (old === undefined || !letters.includes(RAKAR)) return false;
  return old.normalize('NFC') === letters.replaceAll(RAKAR, REPH).normalize('NFC');
}

/**
 * Whether a map reads a below-base rakar glyph (or rakar conjunct) backwards as "र्" instead of
 * "्र". Real reph glyphs read as {@link REPH_MARK} in the font and never match this check.
 */
export function hasBackwardsRakar(existing: ReadonlyMap<number, string>, fromFont: ReadonlyMap<number, string>): boolean {
  return [...fromFont].some(([gid, letters]) => isBackwardsRakar(existing.get(gid), letters));
}

/**
 * Whether a map names a font-proven pre-base ि or reph glyph as a Devanagari consonant
 * (e.g. Mangal-Bold mapping contextual ि variants to "द" or "व", turning दिनांक into ददनांक).
 * A reph mapped to "र्" is drawing order (see {@link inDrawingOrder}), not a consonant mis-mapping.
 */
export function misMapsMarkAsConsonant(existing: ReadonlyMap<number, string>, fromFont: ReadonlyMap<number, string>): boolean {
  return [...fromFont].some(([gid, letters]) => {
    const old = existing.get(gid)?.normalize('NFC');
    if (old === undefined || !DEVANAGARI_CONSONANT.test(old)) return false;
    if (letters === PRE_BASE_MARK) return true;
    return letters === REPH_MARK && old !== REPH;
  });
}

export type RepairOptions = {
  /** A sibling font of the same family in this document was already repaired as mis-mapped. */
  siblingRepaired?: boolean;
  /** Glyphs proven by GSUB to carry a reph whose base vowel sign was stripped from cmap. */
  rephLigatures?: ReadonlySet<number>;
};

/**
 * The repaired ToUnicode for a Type0 / CIDFontType2 / Identity font, or null when it needs none.
 * Exported for tests.
 */
export function repairedToUnicode(
  existing: ReadonlyMap<number, string>,
  fromFont: ReadonlyMap<number, string>,
  options: RepairOptions = {},
): Map<number, string> | null {
  let agree = 0;
  let disagree = 0;
  for (const [gid, letters] of fromFont) {
    const old = existing.get(gid);
    const plain = letters.replace(PRE_BASE_MARK, 'ि').replace(REPH_MARK, 'र्');
    // Judged on glyphs that are one letter in the font (or ि / reph), where a correct map has no
    // reason to differ; ligatures may fairly be mapped in other ways.
    const single = [...plain.normalize('NFC')].length === 1 || letters === PRE_BASE_MARK || letters === REPH_MARK;
    if (old === undefined || !single || !DEVANAGARI.test(plain)) continue;
    if (old.normalize('NFC') === plain.normalize('NFC')) agree++;
    else disagree++;
  }
  const misMapped =
    (disagree >= MIN_DISAGREEMENTS && disagree / (agree + disagree) >= MIN_DISAGREEMENT_SHARE) ||
    (Boolean(options.siblingRepaired) && disagree >= 1) ||
    misMapsMarkAsConsonant(existing, fromFont);
  if (!misMapped && !inDrawingOrder(existing, fromFont) && !hasBackwardsRakar(existing, fromFont)) return null;
  const repaired = new Map(existing);
  for (const [gid, letters] of fromFont) {
    if (![...letters].some((c) => DEVANAGARI.test(c) || c === PRE_BASE_MARK || c === REPH_MARK)) continue;
    if (
      misMapped ||
      !existing.get(gid) ||
      letters.includes(PRE_BASE_MARK) ||
      letters.includes(REPH_MARK) ||
      isBackwardsRakar(existing.get(gid), letters)
    ) {
      repaired.set(gid, letters);
    }
  }
  if (misMapped && options.rephLigatures) {
    for (const gid of options.rephLigatures) {
      if (fromFont.has(gid)) continue;
      const old = existing.get(gid)?.normalize('NFC');
      if (old && DEVANAGARI_VOWEL_OR_NASAL_SIGNS.test(old)) repaired.set(gid, REPH_MARK + old);
    }
  }
  // In a map shown to name wrong letters, a single-letter entry the font cannot vouch for (a
  // subset with no GSUB and a partial cmap: Gazette of India, iTextSharp) is likely wrong too, as
  // its ि variants and conjuncts are named by unrelated letters (हहंदी, दकसी, उि). It is made
  // unknown (U+0000), so glyph repair learns it from OCR once per document (glyphRepair.ts).
  if (misMapped) {
    for (const [gid, text] of existing) {
      if (!fromFont.has(gid) && [...text].length === 1 && DEVANAGARI.test(text) && repaired.get(gid) === text) {
        repaired.set(gid, String.fromCharCode(0));
      }
    }
  }
  return repaired;
}

/** A font's BaseFont as pdf.js names it: `#20` and other escapes decoded, no leading slash. */
export function baseFontName(value: unknown): string {
  return value instanceof PDFName ? value.decodeText() : '';
}

/** Normalises a PDF BaseFont name to its family key (subset prefix and weight/style stripped). */
export function fontFamilyKey(baseName: string): string {
  const withoutSubset = baseName.replace(/^[A-Z]{6}\+/u, '');
  const beforeComma = withoutSubset.split(',')[0] ?? withoutSubset;
  const withoutStyle = beforeComma.replace(
    /(?:[-_\s]+(?:bold|italic|oblique|regular|roman|medium|light|semibold|demibold|extrabold|black|heavy|thin|w\d+))+$/iu,
    '',
  );
  return withoutStyle.replace(/[\s_-]+/gu, '').toLowerCase();
}

function isDrawingOrderOnly(existing: ReadonlyMap<number, string>, repaired: ReadonlyMap<number, string>): boolean {
  return [...repaired].every(([gid, letters]) => existing.get(gid) === letters || !existing.has(gid) || /[\uE0F0\uE0F1]/u.test(letters));
}

/**
 * Replaces fake ASCII-space ToUnicode entries on non-space Devanagari glyphs in a stream-mapped
 * CIDFontType2 font (Microsoft Word 2021 cluster fillers) with {@link CLUSTER_FILLER_MARK}, or
 * returns null when none qualify.
 *
 * Fails closed: requires a readable embedded font cmap (`fromFont.size > 0`, excluding dummy
 * OCR fonts such as Tesseract's `GlyphLessFont` where every CID maps to glyph 1), never touches
 * glyph 0 or any glyph mapped to whitespace in the font, and only replaces a `" "` entry when its
 * glyph ID is proven Devanagari by the font's own cmap or by a sibling CID sharing the exact same
 * glyph ID (when the font also has a proven space glyph in its cmap). Exported for tests.
 */
export function repairedSpaceFillerToUnicode(
  existing: ReadonlyMap<number, string>,
  gidOfCid: (cid: number) => number,
  fromFont: ReadonlyMap<number, string>,
): Map<number, string> | null {
  if (fromFont.size === 0) return null;
  const spaceGids = new Set<number>();
  for (const [gid, letters] of fromFont) {
    if (/^\s+$/u.test(letters)) spaceGids.add(gid);
  }
  const devanagariGids = new Set<number>();
  for (const [cid, text] of existing) {
    if (!DEVANAGARI.test(text)) continue;
    const gid = gidOfCid(cid);
    if (gid > 0) devanagariGids.add(gid);
  }
  let repaired: Map<number, string> | null = null;
  for (const [cid, text] of existing) {
    if (text !== ' ') continue;
    const gid = gidOfCid(cid);
    if (gid <= 0 || spaceGids.has(gid)) continue;
    const fontLetters = fromFont.get(gid);
    const provenDevanagari =
      (fontLetters !== undefined && DEVANAGARI.test(fontLetters)) ||
      (spaceGids.size > 0 && devanagariGids.has(gid));
    if (!provenDevanagari) continue;
    repaired ??= new Map(existing);
    repaired.set(cid, CLUSTER_FILLER_MARK);
  }
  return repaired;
}

/**
 * Returns bytes whose mis-mapped Devanagari ToUnicode maps are rebuilt from the embedded fonts,
 * or the input unchanged. Never throws: any failure returns the input.
 *
 * @param bytes The opened PDF (not modified).
 */
export async function repairMisMappedToUnicode(bytes: Uint8Array): Promise<ToUnicodeRepair> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const repairedFonts: string[] = [];
    const drawingOrderFonts: string[] = [];
    const missingGlyphFonts = new Set<PDFDict>();
    let changed = false;

    type Candidate = {
      object: PDFDict;
      name: string;
      family: string;
      existing: Map<number, string>;
      fromFont: Map<number, string> | null;
      rephLigatures: Set<number> | undefined;
      missing: boolean;
      repaired: Map<number, string> | null;
    };
    const candidates: Candidate[] = [];
    const repairedMisMappedFamilies = new Set<string>();

    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict) || object.get(PDFName.of('Subtype')) !== PDFName.of('Type0')) continue;
      if (object.get(PDFName.of('Encoding')) !== PDFName.of('Identity-H')) continue;
      const descendants = object.lookup(PDFName.of('DescendantFonts'));
      const cid = descendants instanceof PDFArray ? descendants.lookup(0) : undefined;
      if (!(cid instanceof PDFDict) || cid.get(PDFName.of('Subtype')) !== PDFName.of('CIDFontType2')) continue;
      const cidToGid = cid.get(PDFName.of('CIDToGIDMap'));
      const descriptor = cid.lookup(PDFName.of('FontDescriptor'));
      const fontFile = descriptor instanceof PDFDict ? streamBytes(descriptor.lookup(PDFName.of('FontFile2'))) : null;
      const toUnicode = streamBytes(object.lookup(PDFName.of('ToUnicode')));
      if (!toUnicode) continue;
      const existing = parseToUnicode(new TextDecoder('latin1').decode(toUnicode));

      if (cidToGid !== undefined && cidToGid !== PDFName.of('Identity')) {
        // Stream CIDToGIDMap (e.g. Microsoft Word 2021): ToUnicode is cluster-swapped per CID and
        // GSUB is typically stripped from FontFile2, so do not rebuild from cmap/GSUB — only
        // replace fake ASCII-space filler CIDs on non-space Devanagari glyphs.
        const mapBytes = streamBytes(cid.lookup(PDFName.of('CIDToGIDMap')));
        if (!mapBytes || !fontFile) continue;
        const reading = fontGlyphText(fontFile);
        const gidOfCid = (code: number) =>
          code >= 0 && code * 2 + 1 < mapBytes.length ? (mapBytes[code * 2] << 8) | mapBytes[code * 2 + 1] : -1;
        const fillerFixed = repairedSpaceFillerToUnicode(existing, gidOfCid, reading.text);
        if (fillerFixed) {
          const ref: PDFRef = doc.context.register(doc.context.flateStream(buildToUnicode(fillerFixed)));
          object.set(PDFName.of('ToUnicode'), ref);
          changed = true;
        }
        continue;
      }

      // With Identity CIDToGIDMap, code 0 is glyph 0: a letter mapped to it is drawn as a box.
      // A letter, not U+0000 or another control code (NIC eOffice maps glyph 0 to U+0000).
      const missing = /\p{L}/u.test(existing.get(0) ?? '');
      const reading = fontFile ? fontGlyphText(fontFile) : null;
      const repaired = reading ? repairedToUnicode(existing, reading.text, { rephLigatures: reading.rephLigatures }) : null;
      const name = baseFontName(object.get(PDFName.of('BaseFont')));
      const family = fontFamilyKey(name);
      if (repaired && family && !isDrawingOrderOnly(existing, repaired)) {
        repairedMisMappedFamilies.add(family);
      }
      candidates.push({
        object,
        name,
        family,
        existing,
        fromFont: reading?.text ?? null,
        rephLigatures: reading?.rephLigatures,
        missing,
        repaired,
      });
    }

    // Second pass: small heading subsets of an already-repaired mis-mapped family (e.g. Mangal-Bold
    // alongside Mangal) need only a single disagreement to be repaired; right-mapped siblings (0
    // disagreements) stay untouched.
    for (const candidate of candidates) {
      if (!candidate.repaired && candidate.fromFont && candidate.family && repairedMisMappedFamilies.has(candidate.family)) {
        candidate.repaired = repairedToUnicode(candidate.existing, candidate.fromFont, {
          siblingRepaired: true,
          rephLigatures: candidate.rephLigatures,
        });
      }
      const repaired = candidate.repaired ?? (candidate.missing ? new Map(candidate.existing) : null);
      if (!repaired) continue;
      if (candidate.missing) {
        repaired.set(0, MISSING_GLYPH_MARK);
        missingGlyphFonts.add(candidate.object);
      }
      const ref: PDFRef = doc.context.register(doc.context.flateStream(buildToUnicode(repaired)));
      candidate.object.set(PDFName.of('ToUnicode'), ref);
      changed = true;
      if (
        repaired.size === candidate.existing.size &&
        [...candidate.existing].every(([code, text]) => code === 0 || repaired.get(code) === text)
      ) {
        continue;
      }
      repairedFonts.push(candidate.name);
      // Re-judged here: a map can both name wrong letters and keep ि in drawing order.
      if (isDrawingOrderOnly(candidate.existing, repaired)) drawingOrderFonts.push(candidate.name);
    }
    const missingGlyphPages = doc.getPages().flatMap((page, index) => (usesFont(page.node.Resources(), missingGlyphFonts, 0) ? [index] : []));
    if (!changed) return { bytes, repairedFonts, drawingOrderFonts, missingGlyphPages };
    return { bytes: await doc.save({ updateFieldAppearances: false }), repairedFonts, drawingOrderFonts, missingGlyphPages };
  } catch {
    return { bytes, repairedFonts: [], drawingOrderFonts: [], missingGlyphPages: [] };
  }
}

/** Whether a resource dictionary, or a form XObject in it (two levels deep), uses one of `fonts`. */
function usesFont(resources: PDFDict | undefined, fonts: ReadonlySet<PDFDict>, depth: number): boolean {
  if (!resources || fonts.size === 0) return false;
  const fontDict = resources.lookup(PDFName.of('Font'));
  if (fontDict instanceof PDFDict && fontDict.keys().some((key) => fonts.has(fontDict.lookup(key) as PDFDict))) return true;
  const xObjects = resources.lookup(PDFName.of('XObject'));
  if (depth >= 2 || !(xObjects instanceof PDFDict)) return false;
  return xObjects.keys().some((key) => {
    const xObject = xObjects.lookup(key);
    const dict = xObject instanceof PDFStream ? xObject.dict : null;
    const inner = dict?.lookup(PDFName.of('Resources'));
    return inner instanceof PDFDict && usesFont(inner, fonts, depth + 1);
  });
}
