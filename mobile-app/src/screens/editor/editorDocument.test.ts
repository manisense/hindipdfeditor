import { createEditStore, type DocumentState } from '../../state/editStore';
import {
  changeCounts,
  defaultEditedName,
  editsSnapshot,
  hasUnsavedEdits,
  outputFileName,
} from './editorDocument';

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

function makeStore() {
  let n = 0;
  const store = createEditStore(() => `id-${++n}`);
  store.getState().loadDocument(makeDocument());
  return store;
}

const TEXT = {
  xPt: 10,
  yPt: 20,
  fontSizePt: 14,
  text: 'नमस्ते',
  color: '#000000',
  fontFamily: 'NotoSansDevanagari' as const,
};

describe('hasUnsavedEdits', () => {
  it('is false right after load and after OCR results arrive', () => {
    const store = makeStore();
    const saved = editsSnapshot(store.getState().document!);
    store.getState().setOcrLines(0, []);
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(false);
  });

  it('is true once an edit is added, and false again after undoing it', () => {
    const store = makeStore();
    const saved = editsSnapshot(store.getState().document!);
    store.getState().checkpoint();
    store.getState().addTextEdit(0, TEXT);
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(true);
    store.getState().undo();
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(false);
  });

  it('is false after a save snapshot and true after a later text change', () => {
    const store = makeStore();
    const edit = store.getState().addTextEdit(1, TEXT);
    const saved = editsSnapshot(store.getState().document!);
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(false);
    store.getState().updateTextEdit(1, edit.id, { text: 'नया' });
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(true);
  });

  it('is true when a page was inserted', () => {
    const store = makeStore();
    const saved = editsSnapshot(store.getState().document!);
    const page = store.getState().document!.pages[0];
    store.getState().insertPage(1, { ...page, edits: [], isBlank: true });
    expect(hasUnsavedEdits(saved, store.getState().document!)).toBe(true);
  });
});

describe('changeCounts', () => {
  it('counts filled text boxes and unreplaced covers, and pages with edits', () => {
    const store = makeStore();
    const s = store.getState();
    const mask = s.addMaskEdit(0, { xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#ffffff' });
    s.addTextEdit(0, { ...TEXT, replacement: { maskId: mask.id } });
    s.addTextEdit(0, { ...TEXT, text: '  ' });
    s.addMaskEdit(1, { xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#ffffff' });
    expect(changeCounts(store.getState().document!)).toEqual({ lines: 2, pages: 2 });
  });

  it('is zero for an untouched document', () => {
    expect(changeCounts(makeStore().getState().document!)).toEqual({ lines: 0, pages: 0 });
  });
});

describe('file names', () => {
  it('suggests <name>-edited without the extension', () => {
    expect(defaultEditedName('प्रमाण पत्र.PDF')).toBe('प्रमाण पत्र-edited');
    expect(defaultEditedName('.pdf')).toBe('document-edited');
  });

  it('removes path separators and unsafe characters and appends .pdf once', () => {
    expect(outputFileName('../secret/नया:file', 'x')).toBe('secret-नया-file.pdf');
    expect(outputFileName('report.pdf', 'x')).toBe('report.pdf');
    expect(outputFileName('a\\b', 'x')).toBe('a-b.pdf');
  });

  it('falls back when the typed name is empty', () => {
    expect(outputFileName('   ', 'letter-edited')).toBe('letter-edited.pdf');
    expect(outputFileName('', '')).toBe('document-edited.pdf');
  });
});
