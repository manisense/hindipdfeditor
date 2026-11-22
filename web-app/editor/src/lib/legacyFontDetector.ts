import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
} from "@cantoo/pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pdfjsDocumentParams } from './pdfjsParams';

/**
 * Detects pages set in a pre-Unicode legacy Devanagari font (spec Section 9): KrutiDev,
 * Shivaji, Chanakya, DevLys, Walkman-Chanakya, Agra, and Amar. These fonts map Latin
 * keystrokes to Devanagari *shapes* purely visually - the stored bytes are plain
 * ASCII/Latin, not Unicode Devanagari code points - so editing or masking a page using one
 * of these fonts without warning first risks building on top of a text layer that's
 * already fundamentally mismatched with what's visually displayed.
 *
 * Read-only: uses `@cantoo/pdf-lib` to inspect embedded font names and PDF.js to read the
 * page text, never to draw text (see ADR 0003, ADR 0001).
 */

/** Case-insensitive prefix patterns matched against each font's true PostScript name. */
const LEGACY_FONT_NAME_PREFIXES = [
  "KrutiDev",
  "Shivaji",
  "Chanakya",
  "DevLys",
  "Walkman-Chanakya",
  "Agra",
  "Amar",
];

/** PDF font subsetting prepends a 6-uppercase-letter tag + `+`, e.g. `ABCDEF+KrutiDev010`. */
const SUBSET_TAG_PATTERN = /^[A-Z]{6}\+/;

/**
 * True if `fontName` (as found in the PDF, subset tag and all) matches one of the known
 * legacy Devanagari font name patterns.
 */
export function isLegacyDevanagariFontName(fontName: string): boolean {
  const withoutSubsetTag = fontName.replace(SUBSET_TAG_PATTERN, "");
  const normalized = withoutSubsetTag.toLowerCase();
  return LEGACY_FONT_NAME_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix.toLowerCase()),
  );
}

/** Reads a font dict's true PostScript name, checking every place a viewer would look. */
function readFontName(fontDict: PDFDict, doc: PDFDocument): string | undefined {
  const baseFont = fontDict.lookupMaybe(PDFName.of("BaseFont"), PDFName);
  if (baseFont) {
    return baseFont.decodeText();
  }

  const descriptor = fontDict.lookupMaybe(
    PDFName.of("FontDescriptor"),
    PDFDict,
  );
  const descriptorName = descriptor?.lookupMaybe(
    PDFName.of("FontName"),
    PDFName,
  );
  if (descriptorName) {
    return descriptorName.decodeText();
  }

  // Type0 (composite/CID) fonts often carry BaseFont/FontDescriptor on the descendant
  // font dict instead of the top-level Type0 dict.
  const descendants = fontDict.lookupMaybe(
    PDFName.of("DescendantFonts"),
    PDFArray,
  );
  const firstDescendantRef = descendants?.asArray()[0];
  if (firstDescendantRef) {
    const descendant = doc.context.lookup(firstDescendantRef, PDFDict);
    return readFontName(descendant, doc);
  }

  return undefined;
}

/** Every distinct font name referenced by `page`'s resource dictionary. */
export function getPageFontNames(page: PDFPage, doc: PDFDocument): string[] {
  const resources = page.node.Resources();
  const fontDict = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (!fontDict) {
    return [];
  }

  const names = new Set<string>();
  for (const [, fontRef] of fontDict.entries()) {
    const resolvedFontDict = doc.context.lookup(fontRef, PDFDict);
    const name = readFontName(resolvedFontDict, doc);
    if (!name)
      throw new Error(
        "Referenced PDF font name is unreadable; encoding is unknown",
      );
    names.add(name);
  }
  return [...names];
}

export type LegacyFontWarning = { page: number; fontName: string };

/** Reported in place of a font name when only the page's text reveals the legacy encoding. */
export const LEGACY_TEXT_ENCODING_LABEL = "Kruti Dev-style text encoding";

/**
 * Whether a legacy-font warning names an encoding the editor can convert to Unicode: the
 * KrutiDev family (KrutiDev, DevLys, or text that reads as KrutiDev keystrokes). Other legacy
 * encodings (Chanakya, Shivaji, Walkman-Chanakya, Agra, Amar) and unknown fonts stay blocked.
 */
export function isConvertibleLegacyFont(fontName: string): boolean {
  return (
    fontName === LEGACY_TEXT_ENCODING_LABEL ||
    /^(krutidev|devlys)/i.test(fontName.replace(SUBSET_TAG_PATTERN, ""))
  );
}

/**
 * Very common Hindi words as KrutiDev/DevLys keystrokes (के, का, की, में, है, हैं, को, से, और,
 * कि, तथा, लिए, भी, यह, जो, एवं, एक, होगा, होंगे, पर, अथवा, करें, किया, गया, जाता, जाने, आदि,
 * अन्य, प्रकार). None is an English word, so ordinary Latin text does not match.
 */
const KRUTI_DEV_SIGNATURE_WORDS = new Set([
  "ds", "dk", "dh", "esa", "gS", "gSa", "dks", "ls", "vkSj", "fd", "rFkk", "fy,", "Hkh",
  ";g", "tks", ",oa", ",d", "gksxk", "gksaxs", "ij", "vFkok", "djsa", "fd;k", "x;k",
  "tkrk", "tkus", "vkfn", "vU;", "izdkj",
]);
const MIN_SIGNATURE_HITS = 3;
const MIN_SIGNATURE_RATIO = 0.05;

/**
 * True when `text` reads as Devanagari typed in a KrutiDev-family encoding: Latin letters standing
 * in for Devanagari shapes. Catches PDFs that hide the font's real name (e.g. `CIDFont+F1`), where
 * {@link isLegacyDevanagariFontName} cannot see it.
 */
export function looksLikeLegacyDevanagariText(text: string): boolean {
  const words = text.split(/\s+/u).filter((word) => /[A-Za-z]/u.test(word));
  const hits = words.filter((word) =>
    KRUTI_DEV_SIGNATURE_WORDS.has(word.replace(/[.\]|A]+$/u, "")),
  ).length;
  return hits >= MIN_SIGNATURE_HITS && hits / words.length >= MIN_SIGNATURE_RATIO;
}

function toBytes(pdfBytes: Uint8Array | string): Uint8Array {
  if (typeof pdfBytes !== "string") return pdfBytes.slice();
  const binary = atob(pdfBytes);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** Zero-based indexes of pages whose embedded text is in a legacy Devanagari encoding. */
async function detectLegacyTextPages(pdfBytes: Uint8Array): Promise<number[]> {
  const doc = await pdfjs.getDocument(pdfjsDocumentParams(pdfBytes)).promise;
  try {
    const pages: number[] = [];
    for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
      const content = await (await doc.getPage(pageIndex + 1)).getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      if (looksLikeLegacyDevanagariText(text)) pages.push(pageIndex);
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Loads `pdfBytes` and returns one warning per (page, font name) pair that matches a known
 * legacy Devanagari font pattern, plus one {@link LEGACY_TEXT_ENCODING_LABEL} warning for each
 * other page whose text is KrutiDev-encoded. An empty array means no legacy fonts were detected - it
 * does not mean the document is guaranteed Unicode-safe if `PDFDocument.load` itself failed;
 * per AGENTS.md, callers must treat a thrown error here as "unknown encoding," not "safe to
 * proceed," and surface `LegacyFontWarning.tsx` accordingly rather than swallowing it.
 *
 * @param pdfBytes Either raw PDF bytes, or a base64-encoded string of them - `@cantoo/pdf-lib`'s
 *   `PDFDocument.load` accepts both natively. `App.tsx` reads a picked document via
 *   `expo-file-system/legacy`'s `readAsStringAsync(..., { encoding: Base64 })` (the same pattern
 *   `exportPdf.ts` already uses for its own re-parse check), so passing that base64 string
 *   straight through avoids a separate decode step app-side.
 */
export async function detectLegacyFonts(
  pdfBytes: Uint8Array | string,
): Promise<LegacyFontWarning[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const warnings: LegacyFontWarning[] = [];

  doc.getPages().forEach((page, pageIndex) => {
    for (const fontName of getPageFontNames(page, doc)) {
      if (isLegacyDevanagariFontName(fontName)) {
        warnings.push({ page: pageIndex, fontName });
      }
    }
  });

  const pagesWithNamedFont = new Set(warnings.map((warning) => warning.page));
  for (const page of await detectLegacyTextPages(toBytes(pdfBytes))) {
    if (!pagesWithNamedFont.has(page)) {
      warnings.push({ page, fontName: LEGACY_TEXT_ENCODING_LABEL });
    }
  }

  return warnings.sort((a, b) => a.page - b.page);
}
