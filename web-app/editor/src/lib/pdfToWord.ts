import {
  AlignmentType,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import type { WordBlock, WordParagraph, WordPicture, WordTable } from './wordLayout';

/** One PDF page's text for the Word document. */
export type WordPage = {
  /** Page size, in PDF points. */
  widthPt: number;
  heightPt: number;
  /** Paragraphs and tables in reading order. */
  blocks: WordBlock[];
};

/** Twentieths of a point (twips), Word's page-layout unit. */
const TWIPS_PER_PT = 20;
/** Page margins, in PDF points (half an inch). */
const MARGIN_PT = 36;
/** Latin text font, and the font for Hindi (Word sets Devanagari with the complex-script font). */
const LATIN_FONT = 'Calibri';
const HINDI_FONT = 'Nirmala UI';

function wordParagraph(paragraph: WordParagraph): Paragraph {
  return new Paragraph({
    alignment: paragraph.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: paragraph.spaceBeforePt * TWIPS_PER_PT, after: 0 },
    indent: paragraph.indentPt > 0 ? { left: paragraph.indentPt * TWIPS_PER_PT } : undefined,
    children: [
      new TextRun({
        text: paragraph.text,
        bold: paragraph.bold,
        boldComplexScript: paragraph.bold,
        italics: paragraph.italic,
        italicsComplexScript: paragraph.italic,
        size: paragraph.fontSizePt * 2,
        sizeComplexScript: paragraph.fontSizePt * 2,
        font: { ascii: LATIN_FONT, hAnsi: LATIN_FONT, cs: HINDI_FONT, eastAsia: LATIN_FONT },
      }),
    ],
  });
}

/** Word's image size unit: pixels at 96 per inch. */
const PX_PER_PT = 96 / 72;

/**
 * A picture as its own paragraph, at its size, indented to its left edge.
 *
 * @param maxWidthPt Widest the picture may be (the page's or cell's text width), in PDF points.
 */
function wordPicture(picture: WordPicture, indentPt: number, maxWidthPt: number): Paragraph {
  const scale = Math.min(1, maxWidthPt / Math.max(1, picture.wPt));
  return new Paragraph({
    indent: indentPt > 0 ? { left: Math.round(indentPt * TWIPS_PER_PT) } : undefined,
    children: [
      new ImageRun({
        type: 'jpg',
        data: picture.jpeg,
        transformation: { width: Math.round(picture.wPt * scale * PX_PER_PT), height: Math.round(picture.hPt * scale * PX_PER_PT) },
      }),
    ],
  });
}

/** Cell padding, in PDF points (Word's default is about 5.4 pt left and right). */
const CELL_PADDING_PT = 3;

function wordTable(table: WordTable): Table {
  const twips = (pt: number) => Math.max(0, Math.round(pt * TWIPS_PER_PT));
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: twips(table.columnWidthsPt.reduce((sum, w) => sum + w, 0)), type: WidthType.DXA },
    columnWidths: table.columnWidthsPt.map(twips),
    indent: { size: twips(table.xPt - MARGIN_PT), type: WidthType.DXA },
    rows: table.rows.map(
      (row) =>
        new TableRow({
          height: { value: twips(row.heightPt), rule: HeightRule.ATLEAST },
          children: row.cells.map(
            (cell) =>
              new TableCell({
                columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                width: { size: twips(table.columnWidthsPt.slice(cell.col, cell.col + cell.colSpan).reduce((sum, w) => sum + w, 0)), type: WidthType.DXA },
                margins: { top: twips(1), bottom: twips(1), left: twips(CELL_PADDING_PT), right: twips(CELL_PADDING_PT) },
                children:
                  cell.paragraphs.length > 0 || cell.pictures?.length
                    ? [
                        ...cell.paragraphs.map(wordParagraph),
                        ...(cell.pictures ?? []).map((picture) =>
                          wordPicture(picture, 0, table.columnWidthsPt.slice(cell.col, cell.col + cell.colSpan).reduce((sum, w) => sum + w, 0) - 2 * CELL_PADDING_PT),
                        ),
                      ]
                    : [new Paragraph({})],
              }),
          ),
        }),
    ),
  });
}

/**
 * Builds a Word (.docx) file from a PDF's text: one section per page with the page's size and
 * orientation, one paragraph per detected paragraph with its size, weight, alignment, indent and
 * the space above it, and ruled tables as Word tables (column widths, merged cells). Hindi is set in Nirmala UI (Windows' Devanagari font; Word substitutes on
 * other systems).
 */
export async function buildWordDocument(pages: readonly WordPage[]): Promise<Blob> {
  const document = new Document({
    creator: 'Hindi PDF Editor',
    sections: pages.map((page) => ({
      properties: {
        page: {
          size: {
            width: Math.round(page.widthPt * TWIPS_PER_PT),
            height: Math.round(page.heightPt * TWIPS_PER_PT),
            orientation: page.widthPt > page.heightPt ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: {
            top: MARGIN_PT * TWIPS_PER_PT,
            bottom: MARGIN_PT * TWIPS_PER_PT,
            left: MARGIN_PT * TWIPS_PER_PT,
            right: MARGIN_PT * TWIPS_PER_PT,
          },
        },
      },
      children:
        page.blocks.length > 0
          ? page.blocks.map((block) =>
              block.kind === 'table'
                ? wordTable(block.table)
                : block.kind === 'picture'
                  ? wordPicture(block.picture, block.indentPt, page.widthPt - 2 * MARGIN_PT - block.indentPt)
                  : wordParagraph(block.paragraph),
            )
          : [new Paragraph({})],
    })),
  });
  return Packer.toBlob(document);
}
