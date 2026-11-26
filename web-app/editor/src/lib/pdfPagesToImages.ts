import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { pdfjsDocumentParams } from "./pdfjsParams";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type ImageFormat = "jpeg" | "png";

/** JPEG quality (0–1) for page images: small artefacts around Hindi letters, half the PNG size. */
const JPEG_QUALITY = 0.9;
/** Largest page image side, in px, so a poster-sized page cannot run a phone out of memory. */
const MAX_SIDE_PX = 8000;

/**
 * Output size of a page image, in px: the page at `dpi`, capped at {@link MAX_SIDE_PX}.
 *
 * @param widthPt Page width, in pt.
 * @param heightPt Page height, in pt.
 * @param dpi Image resolution, in dots per inch (72 pt per inch).
 * @returns Render scale (px per pt) and the image size in px.
 */
export function pageImageSize(widthPt: number, heightPt: number, dpi: number): { scale: number; widthPx: number; heightPx: number } {
  const scale = Math.min(dpi / 72, MAX_SIDE_PX / Math.max(widthPt, heightPt));
  return { scale, widthPx: Math.max(1, Math.round(widthPt * scale)), heightPx: Math.max(1, Math.round(heightPt * scale)) };
}

/** File name of one page image: `notice-page-03.jpg` (numbers padded so files sort in order). */
export function pageImageName(base: string, page: number, pageCount: number, format: ImageFormat): string {
  const digits = String(pageCount).length;
  return `${base}-page-${String(page).padStart(Math.max(2, digits), "0")}.${format === "jpeg" ? "jpg" : "png"}`;
}

/**
 * Renders chosen pages of a PDF as images. One page gives the image itself; several give a ZIP
 * with one image per page. The PDF is only read, never changed.
 *
 * @param bytes PDF bytes.
 * @param pages Zero-based page indexes, in output order.
 * @param options Format, resolution (dpi) and the base of the file names.
 * @param onProgress Called after each page with (done, total).
 */
export async function pdfPagesToImages(
  bytes: Uint8Array,
  pages: readonly number[],
  options: { format: ImageFormat; dpi: number; baseName: string },
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const pdf = await pdfjs.getDocument(pdfjsDocumentParams(bytes.slice())).promise;
  try {
    const images: { name: string; blob: Blob }[] = [];
    for (const [index, pageIndex] of pages.entries()) {
      const page = await pdf.getPage(pageIndex + 1);
      const base = page.getViewport({ scale: 1 });
      const { scale, widthPx, heightPx } = pageImageSize(base.width, base.height, options.dpi);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, widthPx, heightPx);
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      page.cleanup();
      const type = options.format === "jpeg" ? "image/jpeg" : "image/png";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
      canvas.width = 0;
      canvas.height = 0;
      if (!blob || blob.size === 0) throw new Error("Page image could not be made");
      images.push({ name: pageImageName(options.baseName, pageIndex + 1, pdf.numPages, options.format), blob });
      onProgress?.(index + 1, pages.length);
    }
    if (images.length === 1) return { blob: images[0].blob, filename: images[0].name };
    const zip = new JSZip();
    for (const image of images) zip.file(image.name, image.blob);
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    return { blob, filename: `${options.baseName}-images.zip` };
  } finally {
    await pdf.destroy();
  }
}
