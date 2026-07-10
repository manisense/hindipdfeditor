import { createWorker, type Worker, type Page as TesseractPage } from 'tesseract.js';

import { imagePxSizeToPt, imagePxToPt } from './coordinateMath';
import { recognizeTextWithGemini } from './geminiOcr';
import { mergeOcrLines } from './mergeOcrLines';
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
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.trim();
        if (text.length === 0) continue;
        lines.push({
          text,
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        });
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
 * Detects text lines on one page using browser Tesseract (Hindi + English passes, merged).
 *
 * @param page The page whose `backgroundImageUri` to scan.
 */
export async function detectTextLines(page: PageState): Promise<OcrLine[]> {
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
