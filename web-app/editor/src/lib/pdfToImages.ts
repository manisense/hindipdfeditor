import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import { sharedPdfDocument } from './sharedPdfDocument';
import { sampleAverageColorFromDataUrl, samplePagePaperColorFromDataUrl, sampleTextColorFromDataUrl } from './imageColor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PageImage {
  /** Data URL to the rendered background JPEG. */
  uri: string;
  /** Rendered bitmap width, in px. */
  pxWidth: number;
  /** Rendered bitmap height, in px. */
  pxHeight: number;
}

let pdfBytesCache: Uint8Array | null = null;

/** Loads PDF bytes once per open so page count and rendering share the same source. */
export function setPdfBytes(bytes: Uint8Array): void {
  pdfBytesCache = bytes;
}

/** Returns the currently loaded PDF bytes, or null if none. */
export function getPdfBytes(): Uint8Array | null {
  return pdfBytesCache;
}

/** Number of pages in the loaded PDF. */
export async function getPageCount(): Promise<number> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  return (await sharedPdfDocument(pdfBytesCache)).numPages;
}

/**
 * Size one page would have when rendered at `scale`, without rendering it. Lets the editor lay out
 * every page at once and render each page's image only when it is needed.
 *
 * @param page Zero-based page index.
 * @param scale Output px per PDF point.
 * @returns Bitmap width and height, in px (rounded exactly as {@link renderPage} rounds them).
 */
export async function getPageSize(page: number, scale: number): Promise<{ pxWidth: number; pxHeight: number }> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const pdfPage = await (await sharedPdfDocument(pdfBytesCache)).getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale });
  return { pxWidth: Math.round(viewport.width), pxHeight: Math.round(viewport.height) };
}

/**
 * Rasterizes one page of the loaded PDF to a JPEG data URL at `scale` px per PDF point.
 *
 * @param page Zero-based page index.
 * @param scale Output px per PDF point (use 2–3 per AGENTS.md).
 * @param options `withoutFormFields`: leave out the drawn look of fillable fields, for a view that
 *   lays its own controls over them (Fill PDF form); otherwise the old value shows under the new one.
 */
export async function renderPage(page: number, scale: number, options: { withoutFormFields?: boolean } = {}): Promise<PageImage> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const pdfPage = await (await sharedPdfDocument(pdfBytesCache)).getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  const annotationMode = options.withoutFormFields ? pdfjs.AnnotationMode.ENABLE_FORMS : pdfjs.AnnotationMode.ENABLE;
  await pdfPage.render({ canvasContext: context, viewport, canvas, annotationMode }).promise;
  pdfPage.cleanup();
  const uri = canvas.toDataURL('image/jpeg', 0.92);
  return { uri, pxWidth: canvas.width, pxHeight: canvas.height };
}

/**
 * Renders one area of a page, sharply, for reading small text (page images are 2 px per pt).
 *
 * @param page Zero-based page index.
 * @param rect Area, in PDF points (editor space, top-left origin).
 * @param scale Output px per PDF point.
 * @returns PNG data URL on a white background.
 */
export async function renderRegion(
  page: number,
  rect: { xPt: number; yPt: number; wPt: number; hPt: number },
  scale: number,
): Promise<string> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const pdfPage = await (await sharedPdfDocument(pdfBytesCache)).getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale, offsetX: -rect.xPt * scale, offsetY: -rect.yPt * scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.wPt * scale));
  canvas.height = Math.max(1, Math.round(rect.hPt * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  pdfPage.cleanup();
  return canvas.toDataURL('image/png');
}

/**
 * Renders one page to a canvas on a white background, for cutting several areas out of one render.
 *
 * @param page Zero-based page index.
 * @param scale Output px per PDF point.
 */
export async function renderPageCanvas(page: number, scale: number): Promise<HTMLCanvasElement> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const pdfPage = await (await sharedPdfDocument(pdfBytesCache)).getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  pdfPage.cleanup();
  return canvas;
}

/**
 * Renders a small preview of one page for the page list.
 *
 * @param page Zero-based page index.
 * @param widthPx Preview width, in px; the height follows the page's shape.
 * @returns JPEG data URL.
 */
export async function renderThumbnail(page: number, widthPx: number): Promise<string> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const pdfPage = await (await sharedPdfDocument(pdfBytesCache)).getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale: widthPx / pdfPage.getViewport({ scale: 1 }).width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  pdfPage.cleanup();
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Samples the representative local background color in a band surrounding a page rectangle.
 *
 * @param uri Page background data URL.
 * @param xPx Left edge, in background-image px.
 * @param yPx Top edge, in background-image px.
 * @param wPx Width, in background-image px.
 * @param hPx Height, in background-image px.
 * @param marginPx Surrounding band width, in background-image px.
 */
export async function sampleAverageColor(
  uri: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
  marginPx: number,
): Promise<string> {
  return sampleAverageColorFromDataUrl(uri, xPx, yPx, wPx, hPx, marginPx);
}

/**
 * Samples page paper color from image corners (preferred for translate masks).
 *
 * @param uri Page background data URL.
 * @param pxWidth Image width, in px.
 * @param pxHeight Image height, in px.
 */
export async function samplePagePaperColor(
  uri: string,
  pxWidth: number,
  pxHeight: number,
): Promise<string> {
  return samplePagePaperColorFromDataUrl(uri, pxWidth, pxHeight);
}

/** Estimates dominant ink color inside a text region on the page background image. */
export async function sampleTextColor(
  uri: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): Promise<string> {
  return sampleTextColorFromDataUrl(uri, xPx, yPx, wPx, hPx);
}

/** Reads the loaded PDF as a base64 string for legacy font detection. */
export async function getPdfBase64(): Promise<string> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  return uint8ArrayToBase64(pdfBytesCache);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
