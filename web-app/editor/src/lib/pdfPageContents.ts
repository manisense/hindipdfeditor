import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  PDFStream,
  type PDFPage,
} from "@cantoo/pdf-lib";

/** One char per byte. `TextDecoder("latin1")` is windows-1252 and would remap 0x80–0x9F. */
function bytesToLatin1(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return text;
}

/** A page's content streams, decoded and joined, as latin1 (one char per byte). */
export function decodedContents(doc: PDFDocument, page: PDFPage): string {
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

const documents = new WeakMap<Uint8Array, Promise<PDFDocument>>();

/**
 * One page's decoded content stream from the opened file. The file is parsed with pdf-lib once
 * per open and kept, so later pages are quick; only callers that need raw content (pages with
 * unmapped glyphs) pay for it.
 *
 * @param pdfBytes Bytes of the opened PDF (identifies the document; not modified).
 * @param pageIndex Zero-based page index.
 */
export async function pageContents(pdfBytes: Uint8Array, pageIndex: number): Promise<string> {
  let doc = documents.get(pdfBytes);
  if (!doc) {
    doc = PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: true, updateMetadata: false });
    documents.set(pdfBytes, doc);
  }
  const loaded = await doc;
  return decodedContents(loaded, loaded.getPage(pageIndex));
}
