import type { OcrLine } from '../state/editStore';

/** Why a line is worth a look: where its text came from. */
export type CheckReason = 'ocr' | 'degraded';

export type LineToCheck = { line: OcrLine; reason: CheckReason };

const LETTER = /[\p{L}]/u;

/**
 * The lines of a page worth a look, top to bottom: read by OCR from the page image, or PDF text
 * that OCR could not confirm. Text read through a font whose map was rebuilt from the font itself
 * (web ADR 0022) is exact and not listed: on Word government PDFs it is every Hindi line, and the
 * word list lacks too many formal words to single any out. Lines without letters and lines
 * already replaced by an edit are left out.
 *
 * @param lines The page's detected lines (boxes in pt, top-left origin).
 * @param editedLineIds Ids of lines an edit has replaced.
 */
export function linesToCheck(lines: readonly OcrLine[], editedLineIds: ReadonlySet<string> = new Set()): LineToCheck[] {
  return lines
    .flatMap((line): LineToCheck[] => {
      if (editedLineIds.has(line.id) || !LETTER.test(line.text)) return [];
      if (line.source === 'ocr') return [{ line, reason: 'ocr' }];
      if (line.source === 'embedded-degraded') return [{ line, reason: 'degraded' }];
      return [];
    })
    .sort((a, b) => a.line.yPt - b.line.yPt || a.line.xPt - b.line.xPt);
}
