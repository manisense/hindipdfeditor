import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfjsDocumentParams } from './pdfjsParams';
import { repairMisMappedToUnicode } from './pdfToUnicodeRepair';

let current: {
  bytes: Uint8Array;
  document: Promise<pdfjs.PDFDocumentProxy>;
  repairedFonts: Promise<string[]>;
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
