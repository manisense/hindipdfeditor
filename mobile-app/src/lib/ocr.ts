import * as Crypto from 'expo-crypto';
// expo-file-system's top-level API is a non-functional stub in this SDK version (confirmed
// on-device - see CHANGELOG); the working implementation lives under /legacy, same as every
// other file-reading call site in this app.
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition, { type RecognizedLine } from 'text-recognition';

import { imagePxSizeToPt, imagePxToPt } from './coordinateMath';
import { recognizeTextWithGemini } from './geminiOcr';
import { mergeOcrLines } from './mergeOcrLines';
import type { OcrLine, PageState } from '../state/editStore';

/**
 * App-side entry point for OCR (spec: OCR-assisted tap-to-edit). This is the only file that
 * should ever import from the `text-recognition` native module or `geminiOcr.ts` directly -
 * same isolation rule as `pdfToImages.ts` for `pdf-page-image`, so OCR engines can be swapped
 * or added by editing only this file. Both engines return the same px-space line contract and
 * funnel through the same px-to-pt conversion below, so callers never know which engine ran.
 *
 * Failing open to "no lines detected" is deliberately NOT done here: a thrown error
 * propagates to the caller so the UI can distinguish "OCR failed" from "page genuinely has
 * no text" - same never-assume posture as `legacyFontDetector.ts` (AGENTS.md).
 */

/** Converts engine-produced px-space lines to reading-ordered `OcrLine`s in PDF points. */
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
      return { id: Crypto.randomUUID(), text: line.text, xPt, yPt, wPt, hPt };
    });
}

/**
 * Detects text lines on one page's rasterized background image using the on-device ML Kit
 * models (both scripts, merged), returning them in reading order with all positions/sizes in
 * PDF points. Free, offline, private - the default engine.
 *
 * @param page The page whose `backgroundImageUri` (JPEG, `imagePxWidth` px wide) to scan.
 */
export async function detectTextLines(page: PageState): Promise<OcrLine[]> {
  // The two passes are independent native calls - run them concurrently; ML Kit serializes
  // internally if it must, and this halves wall-clock time when it doesn't.
  const [devanagariLines, latinLines] = await Promise.all([
    TextRecognition.recognizeText(page.backgroundImageUri, 'devanagari'),
    TextRecognition.recognizeText(page.backgroundImageUri, 'latin'),
  ]);

  return toOcrLines(mergeOcrLines(devanagariLines, latinLines), page);
}

/**
 * The opt-in "Enhance with AI" engine: sends the page's background image to the Gemini API
 * (free tier, user's own key) for higher-accuracy OCR on scans where ML Kit struggles. The
 * caller is responsible for having made the privacy tradeoff explicit to the user first -
 * this is the one code path in the app where document content leaves the device.
 *
 * @param page The page whose `backgroundImageUri` (JPEG) to scan.
 * @param apiKey The user's Gemini API key (from `apiKeyStore.ts`).
 */
export async function detectTextLinesWithGemini(
  page: PageState,
  apiKey: string,
): Promise<OcrLine[]> {
  const imageBase64 = await FileSystem.readAsStringAsync(page.backgroundImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const lines = await recognizeTextWithGemini(
    imageBase64,
    page.imagePxWidth,
    page.imagePxHeight,
    apiKey,
  );
  return toOcrLines(lines, page);
}
