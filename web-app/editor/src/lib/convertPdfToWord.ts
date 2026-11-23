import { buildWordDocument, type WordPage } from './pdfToWord';
import { detectLegacyFonts, isConvertibleLegacyFont } from './legacyFontDetector';
import { detectTextLines } from './ocr';
import { getPageCount, getPageSize, renderPage, setPdfBytes } from './pdfToImages';
import { paragraphsFromLines } from './wordLayout';
import type { PageState } from '../state/editStore';

/** Scale pages are rendered at for reading, in px per PDF point (as the editor uses). */
const READ_PX_PER_PT = 2;

export type PdfToWordResult = { blob: Blob; pages: number; emptyPages: number };

/**
 * Converts a PDF to an editable Word file in the browser. Each page's text is read the way the
 * editor reads it: the PDF's own text where it is reliable (checked against OCR for Hindi, with
 * unmapped glyphs repaired and KrutiDev converted to Unicode), OCR for scans and for legacy fonts
 * that cannot be converted. Lines become paragraphs with their size, weight and alignment.
 * Tables, pictures and exact positions are not carried over.
 *
 * @param onProgress Called after each page with pages done and total.
 */
export async function convertPdfToWord(
  bytes: Uint8Array,
  onProgress: (done: number, total: number) => void,
): Promise<PdfToWordResult> {
  setPdfBytes(bytes);
  const total = await getPageCount();
  // Fails closed: an unreadable font table means every page is read from its image.
  const warnings = await detectLegacyFonts(bytes.slice()).catch(() => null);
  const pages: WordPage[] = [];
  let emptyPages = 0;
  for (let pageIndex = 0; pageIndex < total; pageIndex++) {
    const size = await getPageSize(pageIndex, READ_PX_PER_PT);
    const image = await renderPage(pageIndex, READ_PX_PER_PT);
    const page: PageState = {
      pageIndex,
      widthPt: size.pxWidth / READ_PX_PER_PT,
      heightPt: size.pxHeight / READ_PX_PER_PT,
      backgroundImageUri: image.uri,
      imagePxWidth: image.pxWidth,
      imagePxHeight: image.pxHeight,
      edits: [],
      ocrLines: [],
    };
    const legacy = warnings?.filter((warning) => warning.page === pageIndex) ?? [];
    const unconvertible = warnings === null || legacy.some((warning) => !isConvertibleLegacyFont(warning.fontName));
    const lines = await detectTextLines(page, { forceOcr: unconvertible, convertLegacy: legacy.length > 0 });
    const paragraphs = paragraphsFromLines(lines, page.widthPt);
    if (paragraphs.length === 0) emptyPages += 1;
    pages.push({ widthPt: page.widthPt, heightPt: page.heightPt, paragraphs });
    onProgress(pageIndex + 1, total);
  }
  return { blob: await buildWordDocument(pages), pages: total, emptyPages };
}
