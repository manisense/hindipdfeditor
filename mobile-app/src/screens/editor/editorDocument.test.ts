import { createEditStore, type DocumentState } from '../../state/editStore';
import {
  changeCounts,
  createEditSession,
  defaultEditedName,
  editsSnapshot,
  hasUnsavedEdits,
  isUntouchedReplacement,
  MAX_BASE_NAME_BYTES,
  outputFileName,
  truncateUtf8,
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

  it('counts a replacement whose text was emptied once, through its cover', () => {
    const store = makeStore();
    const s = store.getState();
    const mask = s.addMaskEdit(0, { xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#ffffff' });
    s.addTextEdit(0, { ...TEXT, text: '', replacement: { maskId: mask.id } });
    expect(changeCounts(store.getState().document!)).toEqual({ lines: 1, pages: 1 });
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

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

describe('long file names', () => {
  it('caps a long Devanagari name by UTF-8 bytes without splitting a cluster', () => {
    const long = 'प्रमाणपत्र क्षेत्रीय कार्यालय '.repeat(8);
    const name = outputFileName(long, 'x');
    const base = name.replace(/\.pdf$/, '');
    expect(name.endsWith('.pdf')).toBe(true);
    expect(utf8Bytes(base)).toBeLessThanOrEqual(MAX_BASE_NAME_BYTES);
    expect(utf8Bytes(`${base} (99).pdf`)).toBeLessThanOrEqual(255);
    expect(long.startsWith(base)).toBe(true);
    expect(base).not.toMatch(/[\u093e-\u094d\u200c\u200d]$/);
    expect(long.slice(base.length)).not.toMatch(/^[\u093a-\u094f]/);
  });

  it('backs off from a virama and from a following matra', () => {
    // क्ष = क + ् + ष (9 bytes); cutting at 6 bytes would end on the virama.
    expect(truncateUtf8('कक्ष', 9)).toBe('क');
    // कि = क + ि; cutting after क would leave the matra behind.
    expect(truncateUtf8('ककि', 6)).toBe('क');
    expect(truncateUtf8('abc', 10)).toBe('abc');
  });
});

describe('line sheet sessions', () => {
  it('reopening an earlier line takes its own undo step, so undo keeps later lines', () => {
    const store = makeStore();
    const s = () => store.getState();
    const session = createEditSession(() => s().checkpoint());

    s().checkpoint();
    const a = s().addTextEdit(0, TEXT);
    session.start(true);
    session.beforeChange();
    s().updateTextEdit(0, a.id, { text: 'A1' });

    s().checkpoint();
    const b = s().addTextEdit(0, { ...TEXT, yPt: 200 });
    session.start(true);
    session.beforeChange();
    s().updateTextEdit(0, b.id, { text: 'B1' });

    session.start(false);
    session.beforeChange();
    s().updateTextEdit(0, a.id, { text: 'A2' });
    session.beforeChange();
    s().updateTextEdit(0, a.id, { color: '#C6303E' });

    s().undo();
    const texts = s()
      .document!.pages[0].edits.map((e) => (e.type === 'text' ? [e.text, e.color] : null))
      .filter(Boolean);
    expect(texts).toEqual([
      ['A1', '#000000'],
      ['B1', '#000000'],
    ]);
  });

  it('takes no checkpoint when a reopened line is not changed', () => {
    const checkpoint = jest.fn();
    const session = createEditSession(checkpoint);
    session.start(false);
    expect(checkpoint).not.toHaveBeenCalled();
    session.beforeChange();
    session.beforeChange();
    expect(checkpoint).toHaveBeenCalledTimes(1);
  });
});

describe('isUntouchedReplacement', () => {
  const ocrLine = { id: 'l1', text: 'मूल पंक्ति', xPt: 0, yPt: 0, wPt: 10, hPt: 10 };
  const created = {
    ...TEXT,
    type: 'text' as const,
    id: 't',
    page: 0,
    text: 'मूल पंक्ति',
    replacement: { maskId: 'm', ocrLine },
  };

  it('is true for an unchanged replacement and false after a text or style change', () => {
    expect(isUntouchedReplacement(created, created)).toBe(true);
    expect(isUntouchedReplacement(created, { ...created, text: 'नई पंक्ति' })).toBe(false);
    expect(isUntouchedReplacement(created, { ...created, fontWeight: 'bold' })).toBe(false);
  });

  it('is false for added text with no original line', () => {
    const added = { ...created, replacement: undefined };
    expect(isUntouchedReplacement(added, added)).toBe(false);
  });
});
