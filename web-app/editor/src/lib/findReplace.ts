import type { OcrLine, PageState, TextEdit } from '../state/editStore';

/** Exact match after Unicode normalisation (Devanagari has several encodings of the same text). */
function normalise(text: string): string {
  return text.normalize('NFC');
}

/**
 * Every occurrence of `query` in `text` replaced by `replacement`, or null when there is none.
 *
 * @param text Line or edit text.
 * @param query Text to find; empty never matches.
 * @param replacement Replacement text.
 */
export function replaceAllIn(text: string, query: string, replacement: string): string | null {
  const needle = normalise(query);
  if (needle.length === 0) return null;
  const haystack = normalise(text);
  if (!haystack.includes(needle)) return null;
  return haystack.split(needle).join(normalise(replacement));
}

export type FindResult = {
  /** Detected lines (not yet edited) that contain the query, by page. */
  lines: { pageIndex: number; line: OcrLine; newText: string }[];
  /** Existing text edits that contain the query. */
  edits: { pageIndex: number; edit: TextEdit; newText: string }[];
};

/**
 * Finds `query` across all pages: in detected lines and in text the user already edited.
 *
 * @param pages Document pages.
 * @param query Text to find.
 * @param replacement Text that replaces each occurrence.
 */
export function findInDocument(pages: readonly PageState[], query: string, replacement: string): FindResult {
  const result: FindResult = { lines: [], edits: [] };
  for (const page of pages) {
    for (const line of page.ocrLines) {
      const newText = replaceAllIn(line.text, query, replacement);
      if (newText !== null) result.lines.push({ pageIndex: page.pageIndex, line, newText });
    }
    for (const edit of page.edits) {
      if (edit.type !== 'text') continue;
      const newText = replaceAllIn(edit.text, query, replacement);
      if (newText !== null) result.edits.push({ pageIndex: page.pageIndex, edit, newText });
    }
  }
  return result;
}
