import {
  createWorker,
  type Worker,
  type Page as TesseractPage,
} from "tesseract.js";

import {
  imagePxSizeToPt,
  imagePxToPt,
  ptSizeToImagePx,
  ptToImagePx,
} from "./coordinateMath";
import { aiApiClient } from "./aiApiClient";
import {
  combineEmbeddedLatinWithOcr,
  hasDevanagari,
  isEmbeddedDevanagariCorrupted,
  isLikelyOcrNoise,
  missedDevanagariRows,
  trimOcrBorderNoise,
  type PtBox,
} from "./embeddedTextVerification";
import { mergeOcrLines, mergeWordReadings, type RecognizedWord } from "./mergeOcrLines";
import { textBandOfLine } from "./ocrLineGeometry";
import { extractEmbeddedTextLines } from "./pdfTextExtract";
import {
  hasGlyphPlaceholder,
  isGlyphPlaceholder,
  learnDocumentGlyphs,
  ocrLineFor,
  pairLinesWithOcr,
  repairText,
  spacedLike,
} from "./glyphRepair";
import { getPdfBytes } from "./pdfToImages";
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

/** Language data is 1.4–3 MB; on a slow connection it can take a while, but never this long. */
const OCR_LOAD_TIMEOUT_MS = 60_000;

const workers = new Map<"hin" | "eng", Promise<Worker>>();

/**
 * Loads an OCR worker once, sharing the in-flight load. tesseract.js never settles `createWorker`
 * when the language data fails to download (the error escapes as an uncaught exception), which
 * left pages "Finding text…" forever; worker errors and a timeout now reject instead, the failure
 * is reported, and the next call tries again.
 */
function getWorker(language: "hin" | "eng"): Promise<Worker> {
  const existing = workers.get(language);
  if (existing) return existing;
  const loading = new Promise<Worker>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`OCR data for ${language} did not load in time`)),
      OCR_LOAD_TIMEOUT_MS,
    );
    createWorker(language, 1, {
      ...ocrAssetOptions(),
      errorHandler: (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    }).then(
      (worker) => {
        window.clearTimeout(timer);
        resolve(worker);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
  workers.set(language, loading);
  loading.catch((error: unknown) => {
    workers.delete(language);
    reportOcrUnavailable(error);
  });
  return loading;
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
  const worker =
    await getWorker(language);
  // tesseract.js v6 returns no blocks (so no lines or words) unless asked for them.
  const { data } = await worker.recognize(imageUri, {}, { blocks: true });
  return data;
}

async function recognizeWithLanguage(
  imageUri: string,
  language: "hin" | "eng",
): Promise<RecognizedLine[]> {
  return tesseractPageToRecognized(await recognizePage(imageUri, language));
}

/** Hindi OCR of one rectangle of the page, for rows full-page OCR skipped. */
async function recognizeRow(
  page: PageState,
  crop: PtBox,
  line: PtBox & Pick<OcrLine, "baselineYPt" | "font">,
): Promise<OcrLine | null> {
  const { x, y } = ptToImagePx(crop.xPt, crop.yPt, page.imagePxWidth, page.widthPt);
  const { wPx, hPx } = ptSizeToImagePx(crop.wPt, crop.hPt, page.imagePxWidth, page.widthPt);
  const worker = await getWorker("hin");
  const { data } = await worker.recognize(page.backgroundImageUri, {
    rectangle: {
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(Math.min(wPx, page.imagePxWidth - x)),
      height: Math.round(Math.min(hPx, page.imagePxHeight - y)),
    },
  });
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
  const readings = learnDocumentGlyphs(pdfBytes, pairLinesWithOcr(withGlyphs, ocrLines));
  const lines = withGlyphs.map((line) => ({ ...line, text: repairText(line.text, readings, isGlyphPlaceholder) }));
  // A repaired word must also be in OCR of its line: a reading learned from one misread word
  // must not put a wrong letter into the text.
  const confirmed = (line: OcrLine, drawn: string) => {
    const ocr = ocrLineFor(line, ocrLines)?.text.normalize("NFC").replace(/\s+/gu, "") ?? "";
    return drawn
      .split(/\s+/u)
      .filter((word) => hasGlyphPlaceholder(word))
      .every((word) => ocr.includes(repairText(word, readings, isGlyphPlaceholder)));
  };
  // A row with any line left unrepaired or unconfirmed is read by OCR as a whole: OCR does not
  // split rows the way the text layer does, so keeping part of the row would lose the rest.
  const unresolved = lines.filter(
    (line, i) => hasGlyphPlaceholder(line.text) || !confirmed(line, withGlyphs[i].text),
  );
  const repaired = lines
    .filter((line) => !unresolved.some((open) => sameBand(open, line)))
    .map((line) => {
      const ocr = hasDevanagari(line.text) ? ocrLineFor(line, ocrLines) : null;
      return ocr ? { ...line, text: spacedLike(line.text, ocr.text) } : line;
    });
  const hindi = repaired.filter((line) => hasDevanagari(line.text));
  if (hindi.length === 0) return null;
  if (isEmbeddedDevanagariCorrupted(hindi.map((line) => line.text).join(" "), ocrText)) return null;
  return repaired;
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

/**
 * Checks embedded lines that contain Devanagari against Hindi OCR of the page. When the text layer
 * lost characters (`embedded-degraded`) or its ToUnicode map is corrupted, the positions of its
 * Devanagari runs are not trustworthy either, so Hindi lines come from image OCR and Latin lines
 * from the PDF (see `combineEmbeddedLatinWithOcr`); Hindi rows page OCR skipped are read one
 * rectangle at a time. If OCR fails or finds no Hindi, the embedded lines are returned unchanged.
 */
async function verifyEmbeddedDevanagari(
  embedded: OcrLine[],
  page: PageState,
  pdfBytes: Uint8Array,
  convertLegacy?: boolean,
): Promise<OcrLine[]> {
  const degraded = embedded.some((line) => line.source === "embedded-degraded");
  if (!degraded && !embedded.some((line) => hasDevanagari(line.text))) {
    return embedded;
  }
  try {
    const hindiPage = await recognizePage(page.backgroundImageUri, "hin");
    const embeddedText = embedded.map((line) => line.text).join(" ");
    if (!degraded && !isEmbeddedDevanagariCorrupted(embeddedText, hindiPage.text)) {
      return embedded;
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
  options?: { forceOcr?: boolean; convertLegacy?: boolean },
): Promise<OcrLine[]> {
  const pdfBytes = getPdfBytes();
  if (!options?.forceOcr && pdfBytes) {
    try {
      const embedded = await extractEmbeddedTextLines(pdfBytes, page.pageIndex, {
        convertLegacy: options?.convertLegacy,
      });
      if (embedded.length > 0) {
        return await verifyEmbeddedDevanagari(embedded, page, pdfBytes, options?.convertLegacy);
      }
    } catch (error) {
      console.warn(
        "Embedded PDF text extraction failed; falling back to Tesseract",
        error,
      );
    }
  }

  const [devanagariLines, latinLines] = await Promise.all([
    recognizeWithLanguage(page.backgroundImageUri, "hin"),
    recognizeWithLanguage(page.backgroundImageUri, "eng"),
  ]);
  return toOcrLines(mergeOcrLines(devanagariLines, latinLines), page);
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
