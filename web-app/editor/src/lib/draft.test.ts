import { describe, expect, it } from 'vitest';

import { applyDraft, draftEditCount, draftOf } from './draft';
import type { DocumentState, Edit, OcrLine, PageState } from '../state/editStore';

const line = (id: string): OcrLine => ({ id, text: id, xPt: 0, yPt: 0, wPt: 10, hPt: 10 });
const page = (pageIndex: number, edits: Edit[] = [], ocrLines: OcrLine[] = []): PageState => ({
  pageIndex, widthPt: 600, heightPt: 800, backgroundImageUri: pageIndex === 0 ? 'data:x' : '', imagePxWidth: 1200,
  imagePxHeight: 1600, edits, ocrLines,
});
const text: Edit = { type: 'text', id: 't1', page: 0, xPt: 1, yPt: 1, fontSizePt: 10, text: 'नया', color: '#000', fontFamily: 'Hind', maskId: 'm1' };
const replaceMask: Edit = { type: 'mask', id: 'm1', page: 0, xPt: 0, yPt: 0, wPt: 5, hPt: 5, color: '#fff', kind: 'replace' };
const highlight: Edit = { type: 'mask', id: 'h1', page: 1, xPt: 0, yPt: 0, wPt: 5, hPt: 5, color: '#ff0', kind: 'highlight' };

function doc(): DocumentState {
  return {
    id: 'doc-1', sourceName: 'a.pdf', pageCount: 2, legacyFontWarnings: [],
    pages: [page(0, [replaceMask, text], [line('b')]), page(1, [highlight])],
  };
}

describe('draft', () => {
  it('keeps edits, detected lines of finished pages and pairings, without page images', () => {
    const draft = draftOf(doc(), (i) => i === 0, new Map([['t1', { maskId: 'm1', ocrLine: line('a') }]]), 42);
    expect(draft).toMatchObject({ version: 1, documentId: 'doc-1', sourceName: 'a.pdf', savedAt: 42 });
    expect(draft.pages[0].ocrLines?.map((l) => l.id)).toEqual(['b']);
    expect(draft.pages[1].ocrLines).toBeNull();
    expect(draft.pairings).toEqual([['t1', { maskId: 'm1', ocrLine: line('a') }]]);
    expect(JSON.stringify(draft)).not.toContain('data:x');
  });

  it('counts what the user did: a replaced line once, plus marks and images', () => {
    const draft = draftOf(doc(), () => true, new Map(), 0);
    expect(draftEditCount(draft)).toBe(2);
  });

  it('puts edits and finished lines back on freshly opened pages', () => {
    const draft = draftOf(doc(), (i) => i === 0, new Map(), 0);
    const restored = applyDraft([page(0), page(1)], draft);
    expect(restored?.pages[0].edits).toEqual([replaceMask, text]);
    expect(restored?.pages[0].ocrLines.map((l) => l.id)).toEqual(['b']);
    expect(restored?.pages[0].backgroundImageUri).toBe('data:x');
    expect(restored?.pages[1].edits).toEqual([highlight]);
    expect(restored?.detectedPages).toEqual([0]);
  });

  it('refuses a draft made for a different file layout', () => {
    const draft = draftOf(doc(), () => true, new Map(), 0);
    expect(applyDraft([page(0)], draft)).toBeNull();
    expect(applyDraft([page(0), { ...page(1), widthPt: 500 }], draft)).toBeNull();
  });
});
