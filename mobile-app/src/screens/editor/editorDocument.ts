import type { DocumentState, Edit } from '../../state/editStore';

/** The edits array of every page, by reference; the store replaces arrays rather than mutating. */
export type EditsSnapshot = readonly (readonly Edit[])[];

/** Captures `doc`'s edit arrays so a later `hasUnsavedEdits` can tell whether anything changed. */
export function editsSnapshot(doc: DocumentState): EditsSnapshot {
  return doc.pages.map((page) => page.edits);
}

/**
 * True when `doc` has edits or pages that `saved` (the snapshot taken at load or at the last
 * successful save) does not. Undoing back to the saved state counts as unchanged, because undo
 * restores the same arrays. OCR results do not count: they never replace a page's edits array.
 */
export function hasUnsavedEdits(saved: EditsSnapshot, doc: DocumentState): boolean {
  if (saved.length !== doc.pages.length) return true;
  return doc.pages.some((page, index) => page.edits !== saved[index]);
}
