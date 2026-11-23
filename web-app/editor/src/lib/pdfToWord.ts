import { AlignmentType, Document, Packer, PageOrientation, Paragraph, TextRun } from 'docx';

import type { WordParagraph } from './wordLayout';

/** One PDF page's text for the Word document. */
export type WordPage = {
  /** Page size, in PDF points. */
  widthPt: number;
  heightPt: number;
  paragraphs: WordParagraph[];
};

/** Twentieths of a point (twips), Word's page-layout unit. */
const TWIPS_PER_PT = 20;
/** Page margins, in PDF points (half an inch). */
const MARGIN_PT = 36;
/** Latin text font, and the font for Hindi (Word sets Devanagari with the complex-script font). */
const LATIN_FONT = 'Calibri';
const HINDI_FONT = 'Nirmala UI';

/**
 * Builds a Word (.docx) file from a PDF's text: one section per page with the page's size and
 * orientation, one paragraph per detected paragraph with its size, weight, alignment, indent and
 * the space above it. Hindi is set in Nirmala UI (Windows' Devanagari font; Word substitutes on
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
        page.paragraphs.length > 0
          ? page.paragraphs.map(
              (paragraph) =>
                new Paragraph({
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
                }),
            )
          : [new Paragraph({})],
    })),
  });
  return Packer.toBlob(document);
}
