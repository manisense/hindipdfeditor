import { buildWordDocument, type WordPage } from './pdfToWord';
import { detectLegacyFonts, isConvertibleLegacyFont } from './legacyFontDetector';
import { detectTextLines, ocrPoolSize } from './ocr';
import { getPageCount, getPageSize, renderPage, setPdfBytes } from './pdfToImages';
import type { Ruling } from './pdfRulings';
import { detectTables } from './tableDetect';
import { pageBlocks } from './wordLayout';
import type { PageState } from '../state/editStore';

/** Scale pages are rendered at for reading, in px per PDF point (as the editor uses). */
const READ_PX_PER_PT = 2;

export type PdfToWordResult = { blob: Blob; pages: number; emptyPages: number };

/**
 * Converts a PDF to an editable Word file in the browser. Each page's text is read the way the
 * editor reads it: the PDF's own text where it is reliable (checked against OCR for Hindi, with
 * unmapped glyphs repaired and KrutiDev converted to Unicode), OCR for scans and for legacy fonts
 * that cannot be converted. Lines become paragraphs with their size, weight and alignment, and
 * ruled tables become Word tables. Pictures and exact positions are not carried over.
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
  // Pages are read side by side, one per OCR worker, and kept in page order.
  const pages: WordPage[] = new Array<WordPage>(total);
  let next = 0;
  let done = 0;
  const readPage = async (pageIndex: number): Promise<WordPage> => {
    const size = await getPageSize(pageIndex, READ_PX_PER_PT);
    const page: PageState = {
      pageIndex,
      widthPt: size.pxWidth / READ_PX_PER_PT,
      heightPt: size.pxHeight / READ_PX_PER_PT,
      // Drawn only if the page needs OCR: digital pages are read from their text.
      backgroundImageUri: '',
      imagePxWidth: size.pxWidth,
      imagePxHeight: size.pxHeight,
      edits: [],
      ocrLines: [],
    };
    const legacy = warnings?.filter((warning) => warning.page === pageIndex) ?? [];
    const unconvertible = warnings === null || legacy.some((warning) => !isConvertibleLegacyFont(warning.fontName));
    const render = async () => {
      const image = await renderPage(pageIndex, READ_PX_PER_PT);
      return { backgroundImageUri: image.uri, imagePxWidth: image.pxWidth, imagePxHeight: image.pxHeight };
    };
    const rulings: Ruling[] = [];
    const lines = await detectTextLines(page, { forceOcr: unconvertible, convertLegacy: legacy.length > 0, render, readTextImages: true, rulings });
    return { widthPt: page.widthPt, heightPt: page.heightPt, blocks: pageBlocks(lines, page.widthPt, detectTables(rulings)) };
  };
  const lanes = Math.max(1, Math.min(total, ocrPoolSize()));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < total) {
        const pageIndex = next++;
        pages[pageIndex] = await readPage(pageIndex);
        done += 1;
        onProgress(done, total);
      }
    }),
  );
  const emptyPages = pages.filter((page) => page.blocks.length === 0).length;
  return { blob: await buildWordDocument(pages), pages: total, emptyPages };
}
