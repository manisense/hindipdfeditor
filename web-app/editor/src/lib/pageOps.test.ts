import { PDFDocument, PDFName, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { applyPagePlan, newIndexOf, pagePlan, remapDocument } from './pageOps';
import type { DocumentState, PageState } from '../state/editStore';

const page = (pageIndex: number, extra: Partial<PageState> = {}): PageState => ({
  pageIndex, widthPt: 600, heightPt: 800, backgroundImageUri: `img${pageIndex}`, imagePxWidth: 1200,
  imagePxHeight: 1600, edits: [], ocrLines: [{ id: `l${pageIndex}`, text: 'x', xPt: 0, yPt: 0, wPt: 1, hPt: 1 }], ...extra,
});

function doc(): DocumentState {
  return {
    id: 'd', sourceName: 'a.pdf', pageCount: 3,
    pages: [
      page(0),
      page(1, { edits: [{ type: 'mask', id: 'm', page: 1, xPt: 0, yPt: 0, wPt: 5, hPt: 5, color: '#fff' }] }),
      page(2),
    ],
    legacyFontWarnings: [{ page: 2, fontName: 'Kruti' }],
  };
}

describe('pagePlan', () => {
  it('moves, deletes, rotates and inserts blank pages', () => {
    expect(pagePlan({ kind: 'move', from: 0, to: 2 }, 3)).toEqual([
      { from: 1, rotate: 0 }, { from: 2, rotate: 0 }, { from: 0, rotate: 0 },
    ]);
    expect(pagePlan({ kind: 'delete', index: 1 }, 3).map((e) => e.from)).toEqual([0, 2]);
    expect(pagePlan({ kind: 'rotate', index: 2, degrees: -90 }, 3)[2]).toEqual({ from: 2, rotate: 270 });
    expect(pagePlan({ kind: 'insertBlank', after: 0 }, 3).map((e) => e.from)).toEqual([0, null, 1, 2]);
  });

  it('tells where a page went', () => {
    const plan = pagePlan({ kind: 'move', from: 0, to: 2 }, 3);
    expect(newIndexOf(plan, 0)).toBe(2);
    expect(newIndexOf(pagePlan({ kind: 'delete', index: 1 }, 3), 1)).toBeNull();
  });
});

describe('remapDocument', () => {
  it('carries edits, lines, images and warnings with their pages', () => {
    const next = remapDocument(doc(), pagePlan({ kind: 'move', from: 1, to: 0 }, 3), 'd2', 2);
    expect(next.id).toBe('d2');
    expect(next.pages.map((p) => p.backgroundImageUri)).toEqual(['img1', 'img0', 'img2']);
    expect(next.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2]);
    expect(next.pages[0].edits[0].page).toBe(0);
    expect(next.legacyFontWarnings).toEqual([{ page: 2, fontName: 'Kruti' }]);
    expect(next.pageCount).toBe(3);
  });

  it('turns a rotated page sideways and reads it again; a blank page takes its neighbour size', () => {
    const rotated = remapDocument(doc(), pagePlan({ kind: 'rotate', index: 0, degrees: 90 }, 3), 'd2', 2);
    expect(rotated.pages[0]).toMatchObject({ widthPt: 800, heightPt: 600, imagePxWidth: 1600, imagePxHeight: 1200, backgroundImageUri: '', ocrLines: [] });
    const blank = remapDocument(doc(), pagePlan({ kind: 'insertBlank', after: 2 }, 3), 'd2', 2);
    expect(blank.pages[3]).toMatchObject({ pageIndex: 3, widthPt: 600, heightPt: 800, edits: [], ocrLines: [], backgroundImageUri: '' });
    expect(blank.pageCount).toBe(4);
  });
});

describe('applyPagePlan', () => {
  it('reorders, rotates, deletes and adds pages in the PDF itself', async () => {
    const source = await PDFDocument.create();
    for (const width of [100, 200, 300]) source.addPage([width, 400]);
    source.getPage(2).setRotation(degrees(90));
    const bytes = await source.save();
    const plan = [
      { from: 2, rotate: 90 },
      { from: null, rotate: 0 },
      { from: 0, rotate: 0 },
    ];
    const out = await PDFDocument.load(await applyPagePlan(bytes, plan));
    expect(out.getPages().map((p) => p.getWidth())).toEqual([300, 300, 100]);
    expect(out.getPage(0).getRotation().angle).toBe(180);
    expect(out.getPageCount()).toBe(3);
  });
});

describe('applyPagePlan on a nested page tree', () => {
  it("keeps inherited sizes and drops a deleted page's content from the file", async () => {
    const source = await PDFDocument.create();
    const keep = source.addPage([100, 400]);
    const gone = source.addPage([200, 400]);
    keep.drawText('kept');
    gone.drawText('deleted');
    // Move MediaBox up to the root so the page inherits it.
    const root = source.catalog.Pages();
    root.set(PDFName.of('MediaBox'), keep.node.get(PDFName.of('MediaBox'))!);
    keep.node.delete(PDFName.of('MediaBox'));
    const bytes = await source.save({ useObjectStreams: false });
    const loaded = await PDFDocument.load(bytes);
    const goneRef = loaded.getPage(1).ref;
    const keptRef = loaded.getPage(0).ref;
    const out = await applyPagePlan(bytes, [{ from: 0, rotate: 0 }]);
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(1);
    expect(reopened.getPage(0).getWidth()).toBe(100);
    expect(reopened.context.lookup(keptRef)).toBeDefined();
    expect(reopened.context.lookup(goneRef)).toBeUndefined();
    // Its content stream went with it: only the kept page's stream is left.
    const streams = reopened.context.enumerateIndirectObjects().filter(([, o]) => o.constructor.name === 'PDFRawStream' && !String(o).includes('/Type /ObjStm') && !String(o).includes('/Type /XRef'));
    expect(streams).toHaveLength(1);
  });
});
