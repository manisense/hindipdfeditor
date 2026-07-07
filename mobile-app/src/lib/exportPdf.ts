import { PDFDocument } from '@cantoo/pdf-lib';
import * as Print from 'expo-print';
// expo-file-system's top-level `readAsStringAsync`/`getInfoAsync` are stubs that
// unconditionally throw in this SDK version (confirmed on a real device - see CHANGELOG) -
// the actual implementation now lives under the `/legacy` subpath.
import * as FileSystem from 'expo-file-system/legacy';

import { documentHtml } from './htmlCompositor';
import type { DevanagariFontFamily } from './fontAsset';
import type { DocumentState, PageState } from '../state/editStore';

/**
 * Exports the full edited document to a new PDF file via Android's native print pipeline
 * (spec Section 8). Never overwrites `doc.sourceUri` (AGENTS.md: every export produces a new
 * output file) - `Print.printToFileAsync` always writes to a fresh temp file on its own.
 *
 * @param doc Full in-memory document state (every page, edited or not - export always
 *   regenerates the whole document in one print call). `doc.pages[0].widthPt/heightPt` -
 *   already the source PDF's real page size, computed once when the page was loaded/rasterized
 *   (see `pdfToImages.ts`) - is reused here rather than re-reading the source file a second
 *   time, so there is exactly one source of truth for page dimensions across the whole app,
 *   not two independent reads that could theoretically disagree by rounding.
 * @param fontBase64ByFamily Base64 font data from `fontAsset.ts`'s `getFontBase64`, keyed by
 *   family name - passed straight through to `documentHtml`.
 * @returns `file://` URI of the newly written PDF.
 */
export async function exportPdf(
  doc: DocumentState,
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
): Promise<string> {
  const firstPage = doc.pages[0];
  if (!firstPage) {
    throw new Error('exportPdf: document has no pages');
  }
  const backgroundImageDataUrls = await Promise.all(doc.pages.map(readBackgroundImageDataUrl));
  const html = documentHtml(doc, fontBase64ByFamily, backgroundImageDataUrls);

  // expo-print's `width`/`height` are documented as "pixels" but are actually PDF points at
  // 72 PPI (its own default, 612x792, is exactly US Letter in points) - see spec Section 8.
  const { uri } = await Print.printToFileAsync({
    html,
    width: firstPage.widthPt,
    height: firstPage.heightPt,
  });

  await assertNonEmptyAndReopenable(uri);
  return uri;
}

/**
 * Reads a page's rasterized background image (`pdfToImages.ts`'s output - JPEG, see that
 * module's docstring) and returns it as a `data:` URI, so `htmlCompositor.ts` can inline it
 * directly. Confirmed on a real device that Android's print WebView renders a blank background
 * when given a `file://` URL in CSS `background-image` - the exact same class of failure the
 * font already had to work around (spec Section 8) - so this can't be a plain path reference.
 */
async function readBackgroundImageDataUrl(page: PageState): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(page.backgroundImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = page.backgroundImageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
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
