import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  type PDFDocument,
  type PDFPage,
} from "@cantoo/pdf-lib";

import {
  removeGlyphsInRects,
  type FontMetrics,
  type RemovalResult,
  type UserRect,
} from "./contentStreamText";

function numberAt(array: PDFArray, index: number): number | undefined {
  const value = array.lookup(index);
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/** Widths from a composite font's `/DW` and `/W` arrays (`c [w…]` and `cFirst cLast w`). */
function compositeWidths(descendant: PDFDict): (code: number) => number | undefined {
  const dw = descendant.lookupMaybe(PDFName.of("DW"), PDFNumber)?.asNumber() ?? 1000;
  const table = new Map<number, number>();
  const w = descendant.lookupMaybe(PDFName.of("W"), PDFArray);
  if (w) {
    let i = 0;
    while (i < w.size()) {
      const first = numberAt(w, i);
      const next = w.lookup(i + 1);
      if (first === undefined) break;
      if (next instanceof PDFArray) {
        for (let k = 0; k < next.size(); k++) {
          const width = numberAt(next, k);
          if (width !== undefined) table.set(first + k, width);
        }
        i += 2;
      } else {
        const last = numberAt(w, i + 1);
        const width = numberAt(w, i + 2);
        if (last !== undefined && width !== undefined) {
          for (let c = first; c <= last; c++) table.set(c, width);
        }
        i += 3;
      }
    }
  }
  return (code) => table.get(code) ?? dw;
}

/**
 * Glyph metrics for one font dictionary, or undefined when the remover cannot walk it safely
 * (Type3 fonts, non-Identity CMaps, simple fonts without `/Widths`).
 */
export function fontMetricsOf(font: PDFDict): FontMetrics | undefined {
  const subtype = font.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText();
  if (subtype === "Type0") {
    const encoding = font.lookupMaybe(PDFName.of("Encoding"), PDFName)?.decodeText();
    if (encoding !== "Identity-H" && encoding !== "Identity-V") return undefined;
    const descendant = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray)?.lookup(0);
    if (!(descendant instanceof PDFDict)) return undefined;
    return { codeBytes: 2, width: compositeWidths(descendant) };
  }
  if (subtype === "Type3") return undefined;
  const widths = font.lookupMaybe(PDFName.of("Widths"), PDFArray);
  const firstChar = font.lookupMaybe(PDFName.of("FirstChar"), PDFNumber)?.asNumber();
  if (!widths || firstChar === undefined) return undefined;
  const missing =
    font
      .lookupMaybe(PDFName.of("FontDescriptor"), PDFDict)
      ?.lookupMaybe(PDFName.of("MissingWidth"), PDFNumber)
      ?.asNumber() ?? 0;
  return {
    codeBytes: 1,
    width: (code) => numberAt(widths, code - firstChar) ?? missing,
  };
}

/** One char per byte. `TextDecoder("latin1")` is windows-1252 and would remap 0x80–0x9F. */
function bytesToLatin1(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return text;
}

function decodedContents(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) return "";
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : [contents];
  return streams
    .map((stream) => {
      if (stream instanceof PDFRawStream) {
        return bytesToLatin1(decodePDFRawStream(stream).decode());
      }
      if (stream instanceof PDFStream) {
        return bytesToLatin1(stream.getContents());
      }
      return "";
    })
    .join("\n");
}

function latin1Bytes(text: string): Uint8Array {
  return Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
}

/**
 * Removes the original glyphs inside `rects` from one page and wraps the page's content in
 * `q … Q`, so overlays appended later start from a clean graphics state. Text inside form
 * XObjects is not reached; callers verify the result and clean any remainder another way.
 *
 * @param doc Output document (a copy loaded from the source bytes; the source file is untouched).
 * @param pageIndex Zero-based page index.
 * @param rects Rectangles in PDF user space, in pt.
 */
export function removePageText(
  doc: PDFDocument,
  pageIndex: number,
  rects: readonly UserRect[],
): Omit<RemovalResult, "content"> {
  const page = doc.getPage(pageIndex);
  const fontDict = page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
  const cache = new Map<string, FontMetrics | undefined>();
  const fontFor = (name: string) => {
    if (!cache.has(name)) {
      const font = fontDict?.lookupMaybe(PDFName.of(name), PDFDict);
      cache.set(name, font ? fontMetricsOf(font) : undefined);
    }
    return cache.get(name);
  };
  const { content, removedPerRect, unresolvedRects } = removeGlyphsInRects(
    decodedContents(doc, page),
    fontFor,
    rects,
  );
  const stream = doc.context.flateStream(latin1Bytes(`q\n${content}\nQ\n`));
  page.node.set(PDFName.of("Contents"), doc.context.register(stream));
  return { removedPerRect, unresolvedRects };
}
