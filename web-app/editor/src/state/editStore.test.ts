import { describe, expect, it } from 'vitest';

import { createEditStore, type DocumentState, type OcrLine } from './editStore';

const line = (id: string): OcrLine => ({ id, text: id, xPt: 0, yPt: 0, wPt: 10, hPt: 10 });

function doc(): DocumentState {
  const page = (pageIndex: number) => ({
    pageIndex, widthPt: 100, heightPt: 100, backgroundImageUri: '', imagePxWidth: 200, imagePxHeight: 200,
    edits: [], ocrLines: pageIndex === 0 ? [line('a')] : [],
  });
  return { id: 'doc-1', sourceName: 'x.pdf', pageCount: 2, pages: [page(0), page(1)], legacyFontWarnings: [] };
}

const text = { xPt: 1, yPt: 1, fontSizePt: 10, text: 'नया', color: '#000', fontFamily: 'Hind' };

describe('editStore history', () => {
  it('undo keeps detection that finished after the edit and restores consumed lines', () => {
    let n = 0;
    const store = createEditStore(() => `id-${++n}`);
    store.getState().loadDocument(doc());
    store.getState().checkpoint();
    store.getState().setOcrLines(0, []); // line "a" consumed by the edit
    store.getState().addTextEdit(0, text);
    store.getState().setOcrLines(1, [line('late')]); // page 2 detected afterwards

    store.getState().undo();
    const pages = store.getState().document!.pages;
    expect(pages[0].edits).toEqual([]);
    expect(pages[0].ocrLines.map((l) => l.id)).toEqual(['a']);
    expect(pages[1].ocrLines.map((l) => l.id)).toEqual(['late']);
  });

  it('redoes an undone edit and a new edit clears redo', () => {
    const store = createEditStore(() => 'e1');
    store.getState().loadDocument(doc());
    store.getState().checkpoint();
    store.getState().addTextEdit(0, text);
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().redo();
    expect(store.getState().document!.pages[0].edits).toHaveLength(1);
    store.getState().undo();
    store.getState().checkpoint();
    expect(store.getState().future).toHaveLength(0);
  });

  it('undo keeps a page image rendered after the snapshot', () => {
    const store = createEditStore(() => 'e1');
    store.getState().loadDocument(doc());
    store.getState().checkpoint();
    store.getState().addTextEdit(0, text);
    store.getState().setPageImage(1, 'data:image/jpeg;base64,AAA');
    store.getState().undo();
    expect(store.getState().document!.pages[1].backgroundImageUri).toBe('data:image/jpeg;base64,AAA');
  });

  it('adds, moves and undoes an image', () => {
    const store = createEditStore(() => 'img-1');
    store.getState().loadDocument(doc());
    store.getState().checkpoint();
    const image = store.getState().addImageEdit(0, {
      xPt: 10, yPt: 10, wPt: 40, hPt: 20, uri: 'data:image/png;base64,AAA', signature: true,
    });
    expect(image).toMatchObject({ type: 'image', id: 'img-1', page: 0 });
    store.getState().checkpoint();
    store.getState().updateImageEdit(0, 'img-1', { xPt: 30 });
    expect(store.getState().document!.pages[0].edits[0]).toMatchObject({ xPt: 30, wPt: 40 });
    store.getState().undo();
    expect(store.getState().document!.pages[0].edits[0]).toMatchObject({ xPt: 10 });
    expect(() => store.getState().updateImageEdit(0, 'nope', { xPt: 1 })).toThrow();
  });
});
