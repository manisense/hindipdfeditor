import * as pdfjs from 'pdfjs-dist';

import { sampleAverageColorFromDataUrl, sampleTextColorFromDataUrl } from './imageColor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
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
  const doc = await pdfjs.getDocument({ data: pdfBytesCache.slice() }).promise;
  return doc.numPages;
}

/**
 * Rasterizes one page of the loaded PDF to a JPEG data URL at `scale` px per PDF point.
 *
 * @param page Zero-based page index.
 * @param scale Output px per PDF point (use 2–3 per AGENTS.md).
 */
export async function renderPage(page: number, scale: number): Promise<PageImage> {
  if (!pdfBytesCache) throw new Error('No PDF loaded');
  const doc = await pdfjs.getDocument({ data: pdfBytesCache.slice() }).promise;
  const pdfPage = await doc.getPage(page + 1);
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  const uri = canvas.toDataURL('image/jpeg', 0.92);
  return { uri, pxWidth: canvas.width, pxHeight: canvas.height };
}

/**
 * Samples the average background color in a band surrounding a rectangle on the page image.
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
