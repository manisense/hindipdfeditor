import { PDFArray, PDFDict, PDFDocument, PDFName, type PDFPage } from '@cantoo/pdf-lib';

/**
 * Detects pages set in a pre-Unicode legacy Devanagari font (spec Section 9): KrutiDev,
 * Shivaji, Chanakya, DevLys, Walkman-Chanakya, Agra, and Amar. These fonts map Latin
 * keystrokes to Devanagari *shapes* purely visually - the stored bytes are plain
 * ASCII/Latin, not Unicode Devanagari code points - so editing or masking a page using one
 * of these fonts without warning first risks building on top of a text layer that's
 * already fundamentally mismatched with what's visually displayed.
 *
 * Read-only: uses `@cantoo/pdf-lib` only to inspect embedded font names, never to draw text
 * (see ADR 0003, ADR 0001).
 */

/** Case-insensitive prefix patterns matched against each font's true PostScript name. */
const LEGACY_FONT_NAME_PREFIXES = [
  'KrutiDev',
  'Shivaji',
  'Chanakya',
  'DevLys',
  'Walkman-Chanakya',
  'Agra',
  'Amar',
];

/** PDF font subsetting prepends a 6-uppercase-letter tag + `+`, e.g. `ABCDEF+KrutiDev010`. */
const SUBSET_TAG_PATTERN = /^[A-Z]{6}\+/;

/**
 * True if `fontName` (as found in the PDF, subset tag and all) matches one of the known
 * legacy Devanagari font name patterns.
 */
export function isLegacyDevanagariFontName(fontName: string): boolean {
  const withoutSubsetTag = fontName.replace(SUBSET_TAG_PATTERN, '');
  const normalized = withoutSubsetTag.toLowerCase();
  return LEGACY_FONT_NAME_PREFIXES.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

/** Reads a font dict's true PostScript name, checking every place a viewer would look. */
function readFontName(fontDict: PDFDict, doc: PDFDocument): string | undefined {
  const baseFont = fontDict.lookupMaybe(PDFName.of('BaseFont'), PDFName);
  if (baseFont) {
    return baseFont.decodeText();
  }

  const descriptor = fontDict.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
  const descriptorName = descriptor?.lookupMaybe(PDFName.of('FontName'), PDFName);
  if (descriptorName) {
    return descriptorName.decodeText();
  }

  // Type0 (composite/CID) fonts often carry BaseFont/FontDescriptor on the descendant
  // font dict instead of the top-level Type0 dict.
  const descendants = fontDict.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray);
  const firstDescendantRef = descendants?.asArray()[0];
  if (firstDescendantRef) {
    const descendant = doc.context.lookup(firstDescendantRef, PDFDict);
    return readFontName(descendant, doc);
  }

  return undefined;
}

/** Every distinct font name referenced by `page`'s resource dictionary. */
export function getPageFontNames(page: PDFPage, doc: PDFDocument): string[] {
  const resources = page.node.Resources();
  const fontDict = resources?.lookupMaybe(PDFName.of('Font'), PDFDict);
  if (!fontDict) {
    return [];
  }

  const names = new Set<string>();
  for (const [, fontRef] of fontDict.entries()) {
    const resolvedFontDict = doc.context.lookup(fontRef, PDFDict);
    const name = readFontName(resolvedFontDict, doc);
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

export type LegacyFontWarning = { page: number; fontName: string };

/**
 * Loads `pdfBytes` and returns one warning per (page, font name) pair that matches a known
 * legacy Devanagari font pattern. An empty array means no legacy fonts were detected - it
 * does not mean the document is guaranteed Unicode-safe if `PDFDocument.load` itself failed;
 * per AGENTS.md, callers must treat a thrown error here as "unknown encoding," not "safe to
 * proceed," and surface `LegacyFontWarning.tsx` accordingly rather than swallowing it.
 */
export async function detectLegacyFonts(pdfBytes: Uint8Array): Promise<LegacyFontWarning[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const warnings: LegacyFontWarning[] = [];

  doc.getPages().forEach((page, pageIndex) => {
    for (const fontName of getPageFontNames(page, doc)) {
      if (isLegacyDevanagariFontName(fontName)) {
        warnings.push({ page: pageIndex, fontName });
      }
    }
  });

  return warnings;
}
