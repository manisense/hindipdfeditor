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
  return `${truncateUtf8(base, MAX_BASE_NAME_BYTES).replace(/[.\s]+$/, '')}.pdf`;
}

/**
 * Longest base name, in UTF-8 bytes. Android allows 255 bytes per file name; this leaves room
 * for a ` (n)` suffix and `.pdf`. Devanagari takes 3 bytes per code point, so this is about 66
 * Devanagari characters.
 */
export const MAX_BASE_NAME_BYTES = 200;

/** Combining marks (general and Devanagari: signs, nukta, matras, virama), ZWNJ/ZWJ, VS. */
const JOINING_CHAR =
  /[\u0300-\u036f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962\u0963\u200c\u200d\ufe00-\ufe0f]/;
const VIRAMA = '\u094d';

function utf8Length(codePoint: number): number {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/**
 * Cuts `text` to at most `maxBytes` UTF-8 bytes (a byte count) at a code point boundary, then
 * backs off so no Devanagari cluster is split: the cut never leaves a following mark, matra,
 * nukta or joiner behind, and never ends on a virama or joiner (half a conjunct).
 */
export function truncateUtf8(text: string, maxBytes: number): string {
  const chars = Array.from(text);
  let bytes = 0;
  let end = 0;
  while (end < chars.length) {
    const size = utf8Length(chars[end].codePointAt(0) ?? 0);
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += 1;
  }
  if (end === chars.length) return text;
  const splitsCluster = (cut: number) => {
    const next = chars[cut];
    const last = chars[cut - 1];
    return (
      (next !== undefined && JOINING_CHAR.test(next)) ||
      last === VIRAMA ||
      last === '\u200d' ||
      last === '\u200c'
    );
  };
  while (end > 0 && splitsCluster(end)) end -= 1;
  return chars.slice(0, end).join('');
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
