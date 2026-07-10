import { createWorker, type Worker, type Page as TesseractPage } from 'tesseract.js';

import { imagePxSizeToPt, imagePxToPt } from './coordinateMath';
import { recognizeTextWithGemini } from './geminiOcr';
import { mergeOcrLines } from './mergeOcrLines';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import { getPdfBytes } from './pdfToImages';
import type { RecognizedLine } from './recognizedLine';
import type { OcrLine, PageState } from '../state/editStore';

let hinWorker: Worker | null = null;
let engWorker: Worker | null = null;

async function getHinWorker(): Promise<Worker> {
  if (!hinWorker) {
    hinWorker = await createWorker('hin');
  }
  return hinWorker;
}

async function getEngWorker(): Promise<Worker> {
  if (!engWorker) {
    engWorker = await createWorker('eng');
  }
  return engWorker;
}

function tesseractPageToRecognized(page: TesseractPage): RecognizedLine[] {
  const lines: RecognizedLine[] = [];

  const pushLine = (text: string, bbox: { x0: number; y0: number; x1: number; y1: number }) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    lines.push({
      text: trimmed,
      x: bbox.x0,
      y: bbox.y0,
      width: bbox.x1 - bbox.x0,
      height: bbox.y1 - bbox.y0,
    });
  };

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        pushLine(line.text, line.bbox);
      }
    }
  }

  // tesseract.js sometimes omits nested blocks but still fills top-level lines/words.
  if (lines.length === 0) {
    const pageExtra = page as TesseractPage & {
      lines?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
      words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
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
      const { xPt, yPt } = imagePxToPt(line.x, line.y, page.imagePxWidth, page.widthPt);
      const { wPt, hPt } = imagePxSizeToPt(
        line.width,
        line.height,
        page.imagePxWidth,
        page.widthPt,
      );
      return { id: crypto.randomUUID(), text: line.text, xPt, yPt, wPt, hPt };
    });
}

async function recognizeWithLanguage(
  imageUri: string,
  language: 'hin' | 'eng',
): Promise<RecognizedLine[]> {
  const worker = language === 'hin' ? await getHinWorker() : await getEngWorker();
  const { data } = await worker.recognize(imageUri);
  return tesseractPageToRecognized(data);
}

/**
 * Detects tappable text on one page. Prefers embedded PDF text (digital docs like Word
 * exports); falls back to browser Tesseract for scanned/image-only pages.
 *
 * @param page The page whose `backgroundImageUri` / page index to scan.
 */
export async function detectTextLines(page: PageState): Promise<OcrLine[]> {
  const pdfBytes = getPdfBytes();
  if (pdfBytes) {
    try {
      const embedded = await extractEmbeddedTextLines(pdfBytes, page.pageIndex);
      if (embedded.length > 0) return embedded;
    } catch (error) {
      console.warn('Embedded PDF text extraction failed; falling back to Tesseract', error);
    }
  }

  const [devanagariLines, latinLines] = await Promise.all([
    recognizeWithLanguage(page.backgroundImageUri, 'hin'),
    recognizeWithLanguage(page.backgroundImageUri, 'eng'),
  ]);
  return toOcrLines(mergeOcrLines(devanagariLines, latinLines), page);
}

/**
 * Opt-in Gemini cloud OCR for difficult scans.
 *
 * @param page The page whose background image to scan.
 * @param apiKey User's Gemini API key.
 */
export async function detectTextLinesWithGemini(
  page: PageState,
  apiKey: string,
): Promise<OcrLine[]> {
  const imageBase64 = page.backgroundImageUri.replace(/^data:image\/\w+;base64,/, '');
  const lines = await recognizeTextWithGemini(
    imageBase64,
    page.imagePxWidth,
    page.imagePxHeight,
    apiKey,
  );
  return toOcrLines(lines, page);
}
