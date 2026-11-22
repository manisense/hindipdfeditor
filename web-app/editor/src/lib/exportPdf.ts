import {
  concatTransformationMatrix,
  drawObject,
  BlendMode,
  fill,
  PDFDocument,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingRgbColor,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfjsDocumentParams } from './pdfjsParams';

import type { Matrix, UserRect } from './contentStreamText';
import { applyChangedSpans } from './changedSpan';
import { baselineOffsetRatio, loadFontFor, measureTextWidthPt } from './fontAsset';
import { eraseInkKeepingLines } from './inkEraser';
import { isHighlight, isWhiteout, patchesBackground, removesTextUnder } from './maskKinds';
import { removePageText } from './pdfTextRemoval';
import { rasteriseTextEdits } from './textRaster';
import { inkColumns, nearestGap } from './wordGaps';
import type { DocumentState, MaskEdit, PageState, TextEdit } from '../state/editStore';

/** Raster scale (px per pt) for cleaned patches over scans or text the remover could not reach. */
const PATCH_PX_PER_PT = 3;

/** A rectangle in editor space: PDF points, top-left origin, page rotation applied. */
type EditorRect = { xPt: number; yPt: number; wPt: number; hPt: number };

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

/** Embeds a PNG or JPEG data URL; JPEG stays JPEG, so photos keep their size. */
async function embedDataUrlImage(out: PDFDocument, uri: string): Promise<PDFImage> {
  const bytes = dataUrlBytes(uri);
  return uri.startsWith('data:image/jpeg') ? out.embedJpg(bytes) : out.embedPng(bytes);
}

/** Paints a highlight over `rect` with a multiply blend, so the marked content stays readable. */
function highlightInEditorSpace(page: PDFPage, editorToUser: Matrix, rect: EditorRect, color: string) {
  const [r, g, b] = hexToRgb(color);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...editorToUser));
  page.drawRectangle({
    x: rect.xPt,
    y: rect.yPt,
    width: rect.wPt,
    height: rect.hPt,
    color: rgb(r, g, b),
    blendMode: BlendMode.Multiply,
  });
  page.pushOperators(popGraphicsState());
}

/** Renders one page at `PATCH_PX_PER_PT` and returns cleaned PNG patches for `rects`. */
async function cleanedPatches(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rects: EditorRect[],
): Promise<Uint8Array[]> {
  const doc = await pdfjs.getDocument(pdfjsDocumentParams(pdfBytes.slice())).promise;
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
  const doc = await pdfjs.getDocument(pdfjsDocumentParams(pdfBytes.slice())).promise;
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

/** Renders a page that was never shown (pages are rendered lazily) as a JPEG data URL. */
async function renderMissingBackground(source: pdfjs.PDFDocumentProxy, page: PageState): Promise<string> {
  const pdfPage = await source.getPage(page.pageIndex + 1);
  const viewport = pdfPage.getViewport({ scale: page.imagePxWidth / page.widthPt });
  const canvas = document.createElement('canvas');
  canvas.width = page.imagePxWidth;
  canvas.height = page.imagePxHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  pdfPage.cleanup();
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Builds a new document from the page backgrounds when the source cannot be modified. */
async function rasterOutputDocument(doc: DocumentState, sourcePdfBytes: Uint8Array): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  let source: pdfjs.PDFDocumentProxy | undefined;
  try {
    for (const page of doc.pages) {
      const pdfPage = out.addPage([page.widthPt, page.heightPt]);
      source ??= page.backgroundImageUri
        ? undefined
        : await pdfjs.getDocument(pdfjsDocumentParams(sourcePdfBytes.slice())).promise;
      const uri = page.backgroundImageUri || (await renderMissingBackground(source!, page));
      const image = await out.embedJpg(dataUrlBytes(uri));
      pdfPage.drawImage(image, { x: 0, y: 0, width: page.widthPt, height: page.heightPt });
    }
  } finally {
    await source?.destroy();
  }
  return out;
}

async function backgroundCanvas(page: PageState): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = page.backgroundImageUri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = page.imagePxWidth;
  canvas.height = page.imagePxHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  return canvas;
}

/** Finds blank word gaps on a page's background near a point, within a mask's text band. */
function gapFinder(page: PageState, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  const pxPerPt = page.imagePxWidth / page.widthPt;
  return (mask: MaskEdit, xPt: number): { startPt: number; endPt: number } | null => {
    if (!context) return null;
    const radiusPx = mask.hPt * pxPerPt;
    const x0 = Math.max(0, Math.round(xPt * pxPerPt - radiusPx));
    const width = Math.min(canvas.width - x0, Math.round(2 * radiusPx));
    const y0 = Math.max(0, Math.round(mask.yPt * pxPerPt));
    const height = Math.min(canvas.height - y0, Math.round(mask.hPt * pxPerPt));
    if (width < 2 || height < 2) return null;
    const columns = inkColumns(context.getImageData(x0, y0, width, height).data, width, height);
    const gap = nearestGap(columns, xPt * pxPerPt - x0, radiusPx, Math.max(2, 0.1 * mask.hPt * pxPerPt));
    return gap ? { startPt: (x0 + gap.start) / pxPerPt, endPt: (x0 + gap.end) / pxPerPt } : null;
  };
}

/** Blank space kept before the next word when new text runs past its line, as a fraction of the band height. */
const NEXT_INK_CLEARANCE = 0.25;

/**
 * Finds where the page stops being blank to the right of a point in a mask's band: the next ink,
 * or the right edge of the page's text column, whichever comes first.
 */
function freeSpaceFinder(page: PageState, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  const pxPerPt = page.imagePxWidth / page.widthPt;
  const lineEnds = page.ocrLines.map((line) => line.xPt + line.wPt);
  const columnRightPt = lineEnds.length > 0 ? Math.max(...lineEnds) : page.widthPt * 0.95;
  return (mask: MaskEdit, fromPt: number): number => {
    if (!context || fromPt >= columnRightPt) return fromPt;
    const x0 = Math.max(0, Math.round(fromPt * pxPerPt));
    const width = Math.min(canvas.width, Math.round(columnRightPt * pxPerPt)) - x0;
    const y0 = Math.max(0, Math.round(mask.yPt * pxPerPt));
    const height = Math.min(canvas.height - y0, Math.round(mask.hPt * pxPerPt));
    if (width < 1 || height < 2) return fromPt;
    const firstInk = inkColumns(context.getImageData(x0, y0, width, height).data, width, height).indexOf(1);
    if (firstInk < 0) return columnRightPt;
    return Math.max(fromPt, (x0 + firstInk) / pxPerPt - NEXT_INK_CLEARANCE * mask.hPt);
  };
}

async function backgroundPatches(page: PageState, rects: EditorRect[]): Promise<Uint8Array[]> {
  const canvas = await backgroundCanvas(page);
  const pxPerPt = page.imagePxWidth / page.widthPt;
  return Promise.all(rects.map((rect) => cleanRegion(canvas, rect, pxPerPt)));
}

/**
 * Exports the edited document as a new PDF built from the original file. Unedited pages are
 * copied unchanged, so their text stays selectable and searchable and their links, forms and
 * bookmarks survive. On edited pages: replaced text is deleted from the page content (or, on
 * scans and wherever deletion cannot reach, cleaned from a raster patch that keeps ruled lines);
 * whiteouts delete the text under them and are filled vector rectangles; highlights are
 * multiply-blended rectangles over everything; inserted images and signatures are embedded as
 * they are (JPEG or PNG with transparency); new text is rendered by the browser, which shapes Devanagari
 * (Plan A), painted at the measured baseline and placed as a transparent image. Never overwrites the source file.
 *
 * @param source Full in-memory document state; positions are in PDF points.
 * @param sourcePdfBytes Bytes of the opened PDF (read, never modified).
 * @returns A `Blob` of the exported PDF.
 */
export async function exportPdf(source: DocumentState, sourcePdfBytes: Uint8Array): Promise<Blob> {
  if (source.pages.length === 0) throw new Error('exportPdf: document has no pages');

  // Redraw only the words that changed; an unchanged replacement leaves its line untouched.
  const allTextEdits = source.pages.flatMap((page) =>
    page.edits.filter((e): e is TextEdit => e.type === 'text'),
  );
  await Promise.all(
    allTextEdits.map((e) =>
      loadFontFor(`${e.text}${e.original?.text ?? ''}`, e.fontFamily, e.fontWeight ?? 'normal', e.fontStyle),
    ),
  );
  const baselineRatios = new Map<string, number | undefined>();
  for (const edit of allTextEdits.filter((e) => e.original)) {
    baselineRatios.set(
      edit.id,
      await baselineOffsetRatio(edit.fontFamily, edit.fontWeight ?? 'normal', edit.fontStyle, edit.text),
    );
  }
  const narrowedPages: PageState[] = [];
  for (const page of source.pages) {
    const narrows = page.edits.some((e) => e.type === 'text' && e.original);
    const canvas = narrows ? await backgroundCanvas(page) : undefined;
    narrowedPages.push({
      ...page,
      edits: applyChangedSpans(
        page.edits,
        (edit, text) =>
          measureTextWidthPt(text, edit.fontFamily, edit.fontWeight ?? 'normal', edit.fontSizePt) * (edit.scaleX ?? 1),
        canvas && gapFinder(page, canvas),
        (edit) => baselineRatios.get(edit.id),
        canvas && freeSpaceFinder(page, canvas),
      ),
    });
  }
  const doc: DocumentState = { ...source, pages: narrowedPages };

  const loaded = await loadOutputDocument(sourcePdfBytes);
  const out = loaded ?? (await rasterOutputDocument(doc, sourcePdfBytes));
  const editedPages = doc.pages.filter((page) => page.edits.length > 0);

  const transforms = new Map<number, Matrix>();
  if (loaded) {
    const source = await pdfjs.getDocument(pdfjsDocumentParams(sourcePdfBytes.slice())).promise;
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

  // Text is deleted under replacements and whiteouts; only replacements get a cleaned patch where
  // deletion could not reach, since a whiteout is painted over anyway.
  const removalMasks = new Map<number, MaskEdit[]>();
  const needsPatch = new Map<number, Set<number>>();
  for (const page of editedPages) {
    const masks = page.edits.filter((e): e is MaskEdit => e.type === 'mask' && removesTextUnder(e));
    removalMasks.set(page.pageIndex, masks);
    const patchable = masks.map((_, i) => i).filter((i) => patchesBackground(masks[i]));
    if (!loaded) {
      needsPatch.set(page.pageIndex, new Set(patchable));
      continue;
    }
    const userRects = masks.map((rect) => toUserRect(editorToUser(page), rect));
    const { removedPerRect, unresolvedRects } = removePageText(out, page.pageIndex, userRects);
    needsPatch.set(
      page.pageIndex,
      new Set(patchable.filter((i) => removedPerRect[i] === 0 || unresolvedRects.has(i))),
    );
  }

  let afterRemoval: Uint8Array | null = null;
  if (loaded && editedPages.length > 0) {
    afterRemoval = await out.save();
    for (const page of editedPages) {
      const masks = removalMasks.get(page.pageIndex) ?? [];
      const patchable = masks.map((_, i) => i).filter((i) => patchesBackground(masks[i]));
      if (patchable.length === 0) continue;
      const remaining = await rectsWithRemainingText(
        afterRemoval,
        page.pageIndex,
        patchable.map((i) => masks[i]),
      );
      for (const k of remaining) needsPatch.get(page.pageIndex)?.add(patchable[k]);
    }
  }

  const textEdits = editedPages.flatMap((page) =>
    page.edits.filter((e): e is TextEdit => e.type === 'text'),
  );
  const renderedText = await rasteriseTextEdits(textEdits);

  for (const page of editedPages) {
    const pdfPage = out.getPage(page.pageIndex);
    const toUser = editorToUser(page);
    const rects = removalMasks.get(page.pageIndex) ?? [];
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
      if (mask.type === 'mask' && isWhiteout(mask)) fillInEditorSpace(pdfPage, toUser, mask, mask.color);
    }
    // New text and inserted images are drawn in the order they were added.
    for (const edit of page.edits) {
      if (edit.type === 'image') {
        drawImageInEditorSpace(pdfPage, toUser, await embedDataUrlImage(out, edit.uri), edit);
        continue;
      }
      const text = edit.type === 'text' ? renderedText.get(edit.id) : undefined;
      if (text) drawImageInEditorSpace(pdfPage, toUser, await out.embedPng(text.png), text);
    }
    for (const mask of page.edits) {
      if (mask.type === 'mask' && isHighlight(mask)) highlightInEditorSpace(pdfPage, toUser, mask, mask.color);
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
