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
 * reading order.
 */

const MIN_DISAGREEMENTS = 3;
const MIN_DISAGREEMENT_SHARE = 0.05;
const DEVANAGARI = /[ऀ-ॿ]/u;
const BFCHAR_BLOCK = 100;

export type ToUnicodeRepair = {
  /** Bytes to read text from: the input itself when nothing was repaired. */
  bytes: Uint8Array;
  /** Base font names whose ToUnicode was replaced. */
  repairedFonts: string[];
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
 * The repaired ToUnicode for a Type0 / CIDFontType2 / Identity font, or null when it needs none.
 * Exported for tests.
 */
export function repairedToUnicode(existing: ReadonlyMap<number, string>, fromFont: ReadonlyMap<number, string>): Map<number, string> | null {
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
  const misMapped = disagree >= MIN_DISAGREEMENTS && disagree / (agree + disagree) >= MIN_DISAGREEMENT_SHARE;
  // A map that names a pre-base ि or reph glyph by its plain letter gives text in drawing order
  // (Word's usual output): "अनुसूिचत". Such maps also tend to leave ligatures unmapped, so their
  // letters vanish. The font's own reading fills them in and orders ि and reph.
  const drawingOrder = [...fromFont].some(([gid, letters]) => {
    const old = existing.get(gid)?.normalize('NFC');
    return (letters === PRE_BASE_MARK && old === 'ि') || (letters === REPH_MARK && old === 'र्');
  });
  if (!misMapped && !drawingOrder) return null;
  const repaired = new Map(existing);
  for (const [gid, letters] of fromFont) {
    if (![...letters].some((c) => DEVANAGARI.test(c) || c === PRE_BASE_MARK || c === REPH_MARK)) continue;
    if (misMapped || !existing.get(gid) || letters.includes(PRE_BASE_MARK) || letters.includes(REPH_MARK)) repaired.set(gid, letters);
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
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict) || object.get(PDFName.of('Subtype')) !== PDFName.of('Type0')) continue;
      if (object.get(PDFName.of('Encoding')) !== PDFName.of('Identity-H')) continue;
      const descendants = object.lookup(PDFName.of('DescendantFonts'));
      const cid = descendants instanceof PDFArray ? descendants.lookup(0) : undefined;
      if (!(cid instanceof PDFDict) || cid.get(PDFName.of('Subtype')) !== PDFName.of('CIDFontType2')) continue;
      const cidToGid = cid.get(PDFName.of('CIDToGIDMap'));
      if (cidToGid !== undefined && cidToGid !== PDFName.of('Identity')) continue;
      const descriptor = cid.lookup(PDFName.of('FontDescriptor'));
      const fontFile = descriptor instanceof PDFDict ? streamBytes(descriptor.lookup(PDFName.of('FontFile2'))) : null;
      const toUnicode = streamBytes(object.lookup(PDFName.of('ToUnicode')));
      if (!fontFile || !toUnicode) continue;
      const existing = parseToUnicode(new TextDecoder('latin1').decode(toUnicode));
      const repaired = repairedToUnicode(existing, fontGlyphText(fontFile).text);
      if (!repaired) continue;
      const ref: PDFRef = doc.context.register(doc.context.flateStream(buildToUnicode(repaired)));
      object.set(PDFName.of('ToUnicode'), ref);
      repairedFonts.push(String(object.get(PDFName.of('BaseFont')) ?? '').replace(/^\//u, ''));
    }
    if (repairedFonts.length === 0) return { bytes, repairedFonts };
    return { bytes: await doc.save({ updateFieldAppearances: false }), repairedFonts };
  } catch {
    return { bytes, repairedFonts: [] };
  }
}
