import type { DocumentState, Edit, OcrLine, PageState } from '../state/editStore';

/** Link between a replacement edit and what it took over, kept so deleting it restores the line. */
export type DraftPairing = { maskId?: string; ocrLine?: OcrLine; absorbed?: OcrLine[] };

/** Unsaved work on one opened PDF, as kept in browser storage between visits. */
export type Draft = {
  version: 1;
  documentId: string;
  sourceName: string;
  /** When the draft was written, in ms since the Unix epoch. */
  savedAt: number;
  pages: {
    /** Page size, in PDF points, to check the draft belongs to the file it is restored onto. */
    widthPt: number;
    heightPt: number;
    edits: Edit[];
    /** Detected lines of pages whose detection had finished; null when it had not. */
    ocrLines: OcrLine[] | null;
  }[];
  pairings: [string, DraftPairing][];
};

/** Size difference allowed between a draft's pages and the reopened file's, in PDF points. */
const SIZE_TOLERANCE_PT = 0.5;

/**
 * The draft of a document: its edits, detected lines of pages already read, and replacement
 * pairings. Page images are left out: they are rendered again from the PDF.
 *
 * @param savedAt Time of writing, in ms since the Unix epoch.
 */
export function draftOf(
  document: DocumentState,
  detected: (pageIndex: number) => boolean,
  pairings: Map<string, DraftPairing>,
  savedAt: number,
): Draft {
  return {
    version: 1,
    documentId: document.id,
    sourceName: document.sourceName,
    savedAt,
    pages: document.pages.map((page) => ({
      widthPt: page.widthPt,
      heightPt: page.heightPt,
      edits: page.edits,
      ocrLines: detected(page.pageIndex) ? page.ocrLines : null,
    })),
    pairings: [...pairings],
  };
}

/** Number of changes the user made, counting a replaced line once (not its mask as well). */
export function draftEditCount(draft: Draft): number {
  return draft.pages.reduce(
    (count, page) => count + page.edits.filter((e) => !(e.type === 'mask' && e.kind === 'replace')).length,
    0,
  );
}

/**
 * Puts a draft's edits and detected lines back on the pages of a freshly opened file.
 *
 * @returns The restored pages and the pages whose detection need not run again, or null when the
 *   draft was made for a file with different pages.
 */
export function applyDraft(
  pages: PageState[],
  draft: Draft,
): { pages: PageState[]; detectedPages: number[] } | null {
  if (pages.length !== draft.pages.length) return null;
  const fits = pages.every(
    (page, i) =>
      Math.abs(page.widthPt - draft.pages[i].widthPt) <= SIZE_TOLERANCE_PT &&
      Math.abs(page.heightPt - draft.pages[i].heightPt) <= SIZE_TOLERANCE_PT,
  );
  if (!fits) return null;
  const detectedPages: number[] = [];
  const restored = pages.map((page, i) => {
    const saved = draft.pages[i];
    if (saved.ocrLines) detectedPages.push(i);
    return { ...page, edits: saved.edits, ocrLines: saved.ocrLines ?? page.ocrLines };
  });
  return { pages: restored, detectedPages };
}
