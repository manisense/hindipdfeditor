import { PDFDocument } from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist';

import { downloadPdfBlob } from './exportPdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Reads a File into a Uint8Array for pdf-lib. */
export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Triggers a browser download for raw PDF bytes. */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  downloadPdfBlob(blob, filename);
}

/**
 * Merges multiple PDF files into one document (page order follows input order).
 * Never mutates the source files.
 */
export async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error('Select at least two PDF files to merge');
  }
  const merged = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await fileToBytes(file), {
      ignoreEncryption: true,
    });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

/**
 * Extracts an inclusive 1-based page range into a new PDF.
 *
 * @param file Source PDF.
 * @param fromPage 1-based start page (inclusive).
 * @param toPage 1-based end page (inclusive).
 */
export async function splitPdfFile(
  file: File,
  fromPage: number,
  toPage: number,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(await fileToBytes(file), { ignoreEncryption: true });
  const pageCount = src.getPageCount();
  if (fromPage < 1 || toPage > pageCount || fromPage > toPage) {
    throw new Error(`Page range must be between 1 and ${pageCount}`);
  }
  const out = await PDFDocument.create();
  const indices = Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage - 1 + i);
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  return out.save();
}

/**
 * Compresses a PDF by rasterizing each page to JPEG and rebuilding the document.
 * Quality is 0–1 (lower = smaller file). Page sizes stay in PDF points.
 *
 * @param file Source PDF.
 * @param quality JPEG quality 0–1.
 * @param scale Raster scale relative to page points (2 = 2×).
 */
export async function compressPdfFile(
  file: File,
  quality = 0.72,
  scale = 1.5,
): Promise<{ bytes: Uint8Array; pageCount: number; originalBytes: number }> {
  const originalBytes = file.size;
  const data = await fileToBytes(file);
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise;
  const out = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    const jpegBytes = dataUrlToBytes(jpeg);
    const embedded = await out.embedJpg(jpegBytes);
    // pdf.js viewport is in CSS pixels at the given scale; page size in points is viewport/scale.
    const widthPt = viewport.width / scale;
    const heightPt = viewport.height / scale;
    const pdfPage = out.addPage([widthPt, heightPt]);
    pdfPage.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
  }

  const bytes = await out.save();
  return { bytes, pageCount: pdf.numPages, originalBytes };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Returns page count for a PDF file. */
export async function getPdfPageCount(file: File): Promise<number> {
  const src = await PDFDocument.load(await fileToBytes(file), { ignoreEncryption: true });
  return src.getPageCount();
}
