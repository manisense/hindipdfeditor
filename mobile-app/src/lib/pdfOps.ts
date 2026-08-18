import { PDFDocument } from '@cantoo/pdf-lib';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { renderPage } from './pdfToImages';

/**
 * Reads a local file URI into a Uint8Array for @cantoo/pdf-lib.
 */
export async function uriToBytes(fileUri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Saves PDF bytes to a fresh unique output file in the sandboxed cache directory.
 */
export async function savePdfBytesToCache(bytes: Uint8Array, prefix = 'output'): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('File system cache directory unavailable');
  const targetUri = `${cacheDir}${prefix}-${Crypto.randomUUID()}.pdf`;

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  await FileSystem.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return targetUri;
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
    const bytes = await uriToBytes(uri);
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  const outputBytes = await mergedDoc.save();
  return await savePdfBytesToCache(outputBytes, 'merged');
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
  const bytes = await uriToBytes(sourceUri);
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();

  if (fromPage < 1 || toPage > pageCount || fromPage > toPage) {
    throw new Error(`Page range must be between 1 and ${pageCount}`);
  }

  const outDoc = await PDFDocument.create();
  const indices = Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage - 1 + i);
  const copiedPages = await outDoc.copyPages(srcDoc, indices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const outputBytes = await outDoc.save();
  return await savePdfBytesToCache(outputBytes, 'split');
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
    const jpegBytes = await uriToBytes(image.uri);
    const embeddedJpg = await outDoc.embedJpg(jpegBytes);

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

  const outputBytes = await outDoc.save();
  const outputUri = await savePdfBytesToCache(outputBytes, 'compressed');
  const outInfo = await FileSystem.getInfoAsync(outputUri);
  const compressedBytes =
    outInfo.exists && typeof outInfo.size === 'number' ? outInfo.size : outputBytes.byteLength;

  return {
    uri: outputUri,
    originalBytes,
    compressedBytes,
    pageCount,
  };
}
