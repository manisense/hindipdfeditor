import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfjsDocumentParams } from './pdfjsParams';

let current: { bytes: Uint8Array; document: Promise<pdfjs.PDFDocumentProxy> } | null = null;

/**
 * One pdf.js document per opened file, shared by page rendering and text extraction. Parsing the
 * file once instead of once per call saves memory and time on long documents; opening a different
 * file destroys the previous document.
 *
 * @param bytes Bytes of the opened PDF (the same array for the whole session of one file).
 */
export function sharedPdfDocument(bytes: Uint8Array): Promise<pdfjs.PDFDocumentProxy> {
  if (current?.bytes === bytes) return current.document;
  const previous = current;
  current = { bytes, document: pdfjs.getDocument(pdfjsDocumentParams(bytes.slice())).promise };
  void previous?.document.then((doc) => doc.destroy()).catch(() => undefined);
  return current.document;
}
