import type { DetectedTable } from './tableDetect';
import { xyCutRegions, type LayoutBox } from './xyCut';
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
 * @param marginPt Left edge that counts as no indent, in PDF points; by default the leftmost line.
 */
export function paragraphsFromLines(lines: readonly OcrLine[], pageWidthPt: number, marginPt?: number): WordParagraph[] {
  const ordered = joinRows(lines.filter((line) => line.text.trim())).sort(
    (a, b) => baseline(a) - baseline(b) || a.xPt - b.xPt,
  );
  const margin = marginPt ?? Math.min(...ordered.map((line) => line.xPt), pageWidthPt * 0.1);
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

/** A picture cut from the page, with its place and size in PDF points (top-left origin). */
export type WordPicture = { xPt: number; yPt: number; wPt: number; hPt: number; jpeg: Uint8Array };

/** One cell of a Word table: where it starts, what it spans, its paragraphs and pictures. */
export type WordTableCell = { col: number; colSpan: number; rowSpan: number; paragraphs: WordParagraph[]; pictures?: WordPicture[] };

/** A table for the Word document; sizes in PDF points. */
export type WordTable = {
  /** Left edge of the table from the page's left edge, in PDF points. */
  xPt: number;
  /** Whether the PDF draws the table's borders; a table aligned by space has none. */
  borders: boolean;
  columnWidthsPt: number[];
  /** Rows top to bottom; a cell spanning rows appears only in its first row. */
  rows: { heightPt: number; cells: WordTableCell[] }[];
};

/** Page content in reading order: paragraphs, tables and pictures. */
export type WordBlock =
  | { kind: 'paragraph'; paragraph: WordParagraph }
  | { kind: 'table'; table: WordTable }
  | { kind: 'picture'; picture: WordPicture; indentPt: number };

const centreOf = (line: OcrLine) => ({ x: line.xPt + line.wPt / 2, y: line.yPt + line.hPt / 2 });

type PageItem =
  | (LayoutBox & { kind: 'line'; line: OcrLine })
  | (LayoutBox & { kind: 'table'; table: DetectedTable })
  | (LayoutBox & { kind: 'picture'; picture: WordPicture });

/**
 * Lays a page out as paragraphs, tables and pictures in reading order: each line inside a
 * table goes to the cell holding its centre (a cell's lines become its paragraphs, indented from
 * the cell's edge), as does a picture inside a table; on digital pages, recursive XY-cut splits
 * multi-column regions around detected tables so columns read column by column; pictures and
 * tables sit between paragraphs by their top edge.
 *
 * @param lines Detected lines; boxes in PDF points (top-left origin).
 * @param pageWidthPt Page width, in PDF points.
 * @param tables Tables on the page (see `detectTables`, `detectAlignedTables`), boxes in PDF points.
 * @param pictures Pictures cut from the page, boxes in PDF points.
 */
export function pageBlocks(
  lines: readonly OcrLine[],
  pageWidthPt: number,
  tables: readonly DetectedTable[],
  pictures: readonly WordPicture[] = [],
): WordBlock[] {
  const textLines = lines.filter((line) => line.text.trim());
  const margin = Math.min(...textLines.map((line) => line.xPt), pageWidthPt * 0.1);
  const tableAt = (x: number, y: number) => tables.find((t) => x >= t.xPt && x <= t.xPt + t.wPt && y >= t.yPt && y <= t.yPt + t.hPt);
  const inTable = new Map<OcrLine, DetectedTable>();
  for (const line of textLines) {
    const { x, y } = centreOf(line);
    const table = tableAt(x, y);
    if (table) inTable.set(line, table);
  }
  const pictureTable = new Map<WordPicture, DetectedTable>();
  for (const picture of pictures) {
    const table = tableAt(picture.xPt + picture.wPt / 2, picture.yPt + picture.hPt / 2);
    if (table) pictureTable.set(picture, table);
  }
  const flow = textLines.filter((line) => !inTable.has(line));
  const freePictures = pictures.filter((p) => !pictureTable.has(p));

  const layoutItems: PageItem[] = [
    ...flow.map((line) => ({ kind: 'line' as const, line, xPt: line.xPt, yPt: line.yPt, wPt: line.wPt, hPt: line.hPt, isLine: true, isContent: true })),
    ...tables.map((table) => ({ kind: 'table' as const, table, xPt: table.xPt, yPt: table.yPt, wPt: table.wPt, hPt: table.hPt, isLine: false, isContent: true })),
    ...freePictures.map((picture) => ({ kind: 'picture' as const, picture, xPt: picture.xPt, yPt: picture.yPt, wPt: picture.wPt, hPt: picture.hPt, isLine: false, isContent: false })),
  ];

  // Run XY-cut column detection on digital pages (leave pure-OCR scanned pages in single flow).
  const isDigital = textLines.length > 0 && !textLines.every((line) => line.source === 'ocr');
  const regions = isDigital
    ? xyCutRegions(layoutItems, pageWidthPt)
    : [{ items: layoutItems, columnar: false }];

  const blocks: WordBlock[] = [];
  for (const region of regions) {
    const regionLines: OcrLine[] = [];
    const regionTables: DetectedTable[] = [];
    const regionPictures: WordPicture[] = [];
    for (const item of region.items) {
      if (item.kind === 'line') regionLines.push(item.line);
      else if (item.kind === 'table') regionTables.push(item.table);
      else regionPictures.push(item.picture);
    }

    const colMargin =
      region.columnar && regionLines.length > 0
        ? Math.min(...regionLines.map((line) => line.xPt))
        : margin;
    const colWidth =
      region.columnar && regionLines.length > 0
        ? Math.max(1, Math.max(...regionLines.map((line) => line.xPt + line.wPt)) - colMargin)
        : pageWidthPt;

    // Tables and free pictures anchor the region; paragraphs fill the space between them.
    const anchors = [
      ...regionTables.map((table) => ({ yPt: table.yPt, bottomPt: table.yPt + table.hPt, table })),
      ...regionPictures.map((picture) => ({ yPt: picture.yPt, bottomPt: picture.yPt + picture.hPt, picture })),
    ].sort((a, b) => a.yPt - b.yPt);

    let top = -Infinity;
    const paragraphsBetween = (bottom: number) => {
      const chunk = regionLines.filter((line) => centreOf(line).y >= top && centreOf(line).y < bottom);
      if (chunk.length === 0) return;
      const prepared = region.columnar ? chunk.map((line) => ({ ...line, xPt: line.xPt - colMargin })) : chunk;
      const paragraphs = paragraphsFromLines(prepared, colWidth, region.columnar ? 0 : margin);
      for (const paragraph of paragraphs) blocks.push({ kind: 'paragraph', paragraph });
    };

    for (const anchor of anchors) {
      paragraphsBetween(anchor.yPt);
      if ('table' in anchor && anchor.table) {
        const table = anchor.table;
        blocks.push({
          kind: 'table',
          table: wordTable(
            table,
            textLines.filter((line) => inTable.get(line) === table),
            pictures.filter((p) => pictureTable.get(p) === table),
          ),
        });
      } else if ('picture' in anchor && anchor.picture) {
        blocks.push({ kind: 'picture', picture: anchor.picture, indentPt: Math.max(0, Math.round(anchor.picture.xPt - colMargin)) });
      }
      top = Math.max(top, anchor.bottomPt);
    }
    paragraphsBetween(Infinity);
  }
  return blocks;
}

function wordTable(table: DetectedTable, lines: readonly OcrLine[], pictures: readonly WordPicture[] = []): WordTable {
  const rows = table.rows.slice(0, -1).map((y, r) => ({ heightPt: table.rows[r + 1] - y, cells: [] as WordTableCell[] }));
  for (const cell of table.cells) {
    const own = lines
      .filter((line) => {
        const { x, y } = centreOf(line);
        return x >= cell.xPt && x < cell.xPt + cell.wPt && y >= cell.yPt && y < cell.yPt + cell.hPt;
      })
      // Measured from the cell's own left edge, so indents and centring are the cell's.
      .map((line) => ({ ...line, xPt: line.xPt - cell.xPt }));
    const paragraphs = paragraphsFromLines(own, cell.wPt, 0).map((paragraph, i) => (i === 0 ? { ...paragraph, spaceBeforePt: 0 } : paragraph));
    const cellPictures = pictures.filter((p) => {
      const x = p.xPt + p.wPt / 2;
      const y = p.yPt + p.hPt / 2;
      return x >= cell.xPt && x < cell.xPt + cell.wPt && y >= cell.yPt && y < cell.yPt + cell.hPt;
    });
    rows[cell.row].cells.push({
      col: cell.col,
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan,
      paragraphs,
      ...(cellPictures.length > 0 ? { pictures: cellPictures } : {}),
    });
  }
  return {
    xPt: table.xPt,
    borders: table.ruled,
    columnWidthsPt: table.columns.slice(0, -1).map((x, c) => table.columns[c + 1] - x),
    rows,
  };
}
