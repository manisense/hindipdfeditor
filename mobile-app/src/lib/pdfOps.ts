import { PDFDocument } from '@cantoo/pdf-lib';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { renderPage } from './pdfToImages';

/**
 * Reads a local file URI into a base64 string.
 */
async function readBase64(fileUri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Reads a local file URI into a Uint8Array for @cantoo/pdf-lib.
 */
export async function uriToBytes(fileUri: string): Promise<Uint8Array> {
  const base64 = await readBase64(fileUri);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Saves PDF base64 string directly to a fresh unique output file in the sandboxed cache directory.
 */
export async function savePdfBase64ToCache(base64: string, prefix = 'output'): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('File system cache directory unavailable');
  const targetUri = `${cacheDir}${prefix}-${Crypto.randomUUID()}.pdf`;

  await FileSystem.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return targetUri;
}

/**
 * Saves PDF bytes to a fresh unique output file in the sandboxed cache directory.
 */
export async function savePdfBytesToCache(bytes: Uint8Array, prefix = 'output'): Promise<string> {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  const base64 = btoa(binary);
  return await savePdfBase64ToCache(base64, prefix);
}

/**
 * Merges multiple PDF files into one document in specified order.
 * Never mutates source documents.
 */
export async function mergePdfFiles(sourceUris: string[]): Promise<string> {
  if (sourceUris.length < 2) {
    throw new Error('Select at least two PDF files to merge');
  }

  const mergedDoc = await PDFDocument.create();
  for (const uri of sourceUris) {
    const base64 = await readBase64(uri);
    const srcDoc = await PDFDocument.load(base64, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  const outputBase64 = await mergedDoc.saveAsBase64();
  return await savePdfBase64ToCache(outputBase64, 'merged');
}

/**
 * Extracts specific 0-based page indices into a new PDF document.
 * Preserves the supplied page order, deduplicates indices, and validates bounds.
 *
 * @param sourceUri Local URI of the source PDF.
 * @param pageIndices 0-based page indices to extract (e.g. [0, 2, 4]).
 */
export async function extractPdfPages(sourceUri: string, pageIndices: number[]): Promise<string> {
  if (!pageIndices || pageIndices.length === 0) {
    throw new Error('extractPdfPages: at least one page index must be specified');
  }

  const base64 = await readBase64(sourceUri);
  const srcDoc = await PDFDocument.load(base64, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  const uniqueIndices: number[] = [];
  const seen = new Set<number>();
  for (const idx of pageIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= totalPages) {
      throw new Error(`extractPdfPages: page index ${idx} is out of bounds (0..${totalPages - 1})`);
    }
    if (!seen.has(idx)) {
      seen.add(idx);
      uniqueIndices.push(idx);
    }
  }

  if (uniqueIndices.length === 0) {
    throw new Error('extractPdfPages: at least one unique valid page index must be specified');
  }

  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(srcDoc, uniqueIndices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const outputBase64 = await outDoc.saveAsBase64();
  return await savePdfBase64ToCache(outputBase64, 'split');
}

/**
 * Extracts an inclusive 1-based page range into a new PDF.
 *
 * @param sourceUri Local URI of the source PDF.
 * @param fromPage 1-based start page (inclusive).
 * @param toPage 1-based end page (inclusive).
 */
export async function splitPdfFile(
  sourceUri: string,
  fromPage: number,
  toPage: number,
): Promise<string> {
  const base64 = await readBase64(sourceUri);
  const srcDoc = await PDFDocument.load(base64, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();

  if (fromPage < 1 || toPage > pageCount || fromPage > toPage) {
    throw new Error(`Page range must be between 1 and ${pageCount}`);
  }

  const indices = Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage - 1 + i);
  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(srcDoc, indices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const outputBase64 = await outDoc.saveAsBase64();
  return await savePdfBase64ToCache(outputBase64, 'split');
}

/**
 * Compresses a PDF by rasterizing each page with native PdfRenderer and rebuilding with optimized JPEGs.
 * Page point dimensions are strictly preserved.
 */
export async function compressPdfFile(
  sourceUri: string,
  pageCount: number,
  scale = 2,
): Promise<{ uri: string; originalBytes: number; compressedBytes: number; pageCount: number }> {
  const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
  const originalBytes =
    sourceInfo.exists && typeof sourceInfo.size === 'number' ? sourceInfo.size : 0;

  const outDoc = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    // Rasterize page to high-quality JPEG using native PdfRenderer
    const image = await renderPage(sourceUri, pageIndex, scale);
    const jpegBase64 = await readBase64(image.uri);
    const embeddedJpg = await outDoc.embedJpg(jpegBase64);

    const widthPt = image.pxWidth / scale;
    const heightPt = image.pxHeight / scale;
    const page = outDoc.addPage([widthPt, heightPt]);
    page.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
    });
  }

  const outputBase64 = await outDoc.saveAsBase64();
  const outputUri = await savePdfBase64ToCache(outputBase64, 'compressed');
  const outInfo = await FileSystem.getInfoAsync(outputUri);
  const compressedBytes =
    outInfo.exists && typeof outInfo.size === 'number'
      ? outInfo.size
      : Math.floor((outputBase64.length * 3) / 4);

  return {
    uri: outputUri,
    originalBytes,
    compressedBytes,
    pageCount,
  };
}
