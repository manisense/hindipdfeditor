import {
  concatTransformationMatrix,
  drawObject,
  fill,
  PDFDocument,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFillingRgbColor,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib';
import html2canvas from 'html2canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { Matrix, UserRect } from './contentStreamText';
import type { DevanagariFontFamily } from './fontAsset';
import {
  TEXT_FRAGMENT_PAD_RATIO,
  TEXT_RENDER_PX_PER_PT,
  textEditFragmentHtml,
  textFragmentsDocumentHtml,
} from './htmlCompositor';
import { eraseInkKeepingLines } from './inkEraser';
import { removePageText } from './pdfTextRemoval';
import type { DocumentState, MaskEdit, PageState, TextEdit } from '../state/editStore';

/** Raster scale (px per pt) for cleaned patches over scans or text the remover could not reach. */
const PATCH_PX_PER_PT = 3;

/** A rectangle in editor space: PDF points, top-left origin, page rotation applied. */
type EditorRect = { xPt: number; yPt: number; wPt: number; hPt: number };

type RenderedText = { png: Uint8Array; xPt: number; yPt: number; wPt: number; hPt: number };

function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function toUserRect(editorToUser: Matrix, rect: EditorRect): UserRect {
  const corners = [
    apply(editorToUser, rect.xPt, rect.yPt),
    apply(editorToUser, rect.xPt + rect.wPt, rect.yPt),
    apply(editorToUser, rect.xPt, rect.yPt + rect.hPt),
    apply(editorToUser, rect.xPt + rect.wPt, rect.yPt + rect.hPt),
  ];
  return {
    x0: Math.min(...corners.map(([x]) => x)),
    y0: Math.min(...corners.map(([, y]) => y)),
    x1: Math.max(...corners.map(([x]) => x)),
    y1: Math.max(...corners.map(([, y]) => y)),
  };
}

function hexToRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return dataUrlBytes(canvas.toDataURL('image/png'));
}

let imageCounter = 0;

/** Draws an image so it fills `rect` (editor space) on `page`. */
function drawImageInEditorSpace(page: PDFPage, editorToUser: Matrix, image: PDFImage, rect: EditorRect) {
  const name = `HpeImg${(imageCounter += 1)}`;
  page.node.setXObject(PDFName.of(name), image.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...editorToUser),
    concatTransformationMatrix(rect.wPt, 0, 0, -rect.hPt, rect.xPt, rect.yPt + rect.hPt),
    drawObject(name),
    popGraphicsState(),
  );
}

function fillInEditorSpace(page: PDFPage, editorToUser: Matrix, rect: EditorRect, color: string) {
  const [r, g, b] = hexToRgb(color);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...editorToUser),
    setFillingRgbColor(r, g, b),
    rectangle(rect.xPt, rect.yPt, rect.wPt, rect.hPt),
    fill(),
    popGraphicsState(),
  );
}

/** Renders every text edit with the browser (HarfBuzz shaping) into transparent PNGs. */
async function renderTextEdits(
  edits: TextEdit[],
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
): Promise<Map<string, RenderedText>> {
  const rendered = new Map<string, RenderedText>();
  if (edits.length === 0) return rendered;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  document.body.appendChild(host);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:4000px;height:2000px;border:0;background:transparent';
  host.appendChild(frame);
  try {
    const frameDoc = frame.contentDocument;
    if (!frameDoc) throw new Error('exportPdf: text frame unavailable');
    frameDoc.open();
    frameDoc.write(
      textFragmentsDocumentHtml(
        edits.map((edit, i) => textEditFragmentHtml(edit, `t${i}`)),
        fontBase64ByFamily,
      ),
    );
    frameDoc.close();
    await Promise.all(
      Object.keys(fontBase64ByFamily).map((family) => frameDoc.fonts.load(`48px '${family}'`)),
    );
    await frameDoc.fonts.ready;
    for (const [i, edit] of edits.entries()) {
      const element = frameDoc.getElementById(`t${i}`);
      if (!element || edit.text.trim().length === 0) continue;
      const canvas = await html2canvas(element, { backgroundColor: null, scale: 1, logging: false });
      const padPt = edit.fontSizePt * TEXT_FRAGMENT_PAD_RATIO;
      rendered.set(edit.id, {
        png: await canvasPng(canvas),
        xPt: edit.xPt - padPt,
        yPt: edit.yPt - padPt,
        wPt: canvas.width / TEXT_RENDER_PX_PER_PT,
        hPt: canvas.height / TEXT_RENDER_PX_PER_PT,
      });
    }
  } finally {
    document.body.removeChild(host);
  }
  return rendered;
}

/** Renders one page at `PATCH_PX_PER_PT` and returns cleaned PNG patches for `rects`. */
async function cleanedPatches(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rects: EditorRect[],
): Promise<Uint8Array[]> {
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: PATCH_PX_PER_PT });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    return Promise.all(rects.map((rect) => cleanRegion(canvas, rect, PATCH_PX_PER_PT)));
  } finally {
    await doc.destroy();
  }
}

async function cleanRegion(source: HTMLCanvasElement, rect: EditorRect, pxPerPt: number) {
  const x = Math.max(0, Math.round(rect.xPt * pxPerPt));
  const y = Math.max(0, Math.round(rect.yPt * pxPerPt));
  const width = Math.max(1, Math.min(source.width - x, Math.round(rect.wPt * pxPerPt)));
  const height = Math.max(1, Math.min(source.height - y, Math.round(rect.hPt * pxPerPt)));
  const patch = document.createElement('canvas');
  patch.width = width;
  patch.height = height;
  const context = patch.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  eraseInkKeepingLines(pixels.data, width, height);
  context.putImageData(pixels, 0, 0);
  return canvasPng(patch);
}

/** Editor rects (pt, top-left) of text that pdf.js still finds inside each rect after removal. */
async function rectsWithRemainingText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rects: EditorRect[],
): Promise<Set<number>> {
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const remaining = new Set<number>();
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim().length === 0) continue;
      const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const cx = x + item.width / 2;
      const cy = baseline - item.height * 0.35;
      rects.forEach((r, i) => {
        if (cx >= r.xPt && cx <= r.xPt + r.wPt && cy >= r.yPt && cy <= r.yPt + r.hPt) remaining.add(i);
      });
    }
    return remaining;
  } finally {
    await doc.destroy();
  }
}

async function loadOutputDocument(sourcePdfBytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(sourcePdfBytes.slice());
  } catch {
    try {
      // Owner-password PDFs (common for government notices) open with an empty user password.
      return await PDFDocument.load(sourcePdfBytes.slice(), { ignoreEncryption: true, password: '' });
    } catch {
      return null;
    }
  }
}

/** Builds a new document from the page backgrounds when the source cannot be modified. */
async function rasterOutputDocument(doc: DocumentState): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  for (const page of doc.pages) {
    const pdfPage = out.addPage([page.widthPt, page.heightPt]);
    const image = await out.embedJpg(dataUrlBytes(page.backgroundImageUri));
    pdfPage.drawImage(image, { x: 0, y: 0, width: page.widthPt, height: page.heightPt });
  }
  return out;
}

async function backgroundPatches(page: PageState, rects: EditorRect[]): Promise<Uint8Array[]> {
  const image = new Image();
  image.src = page.backgroundImageUri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = page.imagePxWidth;
  canvas.height = page.imagePxHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  const pxPerPt = page.imagePxWidth / page.widthPt;
  return Promise.all(rects.map((rect) => cleanRegion(canvas, rect, pxPerPt)));
}

/**
 * Exports the edited document as a new PDF built from the original file. Unedited pages are
 * copied unchanged, so their text stays selectable and searchable and their links, forms and
 * bookmarks survive. On edited pages: replaced text is deleted from the page content (or, on
 * scans and wherever deletion cannot reach, cleaned from a raster patch that keeps ruled lines);
 * whiteouts are vector rectangles; new text is rendered by the browser, which shapes Devanagari
 * (Plan A), and placed as a transparent image. Never overwrites the source file.
 *
 * @param doc Full in-memory document state; positions are in PDF points.
 * @param sourcePdfBytes Bytes of the opened PDF (read, never modified).
 * @param fontBase64ByFamily Base64 font data keyed by family name.
 * @returns A `Blob` of the exported PDF.
 */
export async function exportPdf(
  doc: DocumentState,
  sourcePdfBytes: Uint8Array,
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
): Promise<Blob> {
  if (doc.pages.length === 0) throw new Error('exportPdf: document has no pages');

  const loaded = await loadOutputDocument(sourcePdfBytes);
  const out = loaded ?? (await rasterOutputDocument(doc));
  const editedPages = doc.pages.filter((page) => page.edits.length > 0);

  const transforms = new Map<number, Matrix>();
  if (loaded) {
    const source = await pdfjs.getDocument({ data: sourcePdfBytes.slice() }).promise;
    try {
      for (const page of editedPages) {
        const viewport = (await source.getPage(page.pageIndex + 1)).getViewport({ scale: 1 });
        transforms.set(page.pageIndex, invert(viewport.transform as Matrix));
      }
    } finally {
      await source.destroy();
    }
  }
  const editorToUser = (page: PageState): Matrix =>
    transforms.get(page.pageIndex) ?? [1, 0, 0, -1, 0, page.heightPt];

  const replaceRects = new Map<number, EditorRect[]>();
  const needsPatch = new Map<number, Set<number>>();
  for (const page of editedPages) {
    const rects = page.edits
      .filter((e): e is MaskEdit => e.type === 'mask' && e.kind === 'replace')
      .map(({ xPt, yPt, wPt, hPt }) => ({ xPt, yPt, wPt, hPt }));
    replaceRects.set(page.pageIndex, rects);
    if (!loaded) {
      needsPatch.set(page.pageIndex, new Set(rects.map((_, i) => i)));
      continue;
    }
    const userRects = rects.map((rect) => toUserRect(editorToUser(page), rect));
    const { removedPerRect, unresolvedRects } = removePageText(out, page.pageIndex, userRects);
    needsPatch.set(
      page.pageIndex,
      new Set(rects.map((_, i) => i).filter((i) => removedPerRect[i] === 0 || unresolvedRects.has(i))),
    );
  }

  let afterRemoval: Uint8Array | null = null;
  if (loaded && editedPages.length > 0) {
    afterRemoval = await out.save();
    for (const page of editedPages) {
      const rects = replaceRects.get(page.pageIndex) ?? [];
      if (rects.length === 0) continue;
      const remaining = await rectsWithRemainingText(afterRemoval, page.pageIndex, rects);
      for (const i of remaining) needsPatch.get(page.pageIndex)?.add(i);
    }
  }

  const textEdits = editedPages.flatMap((page) =>
    page.edits.filter((e): e is TextEdit => e.type === 'text'),
  );
  const renderedText = await renderTextEdits(textEdits, fontBase64ByFamily);

  for (const page of editedPages) {
    const pdfPage = out.getPage(page.pageIndex);
    const toUser = editorToUser(page);
    const rects = replaceRects.get(page.pageIndex) ?? [];
    const patchIndexes = [...(needsPatch.get(page.pageIndex) ?? [])];
    if (patchIndexes.length > 0) {
      const patchRects = patchIndexes.map((i) => rects[i]);
      const patches = afterRemoval
        ? await cleanedPatches(afterRemoval, page.pageIndex, patchRects)
        : await backgroundPatches(page, patchRects);
      for (const [k, png] of patches.entries()) {
        drawImageInEditorSpace(pdfPage, toUser, await out.embedPng(png), patchRects[k]);
      }
    }
    for (const mask of page.edits) {
      if (mask.type === 'mask' && mask.kind !== 'replace') fillInEditorSpace(pdfPage, toUser, mask, mask.color);
    }
    for (const edit of page.edits) {
      const text = edit.type === 'text' ? renderedText.get(edit.id) : undefined;
      if (text) drawImageInEditorSpace(pdfPage, toUser, await out.embedPng(text.png), text);
    }
  }

  const bytes = await out.save();
  await assertNonEmptyAndReopenable(bytes, doc.pageCount);
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
}

async function assertNonEmptyAndReopenable(bytes: Uint8Array, expectedPages: number): Promise<void> {
  if (bytes.length === 0) {
    throw new Error('exportPdf: output is empty');
  }
  let reopened: PDFDocument;
  try {
    reopened = await PDFDocument.load(bytes);
  } catch (cause) {
    throw new Error('exportPdf: output could not be re-parsed as a PDF', { cause });
  }
  if (reopened.getPageCount() !== expectedPages) {
    throw new Error(`exportPdf: expected ${expectedPages} pages, got ${reopened.getPageCount()}`);
  }
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
