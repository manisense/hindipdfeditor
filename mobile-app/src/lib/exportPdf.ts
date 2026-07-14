import { PDFDocument } from '@cantoo/pdf-lib';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
// expo-file-system's top-level `readAsStringAsync`/`getInfoAsync` are stubs that
// unconditionally throw in this SDK version (confirmed on a real device - see CHANGELOG) -
// the actual implementation now lives under the `/legacy` subpath.
import * as FileSystem from 'expo-file-system/legacy';

import { documentHtml, type EmbeddedFontData } from './htmlCompositor';
import type { DocumentState, PageState } from '../state/editStore';

/**
 * Exports the full edited document to a new PDF file via Android's native print pipeline
 * (spec Section 8). Never overwrites `doc.sourceUri` (AGENTS.md: every export produces a new
 * output file) - `Print.printToFileAsync` always writes to a fresh temp file on its own.
 *
 * @param doc Full in-memory document state (every page, edited or not). Each page's own
 *   `widthPt`/`heightPt`, computed when it was loaded or inserted, is the source of truth for
 *   that isolated print. The validated pages are then copied into one final PDF.
 * @param embeddedFonts Validated base64 font data and exact CSS weight descriptors, keyed by
 *   family name and passed straight through to `documentHtml`.
 * @returns `file://` URI of the newly written PDF.
 */
export async function exportPdf(
  doc: DocumentState,
  embeddedFonts: Record<string, EmbeddedFontData>,
): Promise<string> {
  const firstPage = doc.pages[0];
  if (!firstPage) {
    throw new Error('exportPdf: document has no pages');
  }
  const printedPageUris: string[] = [];
  let outputUriToKeep: string | null = null;
  try {
    // Print each page in an isolated WebView document. A full-height multi-page canvas plus
    // page-break wrappers allowed WebView to allocate an extra sheet between real pages on
    // some documents and coupled every background image to one large HTML allocation. One
    // page per print has neither failure mode, supports mixed page sizes, and still delegates
    // all text shaping to Chromium/HarfBuzz. @cantoo/pdf-lib only copies the finished pages;
    // it never draws or reshapes text.
    for (const page of doc.pages) {
      const backgroundImageDataUrl = await readBackgroundImageDataUrl(page);
      const pageFontFamilies = new Set(
        page.edits.filter((edit) => edit.type === 'text').map((edit) => edit.fontFamily),
      );
      const pageEmbeddedFonts = Object.fromEntries(
        [...pageFontFamilies].map((family) => {
          const font = embeddedFonts[family];
          if (!font) throw new Error(`exportPdf: missing embedded font ${family}`);
          return [family, font];
        }),
      );
      const pageDoc: DocumentState = {
        ...doc,
        pageCount: 1,
        pages: [page],
        legacyFontWarnings: doc.legacyFontWarnings.filter(
          (warning) => warning.page === page.pageIndex,
        ),
      };
      // Embed only fonts used on this isolated page. Besides reducing memory, this avoids
      // cross-font transparency-mask bugs observed when a static Devanagari face and an unused
      // variable face were embedded into the same Chromium print document.
      const html = documentHtml(pageDoc, pageEmbeddedFonts, [backgroundImageDataUrl]);
      const { uri } = await Print.printToFileAsync({
        html,
        width: page.widthPt,
        height: page.heightPt,
      });
      printedPageUris.push(uri);
      await assertNonEmptyAndReopenable(uri, [page]);
    }

    if (printedPageUris.length === 1) {
      outputUriToKeep = printedPageUris[0];
      return outputUriToKeep;
    }

    const merged = await PDFDocument.create();
    for (const uri of printedPageUris) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const source = await PDFDocument.load(base64);
      const [copiedPage] = await merged.copyPages(source, [0]);
      merged.addPage(copiedPage);
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error('exportPdf: app cache directory is unavailable');
    }
    const outputUri = `${FileSystem.cacheDirectory}hindi-pdf-editor-${Crypto.randomUUID()}.pdf`;
    await FileSystem.writeAsStringAsync(outputUri, await merged.saveAsBase64(), {
      encoding: FileSystem.EncodingType.Base64,
    });
    await assertNonEmptyAndReopenable(outputUri, doc.pages);
    outputUriToKeep = outputUri;
    return outputUri;
  } finally {
    await Promise.all(
      printedPageUris
        .filter((uri) => uri !== outputUriToKeep)
        .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})),
    );
  }
}

/**
 * Reads a page's rasterized background image (`pdfToImages.ts`'s output - JPEG, see that
 * module's docstring) and returns it as a `data:` URI, so `htmlCompositor.ts` can inline it
 * directly. Confirmed on a real device that Android's print WebView renders a blank background
 * when given a `file://` URL - the same class of failure the font already had to work around
 * (spec Section 8) - so this can't be a plain path reference.
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
async function assertNonEmptyAndReopenable(uri: string, expectedPages: PageState[]): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size === 0) {
    throw new Error(`exportPdf: output file at ${uri} is missing or empty`);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    const parsed = await PDFDocument.load(base64);
    if (parsed.getPageCount() !== expectedPages.length) {
      throw new Error(`expected ${expectedPages.length} page(s), found ${parsed.getPageCount()}`);
    }
    parsed.getPages().forEach((parsedPage, index) => {
      const expected = expectedPages[index];
      const actual = parsedPage.getSize();
      if (
        Math.abs(actual.width - expected.widthPt) > 1 ||
        Math.abs(actual.height - expected.heightPt) > 1
      ) {
        throw new Error(
          `page ${index + 1} size ${actual.width}x${actual.height} does not match ${expected.widthPt}x${expected.heightPt}pt`,
        );
      }
    });
  } catch (cause) {
    throw new Error(`exportPdf: output file at ${uri} could not be re-parsed as a PDF`, { cause });
  }
}
