import { PDFDocument } from '@cantoo/pdf-lib';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

import { documentHtml } from './htmlCompositor';
import type { DocumentState } from '../state/editStore';

/**
 * Exports the full edited document to a new PDF file via Android's native print pipeline
 * (spec Section 8). Never overwrites `doc.sourceUri` (AGENTS.md: every export produces a new
 * output file) - `Print.printToFileAsync` always writes to a fresh temp file on its own.
 *
 * @param doc Full in-memory document state (every page, edited or not - export always
 *   regenerates the whole document in one print call).
 * @param devanagariFontBase64 Base64 font data from `fontAsset.ts`'s `getFontBase64`, passed
 *   straight through to `documentHtml`.
 * @returns `file://` URI of the newly written PDF.
 */
export async function exportPdf(doc: DocumentState, devanagariFontBase64: string): Promise<string> {
  const { widthPt, heightPt } = await getSourcePageSizePt(doc.sourceUri);
  const html = documentHtml(doc, devanagariFontBase64);

  // expo-print's `width`/`height` are documented as "pixels" but are actually PDF points at
  // 72 PPI (its own default, 612x792, is exactly US Letter in points) - see spec Section 8.
  const { uri } = await Print.printToFileAsync({ html, width: widthPt, height: heightPt });

  await assertNonEmptyAndReopenable(uri);
  return uri;
}

/**
 * Reads the source PDF's real page size (spec Section 7: the canonical unit every edit is
 * stored in), so export never hardcodes A4/Letter for a document that might be sized
 * differently. Uses page 0's size for the whole document, matching `documentHtml`'s single
 * `width`/`height` print option (per-page sizing would require one `printToFileAsync` call
 * per page, out of scope until a real document actually needs mixed page sizes).
 */
async function getSourcePageSizePt(
  sourceUri: string,
): Promise<{ widthPt: number; heightPt: number }> {
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const pdfDoc = await PDFDocument.load(base64);
  const { width, height } = pdfDoc.getPage(0).getSize();
  return { widthPt: width, heightPt: height };
}

/**
 * Validates the exported file before the caller reports success (AGENTS.md: "a silently
 * corrupt export is worse than a visible error"). Confirms the file is non-empty and that
 * `@cantoo/pdf-lib` can re-parse it as a PDF - a basic parse-back check, not a full render.
 */
async function assertNonEmptyAndReopenable(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size === 0) {
    throw new Error(`exportPdf: output file at ${uri} is missing or empty`);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    await PDFDocument.load(base64);
  } catch (cause) {
    throw new Error(`exportPdf: output file at ${uri} could not be re-parsed as a PDF`, { cause });
  }
}
