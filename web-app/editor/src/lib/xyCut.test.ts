import { describe, expect, it } from 'vitest';

import { xyCutRegions, type LayoutBox } from './xyCut';

type NamedBox = LayoutBox & { id: string };

const box = (id: string, xPt: number, yPt: number, wPt: number, hPt = 12, extra?: Partial<LayoutBox>): NamedBox => ({
  id,
  xPt,
  yPt,
  wPt,
  hPt,
  ...extra,
});

describe('xyCutRegions', () => {
  it('splits a two-column region into left column then right column', () => {
    const items = [
      box('L1', 50, 100, 220),
      box('R1', 320, 100, 220),
      box('L2', 50, 118, 220),
      box('R2', 320, 118, 220),
      box('L3', 50, 136, 200),
      box('R3', 320, 136, 210),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => ({ columnar: r.columnar, ids: r.items.map((i) => i.id) }))).toEqual([
      { columnar: true, ids: ['L1', 'L2', 'L3'] },
      { columnar: true, ids: ['R1', 'R2', 'R3'] },
    ]);
  });

  it('splits a full-width title above two columns without splitting across aligned paragraph gaps', () => {
    const items = [
      box('Title', 50, 60, 480, 18),
      // Small gap (20 pt) below title, larger aligned paragraph gap (30 pt) inside both columns.
      box('L1', 50, 98, 220),
      box('R1', 320, 98, 220),
      box('L2', 50, 114, 220),
      box('R2', 320, 114, 220),
      box('L3', 50, 156, 220),
      box('R3', 320, 156, 220),
      box('L4', 50, 172, 220),
      box('R4', 320, 172, 220),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => r.items.map((i) => i.id))).toEqual([
      ['Title'],
      ['L1', 'L2', 'L3', 'L4'],
      ['R1', 'R2', 'R3', 'R4'],
    ]);
    expect(regions[0].columnar).toBe(false);
    expect(regions[1].columnar).toBe(true);
    expect(regions[2].columnar).toBe(true);
  });

  it('isolates a short centered heading above columns and a full-width note below columns', () => {
    const items = [
      box('CenteredTitle', 220, 60, 155, 16),
      box('L1', 50, 100, 220),
      box('R1', 320, 100, 220),
      box('L2', 50, 118, 220),
      box('R2', 320, 118, 220),
      box('FooterNote', 50, 200, 480, 12),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => r.items.map((i) => i.id))).toEqual([
      ['CenteredTitle'],
      ['L1', 'L2'],
      ['R1', 'R2'],
      ['FooterNote'],
    ]);
  });

  it('splits three columns recursively from left to right', () => {
    const items = [
      box('A1', 40, 100, 150),
      box('B1', 220, 100, 150),
      box('C1', 400, 100, 150),
      box('A2', 40, 118, 150),
      box('B2', 220, 118, 150),
      box('C2', 400, 118, 150),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => r.items.map((i) => i.id))).toEqual([
      ['A1', 'A2'],
      ['B1', 'B2'],
      ['C1', 'C2'],
    ]);
  });

  it('cuts around an atomic table box rather than through it', () => {
    const items = [
      box('L1', 50, 100, 220),
      box('R1', 320, 100, 220),
      box('L2', 50, 118, 220),
      box('R2', 320, 118, 220),
      box('Table', 50, 180, 490, 90, { isLine: false, isContent: true }),
      box('After', 50, 300, 400),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => r.items.map((i) => i.id))).toEqual([
      ['L1', 'L2'],
      ['R1', 'R2'],
      ['Table', 'After'],
    ]);
  });

  it('keeps an in-column table inside its column', () => {
    const items = [
      box('L1', 50, 100, 220),
      box('LTable', 50, 130, 220, 60, { isLine: false, isContent: true }),
      box('L2', 50, 210, 220),
      box('R1', 320, 100, 220),
      box('R2', 320, 118, 220),
      box('R3', 320, 136, 220),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions.map((r) => r.items.map((i) => i.id))).toEqual([
      ['L1', 'LTable', 'L2'],
      ['R1', 'R2', 'R3'],
    ]);
  });

  it('does not split a single visual row divided into two pieces', () => {
    const items = [box('Left', 50, 100, 200), box('Right', 320, 100, 200)];
    const regions = xyCutRegions(items, 595);
    expect(regions).toHaveLength(1);
    expect(regions[0].columnar).toBe(false);
  });

  it('does not split a numbered list with narrow markers from its body text', () => {
    const items = [
      box('1.', 50, 100, 18),
      box('Item one text across the page', 95, 100, 420),
      box('2.', 50, 122, 18),
      box('Item two text across the page', 95, 122, 420),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions).toHaveLength(1);
    expect(regions[0].columnar).toBe(false);
  });

  it('does not reorder non-overlapping top-right metadata behind lower-left body text', () => {
    const items = [
      box('Date1', 400, 60, 140),
      box('Date2', 400, 78, 140),
      box('Salutation1', 50, 140, 180),
      box('Salutation2', 50, 158, 180),
    ];
    const regions = xyCutRegions(items, 595);
    expect(regions).toHaveLength(1);
    expect(regions[0].columnar).toBe(false);
  });
});
