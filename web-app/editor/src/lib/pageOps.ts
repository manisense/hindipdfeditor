import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  degrees,
  type PDFObject,
  type PDFPage,
} from '@cantoo/pdf-lib';

import type { DocumentState, PageState } from '../state/editStore';

/** A change to the document's pages, by zero-based page index. */
export type PageOp =
  | { kind: 'move'; from: number; to: number }
  | { kind: 'rotate'; index: number; degrees: 90 | -90 }
  | { kind: 'delete'; index: number }
  | { kind: 'insertBlank'; after: number };

/**
 * The document's pages after an operation, in order: each is an old page (`from`, zero-based) or
 * a new blank page (`from: null`), turned clockwise by `rotate` degrees (0, 90, 180 or 270).
 */
export type PagePlanEntry = { from: number | null; rotate: number };

/**
 * The page order an operation produces.
 *
 * @param pageCount Number of pages before the operation.
 */
export function pagePlan(op: PageOp, pageCount: number): PagePlanEntry[] {
  const plan: PagePlanEntry[] = Array.from({ length: pageCount }, (_, from) => ({ from, rotate: 0 }));
  switch (op.kind) {
    case 'move': {
      const [moved] = plan.splice(op.from, 1);
      plan.splice(op.to, 0, moved);
      return plan;
    }
    case 'rotate':
      plan[op.index] = { from: op.index, rotate: (op.degrees + 360) % 360 };
      return plan;
    case 'delete':
      plan.splice(op.index, 1);
      return plan;
    case 'insertBlank':
      plan.splice(op.after + 1, 0, { from: null, rotate: 0 });
      return plan;
  }
}

/** Where an old page ended up (zero-based), or null when it was deleted. */
export function newIndexOf(plan: readonly PagePlanEntry[], oldIndex: number): number | null {
  const index = plan.findIndex((entry) => entry.from === oldIndex);
  return index < 0 ? null : index;
}

/**
 * The editor state after a page operation: every page keeps its edits, detected lines and image,
 * renumbered. A turned page swaps its sides and is rendered and read again (it must have no edits:
 * they cannot be turned with it). A blank page takes the size of the page before it.
 *
 * @param pxPerPt Scale page images are rendered at, in px per PDF point.
 */
export function remapDocument(
  document: DocumentState,
  plan: readonly PagePlanEntry[],
  newId: string,
  pxPerPt: number,
): DocumentState {
  const pages = plan.map((entry, index): PageState => {
    if (entry.from === null) {
      const neighbour = document.pages[plan[index - 1]?.from ?? 0] ?? document.pages[0];
      const sideways = (plan[index - 1]?.rotate ?? 0) % 180 !== 0;
      const widthPt = sideways ? neighbour.heightPt : neighbour.widthPt;
      const heightPt = sideways ? neighbour.widthPt : neighbour.heightPt;
      return {
        pageIndex: index,
        widthPt,
        heightPt,
        backgroundImageUri: '',
        imagePxWidth: Math.round(widthPt * pxPerPt),
        imagePxHeight: Math.round(heightPt * pxPerPt),
        edits: [],
        ocrLines: [],
      };
    }
    const old = document.pages[entry.from];
    const edits = old.edits.map((edit) => ({ ...edit, page: index }));
    if (entry.rotate % 180 !== 0) {
      return {
        ...old,
        pageIndex: index,
        widthPt: old.heightPt,
        heightPt: old.widthPt,
        imagePxWidth: old.imagePxHeight,
        imagePxHeight: old.imagePxWidth,
        backgroundImageUri: '',
        edits,
        ocrLines: [],
      };
    }
    if (entry.rotate !== 0) return { ...old, pageIndex: index, backgroundImageUri: '', edits, ocrLines: [] };
    return { ...old, pageIndex: index, edits };
  });
  const legacyFontWarnings = document.legacyFontWarnings.flatMap((warning) => {
    const page = newIndexOf(plan, warning.page);
    return page === null ? [] : [{ ...warning, page }];
  });
  return { ...document, id: newId, pageCount: pages.length, pages, legacyFontWarnings };
}

/** Page attributes a page may inherit from the page-tree nodes above it (PDF 32000-1, 7.7.3.4). */
const INHERITABLE = ['Resources', 'MediaBox', 'CropBox', 'Rotate'] as const;

/** Copies inherited attributes onto a page, so it keeps them when re-parented to the root. */
function materialiseInherited(page: PDFPage): void {
  for (const key of INHERITABLE) {
    const name = PDFName.of(key);
    if (page.node.get(name) !== undefined) continue;
    let parent = page.node.lookupMaybe(PDFName.of('Parent'), PDFDict);
    while (parent) {
      const value = parent.get(name);
      if (value !== undefined) {
        page.node.set(name, value);
        break;
      }
      parent = parent.lookupMaybe(PDFName.of('Parent'), PDFDict);
    }
  }
}

/** Every indirect object reachable from the trailer (catalog, info, encryption). */
function reachableRefs(pdf: PDFDocument): Set<string> {
  const seen = new Set<string>();
  const stack: PDFObject[] = [];
  const { trailerInfo } = pdf.context;
  for (const value of [trailerInfo.Root, trailerInfo.Info, trailerInfo.Encrypt]) if (value) stack.push(value);
  while (stack.length > 0) {
    const value = stack.pop()!;
    if (value instanceof PDFRef) {
      const key = value.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      const target = pdf.context.lookup(value);
      if (target) stack.push(target);
    } else if (value instanceof PDFDict) {
      for (const [, entry] of value.entries()) stack.push(entry);
    } else if (value instanceof PDFArray) {
      for (let i = 0; i < value.size(); i++) stack.push(value.get(i));
    } else if (value instanceof PDFStream) {
      stack.push(value.dict);
    }
  }
  return seen;
}

/**
 * Applies a page plan to a PDF and returns the new bytes. Pages are reordered inside the same
 * document rather than copied out of it, so the document's bookmarks, form fields and links stay
 * with it, and page content is not touched. The page tree is rebuilt as one flat list (inherited
 * resources, sizes and rotation are copied onto each page first). Objects only a deleted page used
 * are dropped, so a deleted page's content does not stay hidden in the file. The input bytes are
 * not modified.
 *
 * @param bytes PDF bytes.
 */
export async function applyPagePlan(bytes: Uint8Array, plan: readonly PagePlanEntry[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
  const pages = pdf.getPages();
  for (const page of pages) materialiseInherited(page);
  const ordered: PDFPage[] = [];
  for (const entry of plan) {
    if (entry.from === null) {
      const before = ordered[ordered.length - 1] ?? pages[0];
      const sideways = before.getRotation().angle % 180 !== 0;
      const { width, height } = before.getSize();
      // Added at the end of the tree; the tree is rebuilt below.
      ordered.push(pdf.addPage(sideways ? [height, width] : [width, height]));
      continue;
    }
    const page = pages[entry.from];
    if (entry.rotate !== 0) page.setRotation(degrees((page.getRotation().angle + entry.rotate) % 360));
    ordered.push(page);
  }
  const rootRef = pdf.catalog.get(PDFName.of('Pages')) as PDFRef;
  const root = pdf.catalog.Pages();
  for (const page of ordered) page.node.set(PDFName.of('Parent'), rootRef);
  root.set(PDFName.of('Kids'), pdf.context.obj(ordered.map((page) => page.ref)));
  root.set(PDFName.of('Count'), PDFNumber.of(ordered.length));
  const reachable = reachableRefs(pdf);
  for (const [ref] of pdf.context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.toString())) pdf.context.delete(ref);
  }
  return pdf.save();
}
