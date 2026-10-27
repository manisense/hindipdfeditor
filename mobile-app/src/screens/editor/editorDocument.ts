import type { DocumentState, Edit, TextEdit } from '../../state/editStore';

/** The editor's tap modes: change a detected line, add new text, or cover old text. */
export type EditMode = 'edit' | 'addText' | 'erase';

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
 * areas that no filled text box replaces; `pages` counts pages with at least one edit. Both are counts.
 */
export function changeCounts(doc: DocumentState): { lines: number; pages: number } {
  let lines = 0;
  let pages = 0;
  for (const page of doc.pages) {
    if (page.edits.length > 0) pages += 1;
    // A replacement emptied of text still counts once, through its mask.
    const filledReplacements = new Set(
      page.edits.flatMap((edit) =>
        edit.type === 'text' && edit.replacement?.maskId && edit.text.trim() !== ''
          ? [edit.replacement.maskId]
          : [],
      ),
    );
    for (const edit of page.edits) {
      if (edit.type === 'text') {
        if (edit.text.trim() !== '') lines += 1;
      } else if (!filledReplacements.has(edit.id)) {
        lines += 1;
      }
    }
  }
  return { lines, pages };
}

const PDF_EXTENSION = /\.pdf$/i;

/**
 * Suggested name, without extension, for the edited copy of `sourceName`: `<name>-edited`, or
 * `document-edited` when the source has no name.
 */
export function defaultEditedName(sourceName = ''): string {
  const base = sourceName.replace(PDF_EXTENSION, '').trim();
  return `${base || 'document'}-edited`;
}

/** The style fields the line sheet can change, for comparing a line before and after. */
function sameStyle(a: TextEdit, b: TextEdit): boolean {
  return (
    a.fontSizePt === b.fontSizePt &&
    a.color === b.color &&
    a.fontFamily === b.fontFamily &&
    (a.fontWeight ?? 'normal') === (b.fontWeight ?? 'normal')
  );
}

/**
 * True when a line replacement created in this sheet session still reads exactly like the
 * detected original and keeps the style it was created with, so Done can drop it (and its
 * cover) instead of keeping a mask with identical text on top.
 */
export function isUntouchedReplacement(created: TextEdit, now: TextEdit): boolean {
  const original = now.replacement?.ocrLine?.text;
  return original !== undefined && now.text === original && sameStyle(created, now);
}

/**
 * One undo step per line-sheet session. `start(true)` is for a line just created after its own
 * checkpoint; `start(false)` for reopening an existing line, whose first change then takes a
 * checkpoint. Call `beforeChange()` before every change made from the sheet, so text and style
 * changes within one opening undo together and never merge into an earlier line's step.
 */
export function createEditSession(checkpoint: () => void) {
  let pending = false;
  return {
    start(created: boolean) {
      pending = !created;
    },
    beforeChange() {
      if (!pending) return;
      pending = false;
      checkpoint();
    },
  };
}
