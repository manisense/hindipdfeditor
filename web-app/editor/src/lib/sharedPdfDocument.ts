import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfjsDocumentParams } from './pdfjsParams';
import { MISSING_GLYPH_MARK, repairMisMappedToUnicode } from './pdfToUnicodeRepair';

let current: {
  bytes: Uint8Array;
  document: Promise<pdfjs.PDFDocumentProxy>;
  repairedFonts: Promise<string[]>;
  drawingOrderFonts: Promise<string[]>;
  missingGlyphPages: Promise<number[]>;
} | null = null;

/**
 * One pdf.js document per opened file, shared by page rendering and text extraction. Parsing the
 * file once instead of once per call saves memory and time on long documents; opening a different
 * file destroys the previous document. Text is read from a copy whose mis-mapped Devanagari
 * ToUnicode maps are rebuilt from the embedded fonts (see pdfToUnicodeRepair.ts); the opened file
 * itself is never changed, and rendering does not depend on ToUnicode.
 *
 * @param bytes Bytes of the opened PDF (the same array for the whole session of one file).
 */
export function sharedPdfDocument(bytes: Uint8Array): Promise<pdfjs.PDFDocumentProxy> {
  if (current?.bytes === bytes) return current.document;
  const previous = current;
  const repair = repairMisMappedToUnicode(bytes);
  current = {
    bytes,
    document: repair.then(({ bytes: readable }) =>
      pdfjs.getDocument(pdfjsDocumentParams(readable === bytes ? bytes.slice() : readable)).promise,
    ),
    repairedFonts: repair.then(({ repairedFonts }) => repairedFonts),
    drawingOrderFonts: repair.then(({ drawingOrderFonts }) => drawingOrderFonts),
    missingGlyphPages: repair.then(({ missingGlyphPages }) => missingGlyphPages),
  };
  void previous?.document.then((doc) => doc.destroy()).catch(() => undefined);
  return current.document;
}

/**
 * Fonts of the opened file whose ToUnicode map was rebuilt from the font itself (empty when none,
 * or when `bytes` is not the opened file).
 *
 * @param bytes Bytes of the opened PDF.
 */
export function repairedFontsOf(bytes: Uint8Array): Promise<string[]> {
  return current?.bytes === bytes ? current.repairedFonts : Promise.resolve([]);
}

/**
 * Repaired fonts of the opened file whose map was only in drawing order (Chrome output merged by
 * other tools): their pages draw their spaces, which are then their only Hindi word breaks.
 *
 * @param bytes Bytes of the opened PDF.
 */
export function drawingOrderFontsOf(bytes: Uint8Array): Promise<string[]> {
  return current?.bytes === bytes ? current.drawingOrderFonts : Promise.resolve([]);
}

/**
 * Pages (0-based) of the opened file that draw text with a font's missing glyph, an empty box,
 * whose text the file does not hold: of the pages that use such a font (see
 * `ToUnicodeRepair.missingGlyphPages`), those whose text holds its mark.
 *
 * @param bytes Bytes of the opened PDF.
 */
export async function missingGlyphPagesOf(bytes: Uint8Array): Promise<number[]> {
  if (current?.bytes !== bytes) return [];
  const [candidates, document] = await Promise.all([current.missingGlyphPages, current.document]);
  const drawn: number[] = [];
  for (const index of candidates) {
    const content = await (await document.getPage(index + 1)).getTextContent();
    if (content.items.some((item) => 'str' in item && item.str.includes(MISSING_GLYPH_MARK))) drawn.push(index);
  }
  return drawn;
}
