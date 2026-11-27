import { describe, expect, it } from 'vitest';

import { detectRunningHeadersFooters, normalizeRunningText } from './runningHeaders';
import type { OcrLine } from '../state/editStore';

const line = (text: string, xPt: number, yPt: number, wPt = 200, hPt = 10): OcrLine => ({
  id: `${text}@${xPt},${yPt}`,
  text,
  xPt,
  yPt,
  wPt,
  hPt,
  baselineYPt: yPt + hPt * 0.8,
  font: { serif: false, bold: false, italic: false },
});

describe('normalizeRunningText', () => {
  it('normalises ASCII and Devanagari digits to #', () => {
    expect(normalizeRunningText('Page 3 of 9')).toBe('page # of #');
    expect(normalizeRunningText('Page 4 of 9')).toBe('page # of #');
    expect(normalizeRunningText('पृष्ठ १ / ५')).toBe('पृष्ठ # / #');
    expect(normalizeRunningText('पृष्ठ २ / ५')).toBe('पृष्ठ # / #');
  });
});

describe('detectRunningHeadersFooters', () => {
  it('detects a running header and digit-normalised running footer across 3 pages', () => {
    const pages = [1, 2, 3].map((n) => ({
      widthPt: 595,
      heightPt: 842,
      lines: [
        line('Regional Engineering Bulletin - 2026', 50, 30, 260),
        line(`Body paragraph on page ${n}`, 50, 200, 300, 12),
        line(`Internal Copy - Page ${n} of 3`, 50, 800, 200),
      ],
    }));
    const res = detectRunningHeadersFooters(pages);
    expect(res.omittedPerPage.map((s) => [...s].map((l) => l.text))).toEqual([
      ['Regional Engineering Bulletin - 2026', 'Internal Copy - Page 1 of 3'],
      ['Regional Engineering Bulletin - 2026', 'Internal Copy - Page 2 of 3'],
      ['Regional Engineering Bulletin - 2026', 'Internal Copy - Page 3 of 3'],
    ]);
    expect(res.header).toHaveLength(1);
    expect(res.header[0].runs).toEqual([{ kind: 'text', text: 'Regional Engineering Bulletin - 2026' }]);
    expect(res.footer).toHaveLength(1);
    expect(res.footer[0].runs).toEqual([
      { kind: 'text', text: 'Internal Copy - Page ' },
      { kind: 'pageNumber' },
      { kind: 'text', text: ' of 3' },
    ]);
  });

  it('never drops lines on documents with fewer than 3 pages', () => {
    const pages = [1, 2].map((n) => ({
      widthPt: 595,
      heightPt: 842,
      lines: [
        line('Repeated Header', 50, 30),
        line(`Page ${n} of 2`, 50, 800),
      ],
    }));
    const res = detectRunningHeadersFooters(pages);
    expect(res.omittedPerPage.every((s) => s.size === 0)).toBe(true);
    expect(res.header).toEqual([]);
    expect(res.footer).toEqual([]);
  });

  it('never drops a unique line even in the top or bottom 12 %', () => {
    const pages = [1, 2, 3].map((n) => ({
      widthPt: 595,
      heightPt: 842,
      lines: [
        line('Running Header', 50, 30),
        ...(n === 1 ? [line('Document Title Only On Page 1', 50, 60)] : []),
        ...(n === 3 ? [line('Closing Note Only On Page 3', 50, 790)] : []),
      ],
    }));
    const res = detectRunningHeadersFooters(pages);
    expect([...res.omittedPerPage[0]].map((l) => l.text)).toEqual(['Running Header']);
    expect([...res.omittedPerPage[2]].map((l) => l.text)).toEqual(['Running Header']);
  });

  it('requires at least half of converted pages (e.g. 3 of 6, not 3 of 7)', () => {
    const makePages = (total: number, withHeaderCount: number) =>
      Array.from({ length: total }, (_, i) => ({
        widthPt: 595,
        heightPt: 842,
        lines: [
          ...(i < withHeaderCount ? [line('Draft Notice', 50, 30)] : []),
          line(`Body ${i + 1}`, 50, 200),
        ],
      }));
    const sixWithThree = detectRunningHeadersFooters(makePages(6, 3));
    expect(sixWithThree.header).toHaveLength(1);
    const sevenWithThree = detectRunningHeadersFooters(makePages(7, 3));
    expect(sevenWithThree.header).toHaveLength(0);
    expect(sevenWithThree.omittedPerPage.every((s) => s.size === 0)).toBe(true);
  });

  it('ignores repeated lines outside the top and bottom 12 % bands', () => {
    const pages = [1, 2, 3].map(() => ({
      widthPt: 595,
      heightPt: 842,
      lines: [line('Repeated Section Heading', 50, 300)],
    }));
    const res = detectRunningHeadersFooters(pages);
    expect(res.omittedPerPage.every((s) => s.size === 0)).toBe(true);
    expect(res.header).toEqual([]);
  });

  it('drops irregularly numbered running lines from body without emitting a bogus static number', () => {
    const pages = [10, 42, 99].map((code) => ({
      widthPt: 595,
      heightPt: 842,
      lines: [line(`Ref Code ${code}`, 50, 800)],
    }));
    const res = detectRunningHeadersFooters(pages);
    expect(res.omittedPerPage.every((s) => s.size === 1)).toBe(true);
    expect(res.footer).toEqual([]);
  });
});
