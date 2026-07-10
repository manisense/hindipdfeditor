import { PDFDocument } from '@cantoo/pdf-lib';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { documentHtml } from './htmlCompositor';
import type { DevanagariFontFamily } from './fontAsset';
import type { DocumentState } from '../state/editStore';

/**
 * Exports the full edited document to a new PDF via the same Render & Print pipeline as the
 * mobile app: assemble HTML with embedded fonts, let Chromium shape Devanagari, rasterize each
 * page, and combine into a downloadable PDF. Never overwrites the source file.
 *
 * @param doc Full in-memory document state.
 * @param fontBase64ByFamily Base64 font data keyed by family name.
 * @returns A `Blob` of the exported PDF.
 */
export async function exportPdf(
  doc: DocumentState,
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
): Promise<Blob> {
  const firstPage = doc.pages[0];
  if (!firstPage) {
    throw new Error('exportPdf: document has no pages');
  }

  const backgroundImageDataUrls = doc.pages.map((page) => page.backgroundImageUri);
  const html = documentHtml(doc, fontBase64ByFamily, backgroundImageDataUrls);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const iframe = document.createElement('iframe');
  iframe.style.width = `${firstPage.imagePxWidth}px`;
  iframe.style.height = `${firstPage.imagePxHeight}px`;
  iframe.style.border = 'none';
  host.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) throw new Error('exportPdf: iframe document unavailable');
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await waitForFonts(iframeDoc);

    const pdf = new jsPDF({
      orientation: firstPage.widthPt > firstPage.heightPt ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [firstPage.widthPt, firstPage.heightPt],
      compress: true,
    });

    for (let i = 0; i < doc.pages.length; i++) {
      const page = doc.pages[i];
      const pageRoot = iframeDoc.body.children[i] as HTMLElement | undefined;
      if (!pageRoot?.firstElementChild) {
        throw new Error(`exportPdf: could not find rendered page ${i}`);
      }
      const pageElement = pageRoot.firstElementChild as HTMLElement;

      const canvas = await html2canvas(pageElement, {
        scale: 1,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: page.imagePxWidth,
        height: page.imagePxHeight,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) pdf.addPage([page.widthPt, page.heightPt]);
      pdf.addImage(imgData, 'JPEG', 0, 0, page.widthPt, page.heightPt);
    }

    const blob = pdf.output('blob');
    await assertNonEmptyAndReopenable(blob);
    return blob;
  } finally {
    document.body.removeChild(host);
  }
}

async function waitForFonts(doc: Document): Promise<void> {
  if ('fonts' in doc) {
    await doc.fonts.ready;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function assertNonEmptyAndReopenable(blob: Blob): Promise<void> {
  if (blob.size === 0) {
    throw new Error('exportPdf: output blob is empty');
  }
  const buffer = await blob.arrayBuffer();
  const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
  try {
    await PDFDocument.load(base64);
  } catch (cause) {
    throw new Error('exportPdf: output could not be re-parsed as a PDF', { cause });
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Triggers a browser download of the exported PDF blob. */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
