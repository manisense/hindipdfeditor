import { describe, expect, it } from 'vitest';

import type { DetectedTable } from './tableDetect';
import { pageBlocks, paragraphsFromLines } from './wordLayout';
import type { OcrLine } from '../state/editStore';

const line = (text: string, xPt: number, yPt: number, wPt: number, hPt = 12, bold = false): OcrLine => ({
  id: text, text, xPt, yPt, wPt, hPt, baselineYPt: yPt + hPt * 0.8, font: { serif: false, bold, italic: false },
});

describe('paragraphsFromLines', () => {
  it('joins the lines of one paragraph and starts a new one after a gap', () => {
    const paragraphs = paragraphsFromLines(
      [
        line('पहली पंक्ति जो पूरी चौड़ाई', 72, 100, 450),
        line('तक जाती है।', 72, 116, 120),
        line('नया अनुच्छेद', 72, 160, 140),
      ],
      600,
    );
    expect(paragraphs.map((p) => p.text)).toEqual(['पहली पंक्ति जो पूरी चौड़ाई तक जाती है।', 'नया अनुच्छेद']);
    expect(paragraphs[1].spaceBeforePt).toBeGreaterThan(10);
  });

  it('keeps headings separate, with their size and weight', () => {
    const [heading, body] = paragraphsFromLines([line('Title', 72, 60, 120, 24, true), line('Body text', 72, 100, 300)], 600);
    expect(heading).toMatchObject({ text: 'Title', bold: true });
    expect(heading.fontSizePt).toBeGreaterThan(body.fontSizePt);
  });

  it('centres a short line in the middle of the page', () => {
    const [centred] = paragraphsFromLines([line('शीर्षक', 250, 60, 100)], 600);
    expect(centred.align).toBe('center');
  });

  it('reads lines top to bottom, left to right', () => {
    const paragraphs = paragraphsFromLines([line('दूसरी', 72, 200, 100), line('पहली', 72, 100, 100)], 600);
    expect(paragraphs.map((p) => p.text)).toEqual(['पहली', 'दूसरी']);
  });
});

describe('paragraphsFromLines with a row split into pieces', () => {
  it('joins pieces of one visual row, left to right, before grouping', () => {
    const paragraphs = paragraphsFromLines([line('conjunct + े', 300, 100, 200), line('धर्म → reph', 72, 101, 200)], 600);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe('धर्म → reph conjunct + े');
  });
});

describe('pageBlocks', () => {
  const table: DetectedTable = {
    xPt: 50,
    yPt: 200,
    wPt: 300,
    hPt: 40,
    columns: [50, 200, 350],
    rows: [200, 220, 240],
    cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1, xPt: 50, yPt: 200, wPt: 150, hPt: 40 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1, xPt: 200, yPt: 200, wPt: 150, hPt: 20 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1, xPt: 200, yPt: 220, wPt: 150, hPt: 20 },
    ],
  };

  it('puts lines in their cells and keeps paragraphs above and below in order', () => {
    const blocks = pageBlocks(
      [
        line('Heading above', 50, 100, 200),
        line('आरक्षक / रसोइया', 55, 214, 80),
        line('अनारक्षित', 205, 204, 60),
        line('14', 205, 224, 20),
        line('Text below', 50, 300, 200),
      ],
      595,
      [table],
    );
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'table', 'paragraph']);
    const grid = blocks[1].kind === 'table' ? blocks[1].table : null;
    expect(grid?.columnWidthsPt).toEqual([150, 150]);
    expect(grid?.rows.map((row) => row.cells.map((c) => [c.col, c.rowSpan, c.paragraphs.map((p) => p.text).join('|')]))).toEqual([
      [
        [0, 2, 'आरक्षक / रसोइया'],
        [1, 1, 'अनारक्षित'],
      ],
      [[1, 1, '14']],
    ]);
    expect(grid?.rows[0].cells[0].paragraphs[0].indentPt).toBe(5);
  });

  it('is plain paragraphs when the page has no tables', () => {
    const blocks = pageBlocks([line('One', 50, 100, 100), line('Two', 50, 200, 100)], 595, []);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('places pictures by their top edge, and a picture inside a table in its cell', () => {
    const jpeg = new Uint8Array([1, 2, 3]);
    const blocks = pageBlocks(
      [line('Heading above', 50, 100, 200), line('अनारक्षित', 205, 204, 60), line('Text below', 50, 400, 200)],
      595,
      [table],
      [
        { xPt: 60, yPt: 300, wPt: 80, hPt: 60, jpeg },
        { xPt: 60, yPt: 205, wPt: 30, hPt: 30, jpeg },
      ],
    );
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'table', 'picture', 'paragraph']);
    const picture = blocks[2].kind === 'picture' ? blocks[2] : null;
    expect(picture?.indentPt).toBe(10);
    const grid = blocks[1].kind === 'table' ? blocks[1].table : null;
    expect(grid?.rows[0].cells[0].pictures).toHaveLength(1);
  });
});

