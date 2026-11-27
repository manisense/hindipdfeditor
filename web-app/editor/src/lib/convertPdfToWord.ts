import { detectAlignedTables } from './alignedTables';
import { buildWordDocument, type WordDocumentOptions, type WordPage } from './pdfToWord';
import { detectLegacyFonts, isConvertibleLegacyFont } from './legacyFontDetector';
import { detectTextLines, ocrPoolSize, readAreas } from './ocr';
import { mayShowText, type PtBox } from './pdfImageRects';
import { getPageCount, getPageSize, renderPage, renderPageCanvas, setPdfBytes } from './pdfToImages';
import type { Ruling } from './pdfRulings';
import { rulingsFromImage } from './rasterRulings';
import { detectRunningHeadersFooters } from './runningHeaders';
import { missingGlyphPagesOf, sharedPdfDocument } from './sharedPdfDocument';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { detectTables, type DetectedTable } from './tableDetect';
import { pageBlocks, type WordPicture } from './wordLayout';
import type { OcrLine, PageState } from '../state/editStore';

/** Scale pages are rendered at for reading, in px per PDF point (as the editor uses). */
const READ_PX_PER_PT = 2;

export type PdfToWordResult = {
  blob: Blob;
  pages: number;
  emptyPages: number;
  /**
   * Pages (1-based) that needed OCR but were not read (the OCR limit was reached, or OCR was off
   * for a legacy font or Hindi the PDF does not map to Unicode).
   */
  unreadPages: number[];
  /**
   * Pages (1-based) whose PDF draws some text as empty boxes (a font without those letters), so
   * that text is not in the file and is left out.
   */
  missingGlyphPages: number[];
};

/**
 * When pages are read with OCR. `auto`: only pages that need it (scans, text the PDF does not map
 * to Unicode, legacy fonts that cannot be converted). `off`: never; scanned pages come out empty.
 * `all`: every page, for PDFs whose text copies out garbled.
 */
export type OcrChoice = 'auto' | 'off' | 'all';

/** OCR settings for one conversion. */
export type PdfToWordOptions = {
  ocr: OcrChoice;
  /** Most pages read whole with OCR (see `ocrPageLimit`). */
  ocrPageLimit: number;
  /** Zero-based pages to convert, in order; all pages when absent. */
  pages?: readonly number[];
  /** Stops the conversion between pages (it then rejects with an `AbortError`). */
  signal?: AbortSignal;
  /**
   * Pages finished by an earlier, interrupted run of the same job (by position in the job), and
   * where to keep each newly finished page, so a stopped conversion can continue.
   */
  resume?: {
    saved: ReadonlyMap<number, { page: WordPage; unread: boolean }>;
    save: (slot: number, saved: { page: WordPage; unread: boolean }) => Promise<void>;
  };
};

/**
 * Pages of trusted Hindi fonts between OCR spot checks. The editor checks every 8th page; a long
 * conversion checks fewer, since a font has already matched OCR on its first pages.
 */
const CONVERSION_SPOT_CHECK_EVERY = 64;

/**
 * Converts a PDF to an editable Word file in the browser. Each page's text is read the way the
 * editor reads it: the PDF's own text where it is reliable (checked against OCR for Hindi, with
 * unmapped glyphs repaired and KrutiDev converted to Unicode), OCR for scans and for legacy fonts
 * that cannot be converted. Lines become paragraphs with their size, weight and alignment, and
 * tables become Word tables (ruled ones, and ones aligned by space), and pictures (logos, photos, stamps) are placed in reading
 * order. Exact positions are not kept.
 *
 * @param options When to use OCR, and how many pages it may read.
 * @param onProgress Called after each page with pages done and total.
 */
export async function convertPdfToWord(
  bytes: Uint8Array,
  options: PdfToWordOptions,
  onProgress: (done: number, total: number) => void,
): Promise<PdfToWordResult> {
  setPdfBytes(bytes);
  const pageCount = await getPageCount();
  const chosen = options.pages?.filter((index) => index >= 0 && index < pageCount) ?? Array.from({ length: pageCount }, (_, i) => i);
  const total = chosen.length;
  // Fails closed: an unreadable font table means every page is read from its image.
  const warnings = await detectLegacyFonts(bytes.slice()).catch(() => null);
  type RawPage = {
    widthPt: number;
    heightPt: number;
    lines: OcrLine[];
    tables: DetectedTable[];
    pictures: WordPicture[];
  };

  // Pages are read side by side, one per OCR worker, and kept in page order.
  const pages: WordPage[] = new Array<WordPage>(total);
  const rawPages: (RawPage | null)[] = new Array<RawPage | null>(total).fill(null);
  let next = 0;
  let done = 0;
  let ocrPages = 0;
  const unread = new Set<number>();
  /** Takes one page from the OCR budget, or notes the page as unread when OCR is off or spent. */
  const allowPageOcr = (pageIndex: number) => (): boolean => {
    if (options.ocr !== 'off' && ocrPages < options.ocrPageLimit) {
      ocrPages += 1;
      return true;
    }
    unread.add(pageIndex);
    return false;
  };
  const readPage = async (pageIndex: number): Promise<RawPage> => {
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
    const pictureBoxes: PtBox[] = [];
    const allow = allowPageOcr(pageIndex);
    // Text in a legacy font that cannot be converted must not be used; without OCR the page is unread.
    if (unconvertible && !allow()) {
      return { widthPt: page.widthPt, heightPt: page.heightPt, lines: [], tables: [], pictures: [] };
    }
    const forceOcr = unconvertible || (options.ocr === 'all' && allow());
    const lines = await detectTextLines(page, {
      forceOcr,
      ocr: options.ocr === 'off' ? 'off' : undefined,
      allowPageOcr: forceOcr ? undefined : allow,
      spotCheckEvery: CONVERSION_SPOT_CHECK_EVERY,
      convertLegacy: legacy.length > 0,
      render,
      readTextImages: true,
      rulings,
      pictures: pictureBoxes,
    });
    // Without OCR, Hindi the PDF does not map to Unicode is missing letters: list the page.
    if (options.ocr === 'off' && lines.some((line) => line.source === 'embedded-degraded')) unread.add(pageIndex);
    const pictures = await cutPictures(pageIndex, pictureBoxes);
    let tables = detectTables(rulings);
    let pageLines = lines;
    // A scan has no drawn lines to read: find its tables in the page image and read each cell.
    if (tables.length === 0 && lines.length > 0 && lines.every((line) => line.source === 'ocr')) {
      const scanned = await scannedTables(pageIndex);
      if (scanned.length > 0) {
        tables = scanned;
        pageLines = await withCellText(pageIndex, lines, scanned);
      }
    }
    // Tables without drawn lines, found from how their text lines up.
    tables = [...tables, ...detectAlignedTables(pageLines, tables)].sort((a, b) => a.yPt - b.yPt);
    return { widthPt: page.widthPt, heightPt: page.heightPt, lines: pageLines, tables, pictures };
  };
  const lanes = Math.max(1, Math.min(total, ocrPoolSize()));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < total) {
        options.signal?.throwIfAborted();
        const slot = next++;
        const kept = options.resume?.saved.get(slot);
        if (kept) {
          pages[slot] = kept.page;
          if (kept.unread) unread.add(chosen[slot]);
        } else {
          const raw = await readPage(chosen[slot]);
          rawPages[slot] = raw;
          if (options.resume) {
            const provisional: WordPage = {
              widthPt: raw.widthPt,
              heightPt: raw.heightPt,
              blocks: pageBlocks(raw.lines, raw.widthPt, raw.tables, raw.pictures),
            };
            pages[slot] = provisional;
            await options.resume.save(slot, { page: provisional, unread: unread.has(chosen[slot]) });
          }
        }
        done += 1;
        onProgress(done, total);
      }
    }),
  );

  let docOptions: WordDocumentOptions | undefined;
  const allRaw = rawPages.every((raw): raw is RawPage => raw !== null);
  if (allRaw) {
    const running = detectRunningHeadersFooters(rawPages);
    for (let i = 0; i < total; i += 1) {
      const raw = rawPages[i];
      const omitted = running.omittedPerPage[i];
      const bodyLines = omitted.size > 0 ? raw.lines.filter((line) => !omitted.has(line)) : raw.lines;
      pages[i] = {
        widthPt: raw.widthPt,
        heightPt: raw.heightPt,
        blocks: pageBlocks(bodyLines, raw.widthPt, raw.tables, raw.pictures),
      };
    }
    if (running.header.length > 0 || running.footer.length > 0) {
      docOptions = { header: running.header, footer: running.footer };
    }
  } else {
    for (let i = 0; i < total; i += 1) {
      const raw = rawPages[i];
      if (raw && !pages[i]) {
        pages[i] = {
          widthPt: raw.widthPt,
          heightPt: raw.heightPt,
          blocks: pageBlocks(raw.lines, raw.widthPt, raw.tables, raw.pictures),
        };
      }
    }
  }

  const emptyPages = pages.filter((page) => page.blocks.length === 0).length;
  const missingGlyph = new Set(await missingGlyphPagesOf(bytes));
  return {
    blob: await buildWordDocument(pages, docOptions),
    pages: total,
    emptyPages,
    unreadPages: [...unread].sort((a, b) => a - b).map((index) => index + 1),
    missingGlyphPages: chosen.filter((index) => missingGlyph.has(index)).map((index) => index + 1),
  };
}

/** Render scale for pictures, in px per pt (144 dpi: sharp in Word, small files). */
const PICTURE_PX_PER_PT = 2;
/** JPEG quality for pictures. */
const PICTURE_QUALITY = 0.88;

/**
 * Cuts pictures out of one render of the page, as JPEGs, so masked and transparent images look
 * exactly as they do on the page (over white).
 *
 * @param boxes Picture boxes, in pt (top-left origin).
 */
async function cutPictures(pageIndex: number, boxes: readonly PtBox[]): Promise<WordPicture[]> {
  if (boxes.length === 0) return [];
  const canvas = await renderPageCanvas(pageIndex, PICTURE_PX_PER_PT);
  const pictures: WordPicture[] = [];
  for (const box of boxes) {
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(box.wPt * PICTURE_PX_PER_PT));
    crop.height = Math.max(1, Math.round(box.hPt * PICTURE_PX_PER_PT));
    const context = crop.getContext('2d');
    if (!context) continue;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, crop.width, crop.height);
    context.drawImage(canvas, box.xPt * PICTURE_PX_PER_PT, box.yPt * PICTURE_PX_PER_PT, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, 'image/jpeg', PICTURE_QUALITY));
    if (blob) pictures.push({ ...box, jpeg: new Uint8Array(await blob.arrayBuffer()) });
  }
  return pictures;
}

/** Render scale for finding a scan's table lines, in px per pt. */
const SCAN_RULING_PX_PER_PT = 2;
/** How far inside its borders a cell is read, in pt, so border pixels are not read as text. */
const CELL_INSET_PT = 3;

/** Ruled tables found in the page image (for scans). */
async function scannedTables(pageIndex: number): Promise<DetectedTable[]> {
  const canvas = await renderPageCanvas(pageIndex, SCAN_RULING_PX_PER_PT);
  const context = canvas.getContext('2d');
  if (!context) return [];
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return detectTables(rulingsFromImage(data, canvas.width, canvas.height, SCAN_RULING_PX_PER_PT));
}

/**
 * The page's lines with every line inside a table replaced by its cell's own reading: full-page
 * OCR runs a table row across its cells, while each cell read alone keeps its text in place.
 */
async function withCellText(pageIndex: number, lines: readonly OcrLine[], tables: readonly DetectedTable[]): Promise<OcrLine[]> {
  const cells = tables.flatMap((table) => table.cells);
  const inside = (line: OcrLine) => {
    const x = line.xPt + line.wPt / 2;
    const y = line.yPt + line.hPt / 2;
    return tables.some((t) => x >= t.xPt && x <= t.xPt + t.wPt && y >= t.yPt && y <= t.yPt + t.hPt);
  };
  const areas = cells.map((cell) => ({
    xPt: cell.xPt + CELL_INSET_PT,
    yPt: cell.yPt + CELL_INSET_PT,
    wPt: Math.max(1, cell.wPt - 2 * CELL_INSET_PT),
    hPt: Math.max(1, cell.hPt - 2 * CELL_INSET_PT),
  }));
  const texts = await readAreas(pageIndex, areas);
  const cellLines: OcrLine[] = [];
  areas.forEach((area, i) => {
    const text = texts[i]?.trim();
    if (!text) return;
    // Font size from the cell's own OCR lines when there are any, else from a typical row.
    const sizes = lines.filter((line) => {
      const x = line.xPt + line.wPt / 2;
      const y = line.yPt + line.hPt / 2;
      return x >= area.xPt && x <= area.xPt + area.wPt && y >= area.yPt && y <= area.yPt + area.hPt;
    });
    const hPt = sizes.length > 0 ? Math.min(...sizes.map((line) => line.hPt)) : Math.min(area.hPt, 14);
    cellLines.push({ id: crypto.randomUUID(), text, xPt: area.xPt, yPt: area.yPt, wPt: area.wPt, hPt, source: 'ocr' });
  });
  return [...lines.filter((line) => !inside(line)), ...cellLines];
}

/** What a quick look at a PDF's text layer found (see {@link sampleTextLayer}). */
export type TextLayerSample = {
  pages: number;
  sampled: number;
  /** Sampled pages with no text layer that show something to read (scans); blank pages are not counted. */
  withoutText: number;
};

/**
 * Looks at up to `samples` pages spread through the PDF for selectable text, so the screen can
 * say before converting how many pages will need OCR. Reads text only, no images: a few ms a page.
 *
 * @param samples Most pages looked at.
 */
export async function sampleTextLayer(bytes: Uint8Array, samples = 12): Promise<TextLayerSample> {
  const doc = await sharedPdfDocument(bytes);
  const pages = doc.numPages;
  const picks = [...new Set(Array.from({ length: Math.min(samples, pages) }, (_, i) => Math.floor((i * pages) / Math.min(samples, pages))))];
  let withoutText = 0;
  for (const index of picks) {
    const page = await doc.getPage(index + 1);
    const content = await page.getTextContent();
    if (!content.items.some((item) => 'str' in item && /\S/u.test(item.str)) && mayShowText((await page.getOperatorList()).fnArray, OPS)) {
      withoutText += 1;
    }
    page.cleanup();
  }
  return { pages, sampled: picks.length, withoutText };
}
