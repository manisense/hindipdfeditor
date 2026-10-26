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

/**
 * What the save sheet reports as changed: `lines` counts text boxes with text plus covered
 * areas that no text box replaces; `pages` counts pages with at least one edit. Both are counts.
 */
export function changeCounts(doc: DocumentState): { lines: number; pages: number } {
  let lines = 0;
  let pages = 0;
  for (const page of doc.pages) {
    if (page.edits.length > 0) pages += 1;
    const replacedMasks = new Set(
      page.edits.flatMap((edit) =>
        edit.type === 'text' && edit.replacement?.maskId ? [edit.replacement.maskId] : [],
      ),
    );
    for (const edit of page.edits) {
      if (edit.type === 'text' ? edit.text.trim() !== '' : !replacedMasks.has(edit.id)) lines += 1;
    }
  }
  return { lines, pages };
}

const PDF_EXTENSION = /\.pdf$/i;
/** Path separators, characters Android storage rejects, and control characters. */
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * Suggested name, without extension, for the edited copy of `sourceName`: `<name>-edited`, or
 * `document-edited` when the source has no name.
 */
export function defaultEditedName(sourceName = ''): string {
  const base = sourceName.replace(PDF_EXTENSION, '').trim();
  return `${base || 'document'}-edited`;
}

/**
 * Turns what the person typed into a safe file name ending in `.pdf`: drops a typed `.pdf`,
 * replaces path separators and other unsafe characters with `-`, drops leading dots and dashes
 * (no hidden files), and falls back to `fallback` (itself sanitised) when nothing usable is left.
 */
export function outputFileName(typed: string, fallback: string): string {
  const clean = (name: string) =>
    name
      .trim()
      .replace(PDF_EXTENSION, '')
      .replace(UNSAFE_FILE_NAME_CHARS, '-')
      .replace(/^[.\-\s]+/, '')
      .trim();
  const base = clean(typed) || clean(fallback) || 'document-edited';
  return `${base}.pdf`;
}
