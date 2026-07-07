import { createEditStore, type DocumentState } from './editStore';

function makeDocument(pageCount = 2): DocumentState {
  return {
    sourceUri: 'file:///fake/source.pdf',
    pageCount,
    pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
      pageIndex,
      widthPt: 595,
      heightPt: 842,
      backgroundImageUri: `file:///fake/page-${pageIndex}.jpg`,
      imagePxWidth: 1190,
      imagePxHeight: 1684,
      edits: [],
      ocrLines: [],
    })),
    legacyFontWarnings: [],
  };
}

function idSequence(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

// `expo-crypto`'s `randomUUID` is a native module with no return value under jest's
// auto-mock, so every test uses a deterministic, per-store id sequence instead of the
// store's real default generator - this is exactly what `createEditStore`'s injectable
// `generateId` parameter is for.
function makeStore(idGenerator: () => string = idSequence('id')) {
  return createEditStore(idGenerator);
}

describe('editStore', () => {
  it('starts with no document loaded', () => {
    const store = makeStore();
    expect(store.getState().document).toBeNull();
  });

  it('loadDocument sets the document, closeDocument clears it', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    expect(store.getState().document?.pageCount).toBe(2);

    store.getState().closeDocument();
    expect(store.getState().document).toBeNull();
  });

  it('addTextEdit appends a TextEdit to the correct page, stamping id/type/page', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());

    const created = store.getState().addTextEdit(1, {
      xPt: 10,
      yPt: 20,
      fontSizePt: 14,
      text: 'धर्म',
      color: '#111111',
      fontFamily: 'NotoSansDevanagari',
    });

    expect(created).toEqual({
      type: 'text',
      id: 'id-1',
      page: 1,
      xPt: 10,
      yPt: 20,
      fontSizePt: 14,
      text: 'धर्म',
      color: '#111111',
      fontFamily: 'NotoSansDevanagari',
    });

    const pages = store.getState().document!.pages;
    expect(pages[0].edits).toHaveLength(0);
    expect(pages[1].edits).toEqual([created]);
  });

  it('addMaskEdit appends a MaskEdit to the correct page, stamping id/type/page', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());

    const created = store.getState().addMaskEdit(0, {
      xPt: 5,
      yPt: 6,
      wPt: 100,
      hPt: 20,
      color: '#ffffff',
    });

    expect(created).toEqual({
      type: 'mask',
      id: 'id-1',
      page: 0,
      xPt: 5,
      yPt: 6,
      wPt: 100,
      hPt: 20,
      color: '#ffffff',
    });
    expect(store.getState().document!.pages[0].edits).toEqual([created]);
  });

  it('throws when adding an edit to a page that has not been loaded', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument(1));
    expect(() =>
      store.getState().addTextEdit(1, {
        xPt: 0,
        yPt: 0,
        fontSizePt: 12,
        text: 'x',
        color: '#000',
        fontFamily: 'NotoSansDevanagari',
      }),
    ).toThrow();
  });

  it('throws when adding an edit before any document is loaded', () => {
    const store = makeStore();
    expect(() =>
      store.getState().addTextEdit(0, {
        xPt: 0,
        yPt: 0,
        fontSizePt: 12,
        text: 'x',
        color: '#000',
        fontFamily: 'NotoSansDevanagari',
      }),
    ).toThrow();
  });

  it('updateTextEdit merges changes into the matching edit and leaves others untouched', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const first = store.getState().addTextEdit(0, {
      xPt: 1,
      yPt: 1,
      fontSizePt: 12,
      text: 'क',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });
    const second = store.getState().addTextEdit(0, {
      xPt: 2,
      yPt: 2,
      fontSizePt: 12,
      text: 'ख',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });

    store.getState().updateTextEdit(0, first.id, { text: 'क्ष', xPt: 99 });

    const edits = store.getState().document!.pages[0].edits;
    expect(edits.find((e) => e.id === first.id)).toEqual({
      ...first,
      text: 'क्ष',
      xPt: 99,
    });
    expect(edits.find((e) => e.id === second.id)).toEqual(second);
  });

  it('updateTextEdit throws if the id belongs to a MaskEdit, not a TextEdit', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const mask = store
      .getState()
      .addMaskEdit(0, { xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#fff' });
    expect(() => store.getState().updateTextEdit(0, mask.id, { text: 'x' })).toThrow();
  });

  it('updateMaskEdit merges changes into the matching mask edit', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const mask = store
      .getState()
      .addMaskEdit(0, { xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#fff' });

    store.getState().updateMaskEdit(0, mask.id, { color: '#eee', wPt: 20 });

    expect(store.getState().document!.pages[0].edits[0]).toEqual({
      ...mask,
      color: '#eee',
      wPt: 20,
    });
  });

  it('updateMaskEdit throws if the id belongs to a TextEdit, not a MaskEdit', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const text = store.getState().addTextEdit(0, {
      xPt: 0,
      yPt: 0,
      fontSizePt: 12,
      text: 'x',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });
    expect(() => store.getState().updateMaskEdit(0, text.id, { color: '#000' })).toThrow();
  });

  it('removeEdit removes only the targeted edit', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const first = store.getState().addTextEdit(0, {
      xPt: 0,
      yPt: 0,
      fontSizePt: 12,
      text: 'a',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });
    const second = store.getState().addTextEdit(0, {
      xPt: 0,
      yPt: 0,
      fontSizePt: 12,
      text: 'b',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });

    store.getState().removeEdit(0, first.id);

    expect(store.getState().document!.pages[0].edits).toEqual([second]);
  });

  it('removeEdit is a no-op when the id is not found', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    store.getState().addTextEdit(0, {
      xPt: 0,
      yPt: 0,
      fontSizePt: 12,
      text: 'a',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });

    expect(() => store.getState().removeEdit(0, 'does-not-exist')).not.toThrow();
    expect(store.getState().document!.pages[0].edits).toHaveLength(1);
  });

  it('setLegacyFontWarnings replaces the warnings array on the document', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());

    store.getState().setLegacyFontWarnings([{ page: 0, fontName: 'KrutiDev010' }]);

    expect(store.getState().document!.legacyFontWarnings).toEqual([
      { page: 0, fontName: 'KrutiDev010' },
    ]);
  });

  it('setLegacyFontWarnings throws if no document is loaded', () => {
    const store = makeStore();
    expect(() => store.getState().setLegacyFontWarnings([])).toThrow();
  });

  it('setOcrLines replaces only the targeted page ocrLines', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument(2));
    const line = { id: 'ocr-1', text: 'छुट्टी', xPt: 10, yPt: 20, wPt: 100, hPt: 12 };

    store.getState().setOcrLines(1, [line]);

    expect(store.getState().document!.pages[0].ocrLines).toEqual([]);
    expect(store.getState().document!.pages[1].ocrLines).toEqual([line]);
  });

  it('setOcrLines throws for an out-of-range page', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument(1));
    expect(() => store.getState().setOcrLines(5, [])).toThrow();
  });

  it('undo restores the document to the last checkpoint, reverting a multi-edit group', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    const line = { id: 'ocr-1', text: 'पद', xPt: 10, yPt: 20, wPt: 50, hPt: 12 };
    store.getState().setOcrLines(0, [line]);

    // One user gesture = one checkpoint, then several low-level mutations.
    store.getState().checkpoint();
    store.getState().setOcrLines(0, []);
    store.getState().addMaskEdit(0, { xPt: 10, yPt: 20, wPt: 50, hPt: 12, color: '#fff' });
    store.getState().addTextEdit(0, {
      xPt: 10,
      yPt: 20,
      fontSizePt: 12,
      text: 'पद',
      color: '#000',
      fontFamily: 'NotoSansDevanagari',
    });

    store.getState().undo();

    expect(store.getState().document!.pages[0].edits).toEqual([]);
    expect(store.getState().document!.pages[0].ocrLines).toEqual([line]);
    expect(store.getState().history).toHaveLength(0);
  });

  it('undo is a no-op with no checkpoints', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    expect(() => store.getState().undo()).not.toThrow();
    expect(store.getState().document).not.toBeNull();
  });

  it('checkpoint is a no-op before a document is loaded', () => {
    const store = makeStore();
    store.getState().checkpoint();
    expect(store.getState().history).toHaveLength(0);
  });

  it('loadDocument clears history from a previous document', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    store.getState().checkpoint();
    store.getState().loadDocument(makeDocument());
    expect(store.getState().history).toHaveLength(0);
  });

  it('history is capped and drops the oldest checkpoints', () => {
    const store = makeStore();
    store.getState().loadDocument(makeDocument());
    for (let i = 0; i < 40; i++) {
      store.getState().checkpoint();
      store.getState().addTextEdit(0, {
        xPt: i,
        yPt: 0,
        fontSizePt: 12,
        text: String(i),
        color: '#000',
        fontFamily: 'NotoSansDevanagari',
      });
    }
    expect(store.getState().history.length).toBeLessThanOrEqual(25);
    // Undoing everything available lands on a state that still has the oldest edits.
    while (store.getState().history.length > 0) store.getState().undo();
    expect(store.getState().document!.pages[0].edits.length).toBeGreaterThan(0);
  });

  it('two store instances from createEditStore() are fully independent', () => {
    const storeA = makeStore();
    const storeB = makeStore();
    storeA.getState().loadDocument(makeDocument(1));
    expect(storeB.getState().document).toBeNull();
  });
});
