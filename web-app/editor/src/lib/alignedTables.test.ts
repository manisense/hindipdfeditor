import { describe, expect, it } from 'vitest';

import { detectAlignedTables } from './alignedTables';
import type { DetectedTable } from './tableDetect';
import type { OcrLine } from '../state/editStore';

/** A line of text 12 pt tall at (x, y), about 5 pt per character. */
const line = (text: string, xPt: number, yPt: number, wPt = text.length * 5): OcrLine => ({
  id: `${text}@${xPt},${yPt}`,
  text,
  xPt,
  yPt,
  wPt,
  hPt: 12,
  source: 'embedded',
});

/** Rows of cells at the given column left edges, 20 pt apart from y = 100. */
function rows(columns: number[], values: string[][], top = 100): OcrLine[] {
  return values.flatMap((row, r) => row.map((text, c) => line(text, columns[c], top + r * 20)));
}

const cellOf = (table: DetectedTable, l: OcrLine) => {
  const x = l.xPt + l.wPt / 2;
  const y = l.yPt + l.hPt / 2;
  return table.cells.find((c) => x >= c.xPt && x < c.xPt + c.wPt && y >= c.yPt && y < c.yPt + c.hPt);
};

describe('detectAlignedTables', () => {
  const values = [
    ['Post', 'North', 'South'],
    ['Cook', '14', '9'],
    ['Tailor', '2', '17'],
    ['Barber', '5', '6'],
  ];

  it('finds a table aligned by space, one value per cell', () => {
    const lines = rows([60, 220, 340], values);
    const tables = detectAlignedTables(lines, []);
    expect(tables).toHaveLength(1);
    const [table] = tables;
    expect(table.ruled).toBe(false);
    expect(table.columns).toHaveLength(4);
    expect(table.rows).toHaveLength(5);
    const seen = new Set<string>();
    lines.forEach((l, i) => {
      const cell = cellOf(table, l);
      expect(cell).toMatchObject({ row: Math.floor(i / 3), col: i % 3, rowSpan: 1, colSpan: 1 });
      seen.add(`${cell?.row},${cell?.col}`);
    });
    expect(seen.size).toBe(12);
  });

  it('reads Hindi cells the same way', () => {
    const hindi = [
      ['पद', 'उत्तर', 'दक्षिण'],
      ['रसोइया', '14', '9'],
      ['दर्जी', '2', '17'],
    ];
    expect(detectAlignedTables(rows([60, 220, 340], hindi), [])).toHaveLength(1);
  });

  it('keeps a wrapped cell line in the row above it', () => {
    const lines = [...rows([60, 220, 340], values.slice(0, 2)), line('assistant', 60, 140), ...rows([60, 220, 340], values.slice(2), 160)];
    const [table] = detectAlignedTables(lines, []);
    expect(table.rows).toHaveLength(5);
    expect(cellOf(table, line('assistant', 60, 140))).toMatchObject({ row: 1, col: 0 });
    expect(cellOf(table, line('Tailor', 60, 160))).toMatchObject({ row: 2, col: 0 });
  });

  it('leaves text above and below the table out of it', () => {
    const title = line('Vacancies by zone in the year 2026, all posts', 60, 60);
    const after = line('Apply online before the last date of the notice.', 60, 200);
    const [table] = detectAlignedTables([title, ...rows([60, 220, 340], values), after], []);
    expect(cellOf(table, title)).toBeUndefined();
    expect(cellOf(table, after)).toBeUndefined();
  });

  it('ignores plain paragraphs', () => {
    const prose = [0, 1, 2, 3, 4].map((i) => line('A line of ordinary running text that fills the width', 60, 100 + i * 14, 470));
    expect(detectAlignedTables(prose, [])).toEqual([]);
  });

  it('ignores a two-column page layout', () => {
    const text = 'running text in a newspaper column, set to its width';
    const lines = [0, 1, 2, 3, 4].flatMap((i) => [line(text, 40, 100 + i * 14, 250), line(text, 305, 100 + i * 14, 250)]);
    expect(detectAlignedTables(lines, [])).toEqual([]);
  });

  it('ignores numbered paragraphs with a hanging indent', () => {
    const text = 'अभ्यर्थियों को ऑनलाइन आवेदन पत्र में सभी विवरण सही भरने होंगे';
    const lines = ['9.1', '9.2', '9.3', '9.4'].flatMap((n, i) => [line(n, 60, 100 + i * 20), line(text, 100, 100 + i * 20, 400)]);
    expect(detectAlignedTables(lines, [])).toEqual([]);
  });

  it('ignores a short numbered list', () => {
    const lines = ['(i)', '(ii)', '(iii)', '(iv)'].flatMap((n, i) => [line(n, 60, 100 + i * 20), line('Aadhaar card', 100, 100 + i * 20)]);
    expect(detectAlignedTables(lines, [])).toEqual([]);
  });

  it('keeps a numbered table with three or more columns', () => {
    const lines = rows([60, 100, 260], [['1.', 'Cook', '14'], ['2.', 'Tailor', '2'], ['3.', 'Barber', '5']]);
    expect(detectAlignedTables(lines, [])).toHaveLength(1);
  });

  it('needs at least three rows', () => {
    expect(detectAlignedTables(rows([60, 220, 340], values.slice(0, 2)), [])).toEqual([]);
  });

  it('splits rows far apart into separate tables', () => {
    const lines = [...rows([60, 220, 340], values), ...rows([60, 220, 340], values, 400)];
    expect(detectAlignedTables(lines, []).map((t) => Math.round(t.yPt))).toEqual([98, 398]);
  });

  it('skips lines inside a ruled table', () => {
    const ruled: DetectedTable = {
      xPt: 50,
      yPt: 90,
      wPt: 400,
      hPt: 100,
      columns: [50, 450],
      rows: [90, 190],
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1, xPt: 50, yPt: 90, wPt: 400, hPt: 100 }],
      ruled: true,
    };
    expect(detectAlignedTables(rows([60, 220, 340], values), [ruled])).toEqual([]);
  });
});
