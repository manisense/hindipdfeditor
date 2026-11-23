import type { OcrLine } from '../state/editStore';

/** A paragraph for the Word document, with its look taken from the PDF lines it came from. */
export type WordParagraph = {
  text: string;
  /** Font size, in PDF points. */
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center';
  /** Space above the paragraph, in PDF points. */
  spaceBeforePt: number;
  /** Indent from the left margin, in PDF points. */
  indentPt: number;
};

/** Font size as a share of a detected line's box height (boxes include ascenders and descenders). */
const SIZE_PER_HEIGHT = 0.8;
/** Line steps up to this many line heights stay in one paragraph. */
const SAME_PARAGRAPH_STEP = 1.7;

const baseline = (line: OcrLine) => line.baselineYPt ?? line.yPt + line.hPt;

/**
 * Groups a page's detected lines into paragraphs: a line joins the paragraph above when it
 * follows closely, starts at the same left edge and has the same size and weight; a short line
 * whose middle is the page's middle is centred.
 *
 * @param lines Detected lines; boxes in PDF points (top-left origin).
 * @param pageWidthPt Page width, in PDF points.
 */
export function paragraphsFromLines(lines: readonly OcrLine[], pageWidthPt: number): WordParagraph[] {
  const ordered = joinRows(lines.filter((line) => line.text.trim())).sort(
    (a, b) => baseline(a) - baseline(b) || a.xPt - b.xPt,
  );
  const margin = Math.min(...ordered.map((line) => line.xPt), pageWidthPt * 0.1);
  const out: (WordParagraph & { last: OcrLine })[] = [];
  for (const line of ordered) {
    const fontSizePt = Math.max(6, Math.round(line.hPt * SIZE_PER_HEIGHT * 2) / 2);
    const bold = Boolean(line.font?.bold);
    const italic = Boolean(line.font?.italic);
    const middle = line.xPt + line.wPt / 2;
    const centred = Math.abs(middle - pageWidthPt / 2) < pageWidthPt * 0.04 && line.wPt < pageWidthPt * 0.6 && line.xPt > margin + 24;
    const previous = out[out.length - 1];
    const step = previous ? baseline(line) - baseline(previous.last) : Infinity;
    const joins =
      previous &&
      !centred &&
      previous.align === 'left' &&
      step <= SAME_PARAGRAPH_STEP * line.hPt &&
      Math.abs(line.xPt - previous.last.xPt) < line.hPt &&
      Math.abs(previous.fontSizePt - fontSizePt) <= 1 &&
      previous.bold === bold;
    if (joins) {
      previous.text = `${previous.text} ${line.text.trim()}`;
      previous.last = line;
      continue;
    }
    const gap = previous ? line.yPt - (previous.last.yPt + previous.last.hPt) : 0;
    out.push({
      text: line.text.trim(),
      fontSizePt,
      bold,
      italic,
      align: centred ? 'center' : 'left',
      spaceBeforePt: Math.max(0, Math.round(gap)),
      indentPt: centred ? 0 : Math.max(0, Math.round(line.xPt - margin)),
      last: line,
    });
  }
  return out.map((paragraph) => ({
    text: paragraph.text,
    fontSizePt: paragraph.fontSizePt,
    bold: paragraph.bold,
    italic: paragraph.italic,
    align: paragraph.align,
    spaceBeforePt: paragraph.spaceBeforePt,
    indentPt: paragraph.indentPt,
  }));
}

/** Baselines closer than this share of the line height are one visual row. */
const SAME_ROW = 0.35;

/** Joins lines that sit on one visual row (OCR and text layers split rows) into one line each. */
function joinRows(lines: readonly OcrLine[]): OcrLine[] {
  const rows: OcrLine[][] = [];
  for (const line of [...lines].sort((a, b) => baseline(a) - baseline(b))) {
    const row = rows.find((r) => Math.abs(baseline(r[0]) - baseline(line)) <= SAME_ROW * Math.max(r[0].hPt, line.hPt));
    if (row) row.push(line);
    else rows.push([line]);
  }
  return rows.map((row) => {
    if (row.length === 1) return row[0];
    const ordered = row.sort((a, b) => a.xPt - b.xPt);
    const widest = ordered.reduce((a, b) => (b.wPt > a.wPt ? b : a));
    const right = Math.max(...ordered.map((l) => l.xPt + l.wPt));
    return {
      ...widest,
      text: ordered.map((l) => l.text.trim()).join(' '),
      xPt: ordered[0].xPt,
      wPt: right - ordered[0].xPt,
      hPt: Math.max(...ordered.map((l) => l.hPt)),
    };
  });
}
