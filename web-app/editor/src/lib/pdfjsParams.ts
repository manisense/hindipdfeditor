/**
 * Parameters for `pdfjs.getDocument` that point pdf.js at the runtime data this site serves from
 * `/edit/pdfjs/` (copied from pdfjs-dist by `scripts/copy-pdfjs-assets.mjs`): character maps,
 * standard font data, WebAssembly image decoders and ICC profiles. Without them JPEG 2000 images
 * (common in scans) render blank and text in predefined-CMap or non-embedded fonts is unreadable.
 *
 * @param data PDF bytes; pdf.js takes ownership, so pass a copy when the caller keeps using them.
 */
export function pdfjsDocumentParams(data: Uint8Array) {
  if (typeof window === 'undefined') return { data };
  const base = new URL('/edit/pdfjs/', window.location.origin).href;
  return {
    data,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
  };
}
