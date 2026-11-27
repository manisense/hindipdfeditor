import {
  createWorker,
  PSM,
  type Worker,
  type Page as TesseractPage,
} from "tesseract.js";

import {
  imagePxSizeToPt,
  imagePxToPt,
  ptSizeToImagePx,
  ptToImagePx,
} from "./coordinateMath";
import { cleanCellReading } from "./cellReading";
import { eraseCellBorders } from "./rasterRulings";
import { aiApiClient } from "./aiApiClient";
import { warmLanguageData } from "./ocrLanguageData";
import {
  canJudgeDevanagari,
  combineEmbeddedLatinWithOcr,
  hasDevanagari,
  hasIntrinsicDevanagariCorruption,
  isEmbeddedDevanagariCorrupted,
  isLikelyOcrNoise,
  readsAsHindi,
  joinSplitHindiWords,
  missedDevanagariRows,
  embeddedDevanagariVerdict,
  trimOcrBorderNoise,
  verificationSample,
  type PtBox,
} from "./embeddedTextVerification";
import { mergeOcrLines, mergeWordReadings, type RecognizedWord } from "./mergeOcrLines";
import { textBandOfLine } from "./ocrLineGeometry";
import {
  hasFailedFont,
  mustVerifyPage,
  newFontTrust,
  noteSkippedPage,
  recordVerifiedBand,
  recordVerifiedPage,
  type FontTrust,
} from "./embeddedTextTrust";
import { currentDeviceHints, poolSizeFor } from "./ocrPoolSize";
import { mayShowText, stackStrips, type PtBox as ImageBox } from "./pdfImageRects";
import { repairedFontsOf, sharedPdfDocument } from "./sharedPdfDocument";
import { loadHindiSpeller } from "./hindiDictionary";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Ruling } from "./pdfRulings";
import { extractEmbeddedTextLines } from "./pdfTextExtract";
import {
  hasGlyphPlaceholder,
  isGlyphPlaceholder,
  learnDocumentGlyphs,
  ocrConfirmsRepair,
  ocrLineFor,
  pairLinesWithOcr,
  repairText,
  spacedLike,
} from "./glyphRepair";
import { getPdfBytes, renderPageCanvas, renderRegion } from "./pdfToImages";
import type { RecognizedLine } from "./recognizedLine";
import type { OcrLine, PageState } from "../state/editStore";

/**
 * OCR engine, worker and language data are served from this site (copied from pinned npm
 * packages by `scripts/copy-ocr-assets.mjs`), not from a CDN that office networks may block.
 * Absolute URLs: the worker runs from a blob URL, where relative paths do not resolve.
 */
function ocrAssetOptions() {
  const base = new URL("/edit/ocr/", window.location.origin).href;
  return {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
  };
}

const unavailableListeners = new Set<() => void>();

/**
 * Subscribes to "OCR could not run" (engine or language data failed to load). The editor shows a
 * notice, because pages then keep their PDF text without the Hindi check.
 *
 * @returns Unsubscribe function.
 */
export function onOcrUnavailable(listener: () => void): () => void {
  unavailableListeners.add(listener);
  return () => unavailableListeners.delete(listener);
}

function reportOcrUnavailable(error: unknown): void {
  console.warn("OCR is unavailable", error);
  for (const listener of unavailableListeners) listener();
}

/**
 * Starting a worker from language data already in memory takes seconds; the download itself is
 * timed separately in `ocrLanguageData.ts`, by stalls rather than total time.
 */
const OCR_LOAD_TIMEOUT_MS = 60_000;

type OcrLanguage = "hin" | "eng";
type PooledWorker = { worker: Promise<Worker>; busy: number };
/**
 * How a worker segments what it reads: `page` finds a page's layout (Tesseract's default); `block`
 * reads one block of text, which is right for a table cell or one row cut from a page and misses
 * far fewer short items (a lone "14") than page layout analysis does. Each mode has its own
 * workers, so changing the mode never affects a page being read at the same time.
 */
type OcrMode = "page" | "block";
const pools = new Map<string, PooledWorker[]>();

/** How many OCR workers per language may run at once on this device (see `poolSizeFor`). */
export function ocrPoolSize(): number {
  return poolSizeFor(currentDeviceHints());
}

/**
 * Loads one OCR worker once its language data is in the browser cache. tesseract.js never
 * settles `createWorker` when it fails (the error escapes as an uncaught exception), which left
 * pages "Finding text…" forever; worker errors and a timeout now reject instead, and the failure
 * is reported.
 */
async function loadWorker(language: OcrLanguage, mode: OcrMode): Promise<Worker> {
  const options = ocrAssetOptions();
  await warmLanguageData(language, options.langPath);
  return new Promise<Worker>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`OCR worker for ${language} did not start in time`)),
      OCR_LOAD_TIMEOUT_MS,
    );
    createWorker(language, 1, {
      ...options,
      errorHandler: (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    }).then(
      (worker) => {
        window.clearTimeout(timer);
        if (mode === "page") resolve(worker);
        else worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK }).then(() => resolve(worker), reject);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function addWorker(language: OcrLanguage, mode: OcrMode): PooledWorker {
  const key = `${language}:${mode}`;
  const pool = pools.get(key) ?? [];
  pools.set(key, pool);
  const entry: PooledWorker = { worker: loadWorker(language, mode), busy: 0 };
  pool.push(entry);
  // A worker that fails to load leaves the pool, so the next call tries again.
  entry.worker.catch((error: unknown) => {
    pool.splice(pool.indexOf(entry), 1);
    reportOcrUnavailable(error);
  });
  return entry;
}

/**
 * Runs one OCR job on an idle worker: another worker is started while all are busy, up to
 * {@link ocrPoolSize}; after that the least busy worker queues it.
 */
async function withWorker<T>(
  language: OcrLanguage,
  job: (worker: Worker) => Promise<T>,
  mode: OcrMode = "page",
): Promise<T> {
  const pool = pools.get(`${language}:${mode}`) ?? [];
  let entry = pool.find((candidate) => candidate.busy === 0);
  if (!entry && pool.length < ocrPoolSize()) entry = addWorker(language, mode);
  entry ??= pool.reduce((least, candidate) => (candidate.busy < least.busy ? candidate : least));
  entry.busy += 1;
  try {
    return await job(await entry.worker);
  } finally {
    entry.busy -= 1;
  }
}

type TesseractWord = TesseractPage["blocks"] extends (infer B)[] | null
  ? B extends { paragraphs: { lines: { words: (infer W)[] }[] }[] }
    ? W
    : never
  : never;

function toRecognizedWord(word: TesseractWord): RecognizedWord {
  return {
    text: word.text.trim(),
    x: word.bbox.x0,
    y: word.bbox.y0,
    width: word.bbox.x1 - word.bbox.x0,
    height: word.bbox.y1 - word.bbox.y0,
    confidence: word.confidence,
  };
}

function tesseractPageWords(page: TesseractPage): RecognizedWord[] {
  return (page.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) => line.words.map(toRecognizedWord)),
    ),
  );
}

/**
 * @param latinWords English-model words of the same page; when given, English words inside
 *   Hindi lines take the English reading (see `mergeWordReadings`).
 */
/** Word confidence (0–100) counted as sure in {@link RecognizedLine.sureWordShare}. */
const SURE_WORD_CONFIDENCE = 60;

function tesseractPageToRecognized(
  page: TesseractPage,
  latinWords?: readonly RecognizedWord[],
): RecognizedLine[] {
  const lines: RecognizedLine[] = [];

  const pushLine = (
    text: string,
    bbox: { x0: number; y0: number; x1: number; y1: number },
    confidence?: number,
    baseline?: number,
    sureWordShare?: number,
  ) => {
    const trimmed = trimOcrBorderNoise(text.trim());
    if (trimmed.length === 0) return;
    lines.push({
      text: trimmed,
      x: bbox.x0,
      y: bbox.y0,
      width: bbox.x1 - bbox.x0,
      height: bbox.y1 - bbox.y0,
      confidence,
      ...(baseline !== undefined ? { baseline } : {}),
      ...(sureWordShare !== undefined ? { sureWordShare } : {}),
    });
  };

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        pushLine(
          latinWords
            ? mergeWordReadings(line.words.map(toRecognizedWord), latinWords)
            : line.text,
          textBandOfLine(
            line.bbox,
            line.words.map((word) => word.bbox),
          ),
          line.confidence,
          line.baseline?.has_baseline
            ? (line.baseline.y0 + line.baseline.y1) / 2
            : undefined,
          line.words.length > 0
            ? line.words.filter((word) => word.confidence >= SURE_WORD_CONFIDENCE).length / line.words.length
            : undefined,
        );
      }
    }
  }

  // tesseract.js sometimes omits nested blocks but still fills top-level lines/words.
  if (lines.length === 0) {
    const pageExtra = page as TesseractPage & {
      lines?: {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }[];
      words?: {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }[];
    };
    for (const line of pageExtra.lines ?? []) {
      pushLine(line.text, line.bbox);
    }
    if (lines.length === 0) {
      for (const word of pageExtra.words ?? []) {
        pushLine(word.text, word.bbox);
      }
    }
  }

  return lines;
}

function toOcrLines(lines: RecognizedLine[], page: PageState): OcrLine[] {
  return lines
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((line) => {
      const { xPt, yPt } = imagePxToPt(
        line.x,
        line.y,
        page.imagePxWidth,
        page.widthPt,
      );
      const { wPt, hPt } = imagePxSizeToPt(
        line.width,
        line.height,
        page.imagePxWidth,
        page.widthPt,
      );
      return {
        id: crypto.randomUUID(),
        text: line.text.normalize("NFC"),
        xPt,
        yPt,
        wPt,
        hPt,
        source: "ocr" as const,
        ...(line.baseline !== undefined
          ? { baselineYPt: imagePxToPt(0, line.baseline, page.imagePxWidth, page.widthPt).yPt }
          : {}),
      };
    });
}

async function recognizePage(
  imageUri: string,
  language: "hin" | "eng",
): Promise<TesseractPage> {
  // tesseract.js v6 returns no blocks (so no lines or words) unless asked for them.
  const { data } = await withWorker(language, (worker) => worker.recognize(imageUri, {}, { blocks: true }));
  return data;
}

async function recognizeWithLanguage(
  imageUri: string,
  language: "hin" | "eng",
): Promise<RecognizedLine[]> {
  return tesseractPageToRecognized(await recognizePage(imageUri, language));
}

/**
 * Hindi OCR text of an area of the page image, a little larger than the area so edge letters
 * are whole.
 *
 * @param area Area, in pt (top-left origin).
 */
async function recognizeArea(page: PageState, area: PtBox): Promise<string> {
  const pad = 6;
  const { x, y } = ptToImagePx(Math.max(0, area.xPt - pad), Math.max(0, area.yPt - pad), page.imagePxWidth, page.widthPt);
  const { wPx, hPx } = ptSizeToImagePx(area.wPt + 2 * pad, area.hPt + 2 * pad, page.imagePxWidth, page.widthPt);
  const { data } = await withWorker("hin", (worker) =>
    worker.recognize(page.backgroundImageUri, {
      rectangle: {
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(Math.min(wPx, page.imagePxWidth - x)),
        height: Math.round(Math.min(hPx, page.imagePxHeight - y)),
      },
    }),
  );
  return data.text;
}

/** Hindi OCR of one rectangle of the page, for rows full-page OCR skipped. */
async function recognizeRow(
  page: PageState,
  crop: PtBox,
  line: PtBox & Pick<OcrLine, "baselineYPt" | "font">,
): Promise<OcrLine | null> {
  const { x, y } = ptToImagePx(crop.xPt, crop.yPt, page.imagePxWidth, page.widthPt);
  const { wPx, hPx } = ptSizeToImagePx(crop.wPt, crop.hPt, page.imagePxWidth, page.widthPt);
  const { data } = await withWorker("hin", (worker) =>
    worker.recognize(page.backgroundImageUri, {
      rectangle: {
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(Math.min(wPx, page.imagePxWidth - x)),
        height: Math.round(Math.min(hPx, page.imagePxHeight - y)),
      },
    }),
  );
  const text = trimOcrBorderNoise(data.text.replace(/\s+/gu, " ")).normalize("NFC");
  if (!hasDevanagari(text)) return null;
  return { id: crypto.randomUUID(), text, ...line, source: "embedded-degraded" };
}

/**
 * The page's own lines with their unmapped glyphs repaired (see glyphRepair.ts), learned from this
 * page's OCR and every page read before it, and re-spaced like OCR. Rows with a line whose glyphs
 * could not all be repaired are left out (OCR reads them).
 *
 * @returns The repaired lines, or null when the page has nothing to repair or the repaired Hindi
 *   does not agree with OCR.
 */
async function repairedEmbeddedLines(
  pdfBytes: Uint8Array,
  page: PageState,
  convertLegacy: boolean | undefined,
  ocrLines: OcrLine[],
  ocrText: string,
): Promise<OcrLine[] | null> {
  const withGlyphs = await extractEmbeddedTextLines(pdfBytes, page.pageIndex, {
    convertLegacy,
    keepGlyphPlaceholders: true,
  });
  if (!withGlyphs.some((line) => hasGlyphPlaceholder(line.text))) return null;
  // Lines with unmapped glyphs are read again from a sharp render of their own area; their OCR
  // then teaches and confirms the glyphs. Other lines use the page's OCR.
  const sharp = await sharpLineOcr(page, withGlyphs.filter((line) => hasGlyphPlaceholder(line.text)));
  const ocrFor = (line: OcrLine) => ocrLineFor(line, sharp) ?? ocrLineFor(line, ocrLines);
  const readings = learnDocumentGlyphs(pdfBytes, [
    ...pairLinesWithOcr(withGlyphs, sharp),
    ...pairLinesWithOcr(withGlyphs.filter((line) => !ocrLineFor(line, sharp)), ocrLines),
  ]);
  const lines = withGlyphs.map((line) => ({ ...line, text: repairText(line.text, readings, isGlyphPlaceholder) }));
  // A repaired word must also be in OCR of its line: a reading learned from one misread word
  // must not put a wrong letter into the text.
  const confirmed = (line: OcrLine, drawn: string) =>
    ocrConfirmsRepair(drawn, ocrFor(line)?.text ?? "", readings, isGlyphPlaceholder);
  // A row with any line left unrepaired or unconfirmed is read by OCR as a whole: OCR does not
  // split rows the way the text layer does, so keeping part of the row would lose the rest.
  const unresolved = lines.filter(
    (line, i) => hasGlyphPlaceholder(line.text) || !confirmed(line, withGlyphs[i].text),
  );
  const repaired = lines
    .filter((line) => !unresolved.some((open) => sameBand(open, line)))
    .map((line) => {
      const ocr = hasDevanagari(line.text) ? ocrFor(line) : null;
      return ocr ? { ...line, text: spacedLike(line.text, ocr.text) } : line;
    });
  const hindi = repaired.filter((line) => hasDevanagari(line.text));
  if (hindi.length === 0) return null;
  if (isEmbeddedDevanagariCorrupted(hindi.map((line) => line.text).join(" "), ocrText)) return null;
  return repaired;
}

/** Render scale for re-reading lines, in px per pt: small print needs it, page images are 2. */
const SHARP_OCR_PX_PER_PT = 4;
/** Most lines re-read per page, so a page full of unmapped glyphs stays quick. */
const MAX_SHARP_LINES = 20;

/**
 * Hindi OCR of each line's own area rendered sharply from the PDF, with the line's box. Lines
 * that fail to read are left out.
 */
async function sharpLineOcr(page: PageState, lines: OcrLine[]): Promise<OcrLine[]> {
  const read: OcrLine[] = [];
  for (const line of lines.slice(0, MAX_SHARP_LINES)) {
    const padX = line.hPt * 0.5;
    const padY = line.hPt * 0.35;
    const rect = {
      xPt: Math.max(0, line.xPt - padX),
      yPt: Math.max(0, line.yPt - padY),
      wPt: Math.min(page.widthPt, line.xPt + line.wPt + padX) - Math.max(0, line.xPt - padX),
      hPt: Math.min(page.heightPt, line.yPt + line.hPt + padY) - Math.max(0, line.yPt - padY),
    };
    try {
      const image = await renderRegion(page.pageIndex, rect, SHARP_OCR_PX_PER_PT);
      const { data } = await withWorker("hin", (worker) => worker.recognize(image));
      const text = trimOcrBorderNoise(data.text.replace(/\s+/gu, " ")).normalize("NFC");
      if (text) read.push({ ...line, text });
    } catch (error) {
      console.warn("Sharp line OCR failed", error);
    }
  }
  return read;
}

/** Whether two line boxes share at least half the smaller one's height (pt): one visual row. */
function sameBand(a: OcrLine, b: OcrLine): boolean {
  const v = Math.min(a.yPt + a.hPt, b.yPt + b.hPt) - Math.max(a.yPt, b.yPt);
  return v >= 0.5 * Math.min(a.hPt, b.hPt);
}

/** Whether two line boxes share at least half the smaller one's height and some width (pt). */
function sameRow(a: OcrLine, b: OcrLine): boolean {
  const v = Math.min(a.yPt + a.hPt, b.yPt + b.hPt) - Math.max(a.yPt, b.yPt);
  const h = Math.min(a.xPt + a.wPt, b.xPt + b.wPt) - Math.max(a.xPt, b.xPt);
  return v >= 0.5 * Math.min(a.hPt, b.hPt) && h > 0;
}

/** Most Devanagari lines read one by one when a page has too few words to judge; more read the page. */
const FEW_DEVANAGARI_LINES = 8;

/**
 * Checks embedded lines that contain Devanagari against Hindi OCR of the page. When the text layer
 * lost characters (`embedded-degraded`) or its ToUnicode map is corrupted, the positions of its
 * Devanagari runs are not trustworthy either, so Hindi lines come from image OCR and Latin lines
 * from the PDF (see `combineEmbeddedLatinWithOcr`); Hindi rows page OCR skipped are read one
 * rectangle at a time. If OCR fails or finds no Hindi, the embedded lines are returned unchanged.
 *
 * @param record Called with what each check read, so the fonts can be trusted (see
 *   embeddedTextTrust.ts): `band` when the quick band check passed, `page` after a full-page read.
 * @param allowPageOcr Asked before reading the whole page; false keeps the embedded lines.
 */
async function verifyEmbeddedDevanagari(
  embedded: OcrLine[],
  page: PageState,
  pdfBytes: Uint8Array,
  convertLegacy?: boolean,
  record?: { band: (bandText: string, bandOcrText: string) => void; page: (hindiText: string) => void },
  allowPageOcr?: () => boolean,
  fontFailed = false,
): Promise<OcrLine[]> {
  // Fonts repaired from their own cmap give exact letters, but some producers leave gaps inside
  // words; the dictionary joins those before anything is judged.
  if ((await repairedFontsOf(pdfBytes)).length > 0) {
    const speller = await loadHindiSpeller().catch(() => null);
    if (speller) {
      const isKnown = (word: string) => speller.isKnown(word);
      embedded = embedded.map((line) => (hasDevanagari(line.text) ? { ...line, text: joinSplitHindiWords(line.text, isKnown) } : line));
    }
  }
  const degraded = embedded.some((line) => line.source === "embedded-degraded");
  if (!degraded && !embedded.some((line) => hasDevanagari(line.text))) {
    return embedded;
  }
  try {
    // Too little Devanagari for a verdict: the page keeps its text whatever OCR reads, so only
    // its Devanagari lines are read (as evidence for its fonts), not the whole page — unless the
    // page already shows intrinsic corruption (mixed unrelated scripts or glued words) or uses a
    // font that already failed on an earlier page.
    const converted = Boolean(convertLegacy);
    const devanagariLines = embedded.filter((line) => hasDevanagari(line.text));
    const devanagariText = devanagariLines.map((line) => line.text).join(" ");
    const intrinsicCorruption = !converted && hasIntrinsicDevanagariCorruption(devanagariText);
    if (
      !degraded &&
      !fontFailed &&
      !intrinsicCorruption &&
      devanagariLines.length <= FEW_DEVANAGARI_LINES &&
      !canJudgeDevanagari(devanagariText)
    ) {
      const texts: string[] = [];
      for (const line of devanagariLines) texts.push(await recognizeArea(page, line));
      record?.page(texts.join(" "));
      return embedded;
    }
    // A band of the page's lines is enough to judge it, and OCR of the band takes a fraction of
    // the time. Only a passing band skips the full page; anything else reads the whole page.
    const sample = degraded || fontFailed || intrinsicCorruption ? null : verificationSample(embedded);
    if (sample) {
      const bandOcr = await recognizeArea(page, sample);
      if (embeddedDevanagariVerdict(sample.text, bandOcr, { converted }) === "ok") {
        record?.band(sample.text, bandOcr);
        return embedded;
      }
    }
    if (allowPageOcr?.() === false) return embedded;
    const hindiPage = await recognizePage(page.backgroundImageUri, "hin");
    record?.page(hindiPage.text);
    const embeddedText = embedded.map((line) => line.text).join(" ");
    if (!degraded && !isEmbeddedDevanagariCorrupted(embeddedText, hindiPage.text, { converted, fontFailed })) {
      return embedded;
    }
    // Text repaired from its own font is kept when it reads as Hindi, though OCR of the page
    // disagrees: Tesseract misreads tables and small print far more often than a font lies.
    if (!degraded && !converted && !intrinsicCorruption && (await repairedFontsOf(pdfBytes)).length > 0) {
      const speller = await loadHindiSpeller().catch(() => null);
      if (speller && readsAsHindi(embeddedText, (word) => speller.isKnown(word))) return embedded;
    }
    // English names, IDs and dates inside Hindi lines are read by the English model.
    const hasMixedLines = embedded.some(
      (line) => hasDevanagari(line.text) && /[A-Za-z]/.test(line.text),
    );
    const latinWords = hasMixedLines
      ? tesseractPageWords(await recognizePage(page.backgroundImageUri, "eng"))
      : undefined;
    const hindiLines = toOcrLines(
      tesseractPageToRecognized(hindiPage, latinWords).filter(
        (line) => !isLikelyOcrNoise(line.text, line.confidence),
      ),
      page,
    );
    if (!hindiLines.some((line) => hasDevanagari(line.text))) return embedded;
    const rescued: OcrLine[] = [];
    for (const { crop, line: rowBox } of missedDevanagariRows(embedded, hindiLines)) {
      const line = await recognizeRow(page, crop, rowBox);
      if (line) rescued.push(line);
    }
    const fromOcr = combineEmbeddedLatinWithOcr(embedded, [...hindiLines, ...rescued]);
    // Lines whose glyphs were all repaired keep the PDF's own text and positions; OCR fills in
    // the rest.
    const repaired = await repairedEmbeddedLines(pdfBytes, page, convertLegacy, [...hindiLines, ...rescued], hindiPage.text);
    if (!repaired) return fromOcr;
    return [...repaired, ...fromOcr.filter((line) => !repaired.some((kept) => sameRow(kept, line)))];
  } catch (error) {
    reportOcrUnavailable(error);
    return embedded;
  }
}

/**
 * Detects tappable text on one page. Prefers embedded PDF text (digital docs like Word
 * exports), checking any Devanagari in it against Hindi OCR because some PDFs carry a broken
 * text map; falls back to browser Tesseract for scanned/image-only pages.
 *
 * @param page The page whose `backgroundImageUri` / page index to scan.
 * @param options.forceOcr When true, skip embedded text (use for legacy-font PDFs whose
 *   embedded strings are mojibake, not Unicode Devanagari).
 */
export async function detectTextLines(
  page: PageState,
  options?: PageReadOptions,
): Promise<OcrLine[]> {
  return readPageLines(page, options);
}

/**
 * Lines of text drawn as images that stand on their own (headings, titles, table labels): image
 * rows the page's text layer does not cover and that do not overlap any of `lines`, read with OCR.
 * Words drawn as images inside a text line are left out, because replacing that line would delete
 * its text but leave the image word under the new text. Each returned line is `ocr`, so replacing
 * it cleans its pixels like a scan's.
 *
 * @param lines The page's lines already found, boxes in pt.
 */
export async function detectTextImageLines(page: PageState, lines: readonly OcrLine[]): Promise<OcrLine[]> {
  const pdfBytes = getPdfBytes();
  if (!pdfBytes) return [];
  const rows: ImageBox[] = [];
  await extractEmbeddedTextLines(pdfBytes, page.pageIndex, { textImageRows: rows });
  const overlap = (a: ImageBox, b: ImageBox) =>
    Math.max(0, Math.min(a.xPt + a.wPt, b.xPt + b.wPt) - Math.max(a.xPt, b.xPt)) *
    Math.max(0, Math.min(a.yPt + a.hPt, b.yPt + b.hPt) - Math.max(a.yPt, b.yPt));
  const alone = rows.filter((row) => !lines.some((line) => overlap(row, line) > 0.1 * row.wPt * row.hPt));
  if (alone.length === 0) return [];
  const texts = await readImageRows(page.pageIndex, alone);
  return alone.flatMap((row, i) => {
    const text = texts[i]?.trim();
    return text ? [{ id: crypto.randomUUID(), text, ...row, baselineYPt: row.yPt + row.hPt * 0.8, source: "ocr" as const }] : [];
  });
}

/**
 * Reads areas of a page with OCR, each on its own (Hindi, English when an area has no
 * Devanagari): table cells of a scanned page, where full-page OCR runs rows across cells.
 *
 * @param areas Areas, in pt (top-left origin), already inside any borders.
 * @returns Each area's text, or null when nothing readable was found.
 */
export function readAreas(pageIndex: number, areas: ImageBox[]): Promise<(string | null)[]> {
  return areas.length > 0 ? readImageRows(pageIndex, areas, true) : Promise.resolve([]);
}

/** Whether text has Devanagari letters or signs (not just Devanagari digits or dandas). */
function hasDevanagariLetters(text: string): boolean {
  return /[\u0900-\u0963\u0971-\u097F]/u.test(text);
}

/** Render scale for text drawn as images, in px per pt (such images are often 600 ppi). */
const TEXT_IMAGE_PX_PER_PT = 4;
/** Lowest Tesseract confidence (0–100) at which an image row's reading is kept. */
const MIN_TEXT_IMAGE_CONFIDENCE = 35;
/** The same for readings with no Devanagari. */
const MIN_LATIN_TEXT_IMAGE_CONFIDENCE = 60;

/**
 * Reads rows of text drawn as images: the page is rendered once and each row is cut from that
 * render and read on its own, as one block of text (rows spread over the OCR worker pool). Hindi
 * first; a row with no Devanagari letters is read again in English, kept only when it has Latin
 * letters and at least the Hindi reading's confidence (numbers and dates read fine in Hindi).
 * With `bothLanguages` (scanned table cells, as often English as Hindi) both models read every
 * area and the better reading wins.
 *
 * @param rows Areas, in pt (top-left origin).
 * @returns Each row's text, or null when nothing readable was found.
 */
async function readImageRows(pageIndex: number, rows: ImageBox[], bothLanguages = false): Promise<(string | null)[]> {
  const pageCanvas = await renderPageCanvas(pageIndex, TEXT_IMAGE_PX_PER_PT);
  const { strips } = stackStrips(rows, { widthPx: pageCanvas.width, heightPx: pageCanvas.height }, TEXT_IMAGE_PX_PER_PT, 2);
  const crops = strips.map((strip) => {
    const margin = 12;
    const crop = document.createElement("canvas");
    crop.width = strip.w + 2 * margin;
    crop.height = strip.h + 2 * margin;
    const context = crop.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, crop.width, crop.height);
    context.drawImage(pageCanvas, strip.sx, strip.sy, strip.w, strip.h, margin, margin, strip.w, strip.h);
    if (bothLanguages) {
      // Table cells: borders at the crop's edges are read as letters (। | ० :) otherwise.
      const cell = context.getImageData(margin, margin, strip.w, strip.h);
      eraseCellBorders(cell.data, strip.w, strip.h, TEXT_IMAGE_PX_PER_PT);
      context.putImageData(cell, margin, margin);
    }
    return crop;
  });
  const read = async (language: OcrLanguage, crop: HTMLCanvasElement) => {
    const { data } = await withWorker(language, (worker) => worker.recognize(crop, {}, { blocks: bothLanguages }), "block");
    let raw = data.text;
    let confidence = data.confidence;
    if (bothLanguages) {
      // Table cells: speckle in a cell's empty part reads as short, unsure words at its ends.
      const words = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)),
      );
      const cleaned = cleanCellReading(words.map((word) => ({ text: word.text.trim(), confidence: word.confidence })));
      raw = cleaned?.text ?? "";
      confidence = cleaned?.confidence ?? 0;
    }
    const text = trimOcrBorderNoise(raw.replace(/[\u200c\u200d]/gu, "").replace(/\s+/gu, " ")).normalize("NFC").trim();
    // Image rows are small and their own context: full-page noise rules reject good readings of
    // them (a quoted word at 54 % confidence). Keep any reading with letters or digits.
    // Latin-only readings need more confidence: signatures and logos read as stray Latin letters.
    const minimum = hasDevanagariLetters(text) ? MIN_TEXT_IMAGE_CONFIDENCE : MIN_LATIN_TEXT_IMAGE_CONFIDENCE;
    const readable = /[\p{L}\p{N}]/u.test(text) && confidence >= minimum;
    return { text: readable ? text : "", confidence };
  };
  return Promise.all(
    crops.map(async (crop) => {
      if (!bothLanguages) {
        // Rows of a digital page are mostly Hindi: English only when Hindi found no letters.
        const hindi = await read("hin", crop);
        if (hasDevanagariLetters(hindi.text) || /^[\p{N}\s.,:;/()%+\-–—]+$/u.test(hindi.text)) return hindi.text || null;
        const english = await read("eng", crop);
        if (/[A-Za-z]/.test(english.text) && english.confidence >= hindi.confidence) return english.text;
        return hindi.text || null;
      }
      // Both models read each area: the Hindi model turns a Latin word into junk (often with a
      // Devanagari digit), and the English one cannot read Hindi. Hindi wins when it found
      // Devanagari letters and is about as sure; otherwise the surer reading wins.
      const [hindi, english] = await Promise.all([read("hin", crop), read("eng", crop)]);
      if (!english.text) return hindi.text || null;
      if (!hindi.text) return english.text;
      if (hasDevanagariLetters(hindi.text) && hindi.confidence >= english.confidence - 10) return hindi.text;
      return english.confidence >= hindi.confidence ? english.text : hindi.text;
    }),
  );
}

async function readPageLines(
  page: PageState,
  options: PageReadOptions | undefined,
): Promise<OcrLine[]> {
  const pdfBytes = getPdfBytes();
  // The page image is drawn only when OCR needs it (when the caller passes `render`).
  const withImage = async (): Promise<PageState> =>
    page.backgroundImageUri || !options?.render ? page : { ...page, ...(await options.render()) };
  if (!options?.forceOcr && pdfBytes) {
    try {
      const textByFont = new Map<string, string>();
      const embedded = await extractEmbeddedTextLines(pdfBytes, page.pageIndex, {
        convertLegacy: options?.convertLegacy,
        devanagariTextByFont: textByFont,
        readTextImages: options?.readTextImages && options.ocr !== "off" ? (rows) => readImageRows(page.pageIndex, rows) : undefined,
        rulings: options?.rulings,
        pictures: options?.pictures,
      });
      if (embedded.length > 0) {
        if (options?.ocr === "off") return embedded;
        // Fonts whose Devanagari already matched OCR on earlier pages are not checked again on
        // every page (see embeddedTextTrust.ts). KrutiDev conversions and pages with unmapped
        // glyphs are always checked.
        const trust = fontTrustFor(pdfBytes);
        const degraded = embedded.some((line) => line.source === "embedded-degraded");
        const intrinsicCorruption =
          !options?.convertLegacy && hasIntrinsicDevanagariCorruption(embedded.map((line) => line.text).join(" "));
        if (
          !degraded &&
          !intrinsicCorruption &&
          !options?.convertLegacy &&
          !mustVerifyPage(trust, textByFont.keys(), options?.spotCheckEvery)
        ) {
          if (textByFont.size > 0) noteSkippedPage(trust);
          return embedded;
        }
        const fontFailed = !options?.convertLegacy && hasFailedFont(trust, textByFont.keys());
        const record = options?.convertLegacy
          ? undefined
          : {
              band: (bandText: string, bandOcrText: string) => recordVerifiedBand(trust, textByFont, bandText, bandOcrText),
              page: (ocrText: string) => recordVerifiedPage(trust, textByFont, ocrText),
            };
        return await verifyEmbeddedDevanagari(
          embedded,
          await withImage(),
          pdfBytes,
          options?.convertLegacy,
          record,
          options?.allowPageOcr,
          fontFailed,
        );
      }
    } catch (error) {
      console.warn(
        "Embedded PDF text extraction failed; falling back to Tesseract",
        error,
      );
    }
  }

  if (options?.ocr === "off") return [];
  // A page without text that paints no image and few paths is blank: nothing for OCR to read.
  if (pdfBytes && !options?.forceOcr && !(await pageMayShowText(pdfBytes, page.pageIndex))) return [];
  if (options?.allowPageOcr?.() === false) return [];
  const imaged = await withImage();
  const [devanagariLines, latinLines] = await Promise.all([
    recognizeWithLanguage(imaged.backgroundImageUri, "hin"),
    recognizeWithLanguage(imaged.backgroundImageUri, "eng"),
  ]);
  return toOcrLines(mergeOcrLines(devanagariLines, latinLines), imaged);
}

/** How one page is read (see {@link detectTextLines}). */
export type PageReadOptions = {
  /** Read the page image only (pages whose PDF text is unusable). */
  forceOcr?: boolean;
  convertLegacy?: boolean;
  render?: PageRenderer;
  readTextImages?: boolean;
  rulings?: Ruling[];
  pictures?: ImageBox[];
  /** `off`: the PDF's own text only, never OCR (pages without text come back empty). */
  ocr?: "off";
  /**
   * Asked before a whole page is read with OCR (a scan, or text the PDF maps wrongly); false keeps
   * the PDF's own text, or nothing for a scan. Short checks of a few lines are not asked about.
   */
  allowPageOcr?: () => boolean;
  /** Check every this many pages of trusted fonts against OCR anyway (default 8). */
  spotCheckEvery?: number;
};

/** Draws a page image for OCR, in px (see `renderPage`). */
export type PageRenderer = () => Promise<{ backgroundImageUri: string; imagePxWidth: number; imagePxHeight: number }>;

/**
 * Whether a page could show text for OCR to read (see `mayShowText`); true when its drawing
 * cannot be read, so OCR still runs.
 *
 * @param pageIndex Zero-based page index.
 */
async function pageMayShowText(pdfBytes: Uint8Array, pageIndex: number): Promise<boolean> {
  try {
    const page = await (await sharedPdfDocument(pdfBytes)).getPage(pageIndex + 1);
    return mayShowText((await page.getOperatorList()).fnArray, OPS);
  } catch {
    return true;
  }
}

const fontTrusts = new WeakMap<Uint8Array, FontTrust>();

/** Font trust for one opened document (keyed by its bytes, so a new file starts fresh). */
function fontTrustFor(pdfBytes: Uint8Array): FontTrust {
  let trust = fontTrusts.get(pdfBytes);
  if (!trust) {
    trust = newFontTrust();
    fontTrusts.set(pdfBytes, trust);
  }
  return trust;
}

/**
 * Opt-in Gemini cloud OCR for difficult scans.
 *
 * @param page The page whose background image to scan.
 * @param jobId Anonymous quota job identifier for this document.
 * @param pageIndex Zero-based PDF page index.
 */
export async function detectTextLinesWithGemini(
  page: PageState,
  jobId: string,
  pageIndex: number,
): Promise<OcrLine[]> {
  const imageBase64 = page.backgroundImageUri.replace(
    /^data:image\/\w+;base64,/,
    "",
  );
  const response = await aiApiClient.ocr({
    jobId,
    page: pageIndex,
    imageBase64,
    mimeType: page.backgroundImageUri.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg",
    imagePxWidth: page.imagePxWidth,
    imagePxHeight: page.imagePxHeight,
  });
  const lines: RecognizedLine[] = response.lines.map(({ text, box_2d }) => {
    const [yMin, xMin, yMax, xMax] = box_2d;
    return {
      text,
      x: (xMin / 1000) * page.imagePxWidth,
      y: (yMin / 1000) * page.imagePxHeight,
      width: ((xMax - xMin) / 1000) * page.imagePxWidth,
      height: ((yMax - yMin) / 1000) * page.imagePxHeight,
    };
  });
  return toOcrLines(lines, page);
}
