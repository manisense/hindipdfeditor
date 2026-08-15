import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditStore, type OcrLine, type PageState, type TextEdit } from '../state/editStore';
import { EditPdfTool } from './EditPdfTool';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const imageMocks = vi.hoisted(() => ({
  sampleAverageColor: vi.fn<() => Promise<string>>(),
  sampleTextColor: vi.fn<() => Promise<string>>(),
}));

vi.mock('../lib/fontAsset', () => ({
  ensureFontsLoaded: vi.fn(),
  getFontBase64: vi.fn(async () => ''),
}));

vi.mock('../lib/pdfToImages', () => ({
  getPageCount: vi.fn(async () => 1),
  getPdfBase64: vi.fn(async () => ''),
  renderPage: vi.fn(),
  sampleAverageColor: imageMocks.sampleAverageColor,
  samplePagePaperColor: vi.fn(async () => '#ffffff'),
  sampleTextColor: imageMocks.sampleTextColor,
  setPdfBytes: vi.fn(),
}));

type MockViewerProps = {
  onTap: (xPt: number, yPt: number) => void;
  renderOverlays?: (viewWidthPx: number) => ReactNode;
};

vi.mock('../components/PdfPageViewer', async () => {
  const React = await import('react');
  return {
    PdfPageViewer: ({ onTap, renderOverlays }: MockViewerProps) =>
      React.createElement(
        'div',
        { 'data-testid': 'viewer' },
        React.createElement(
          'button',
          {
            'data-testid': 'tap-line-b',
            type: 'button',
            onClick: () => onTap(15, 15),
          },
          'Tap line B',
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'tap-line-c',
            type: 'button',
            onClick: () => onTap(105, 15),
          },
          'Tap line C',
        ),
        renderOverlays?.(600),
      ),
  };
});

const activeEdit: TextEdit = {
  type: 'text',
  id: 'edit-a',
  page: 0,
  xPt: 300,
  yPt: 300,
  fontSizePt: 12,
  text: 'पहली पंक्ति',
  color: '#111111',
  fontFamily: 'NotoSansDevanagari',
};

const lineB: OcrLine = {
  id: 'line-b',
  text: 'दूसरी पंक्ति',
  xPt: 10,
  yPt: 10,
  wPt: 50,
  hPt: 15,
  source: 'ocr',
};

const lineC: OcrLine = {
  id: 'line-c',
  text: 'तीसरी पंक्ति',
  xPt: 100,
  yPt: 10,
  wPt: 50,
  hPt: 15,
  source: 'ocr',
};

function pageState(edits: TextEdit[] = [], ocrLines: OcrLine[] = [lineB]): PageState {
  return {
    pageIndex: 0,
    widthPt: 600,
    heightPt: 800,
    backgroundImageUri: 'data:image/png;base64,',
    imagePxWidth: 1200,
    imagePxHeight: 1600,
    edits,
    ocrLines,
  };
}

function loadPage(edits?: TextEdit[], ocrLines?: OcrLine[]) {
  useEditStore.setState({
    document: {
      sourceName: 'selection-fixture.pdf',
      pageCount: 1,
      pages: [pageState(edits, ocrLines)],
      legacyFontWarnings: [],
    },
    history: [],
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function requiredElement<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`Expected test element: ${selector}`);
  return element;
}

async function settleAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('EditPdfTool pointer intent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    imageMocks.sampleAverageColor.mockReset().mockResolvedValue('#ffffff');
    imageMocks.sampleTextColor.mockReset().mockResolvedValue('#111111');
    loadPage([activeEdit], [lineB]);

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(EditPdfTool));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useEditStore.setState({ document: null, history: [] });
  });

  it('keeps pointerdown, blur, and both touch-derived taps dismiss-only', async () => {
    const textarea = requiredElement<HTMLTextAreaElement>(
      container,
      'textarea[data-edit-id="edit-a"]',
    );
    const lineButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-b"]',
    );

    await act(async () => textarea.focus());
    expect(textarea.classList.contains('editable-text-overlay--focused')).toBe(true);

    await act(async () => {
      lineButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(async () => textarea.blur());
    await act(async () => lineButton.click());
    await act(async () => lineButton.click());
    await settleAsyncWork();

    const pageAfterSyntheticClick = useEditStore.getState().document?.pages[0];
    expect(pageAfterSyntheticClick?.edits).toEqual([activeEdit]);
    expect(pageAfterSyntheticClick?.ocrLines).toEqual([lineB]);

    await act(async () => {
      lineButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(async () => lineButton.click());
    await settleAsyncWork();

    const pageAfterFreshGesture = useEditStore.getState().document?.pages[0];
    expect(pageAfterFreshGesture?.edits.filter((edit) => edit.type === 'text')).toHaveLength(2);
    expect(pageAfterFreshGesture?.edits.filter((edit) => edit.type === 'mask')).toHaveLength(1);
    expect(pageAfterFreshGesture?.ocrLines).toEqual([]);
  });

  it('lets literal Escape finish editing without consuming another OCR line', async () => {
    const textarea = requiredElement<HTMLTextAreaElement>(
      container,
      'textarea[data-edit-id="edit-a"]',
    );
    await act(async () => textarea.focus());

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    const currentPage = useEditStore.getState().document?.pages[0];
    expect(currentPage?.edits).toEqual([activeEdit]);
    expect(currentPage?.ocrLines).toEqual([lineB]);
    expect(document.activeElement).not.toBe(textarea);
    expect(container.querySelector('.editable-text-overlay--focused')).toBeNull();
  });

  it('reactivates a completed edit only after its click can finish', async () => {
    const textarea = requiredElement<HTMLTextAreaElement>(
      container,
      'textarea[data-edit-id="edit-a"]',
    );
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    await act(async () => {
      textarea.dispatchEvent(mouseDown);
    });
    expect(mouseDown.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(textarea);

    await act(async () => textarea.click());

    expect(document.activeElement).toBe(textarea);
    expect(textarea.classList.contains('editable-text-overlay--focused')).toBe(true);
  });

  it('cancels a pending replacement when Escape wins the request race', async () => {
    await act(async () => root.unmount());
    loadPage([], [lineB]);
    root = createRoot(container);
    await act(async () => root.render(createElement(EditPdfTool)));

    const pendingTextColor = deferred<string>();
    imageMocks.sampleTextColor.mockReturnValueOnce(pendingTextColor.promise);
    const lineButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-b"]',
    );

    await act(async () => {
      lineButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      lineButton.click();
    });
    expect(imageMocks.sampleTextColor).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      pendingTextColor.resolve('#111111');
    });
    await settleAsyncWork();

    const currentPage = useEditStore.getState().document?.pages[0];
    expect(currentPage?.edits).toEqual([]);
    expect(currentPage?.ocrLines).toEqual([lineB]);
  });

  it('checks cancellation again after asynchronous paper-color sampling', async () => {
    await act(async () => root.unmount());
    loadPage([], [lineB]);
    root = createRoot(container);
    await act(async () => root.render(createElement(EditPdfTool)));

    const pendingPaperColor = deferred<string>();
    imageMocks.sampleAverageColor.mockReturnValueOnce(pendingPaperColor.promise);
    const lineButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-b"]',
    );

    await act(async () => {
      lineButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      lineButton.click();
    });
    await settleAsyncWork();
    expect(imageMocks.sampleAverageColor).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      pendingPaperColor.resolve('#ffffff');
    });
    await settleAsyncWork();

    const currentPage = useEditStore.getState().document?.pages[0];
    expect(currentPage?.edits).toEqual([]);
    expect(currentPage?.ocrLines).toEqual([lineB]);
  });

  it('cancels a pending replacement when the user clicks outside the editor', async () => {
    await act(async () => root.unmount());
    loadPage([], [lineB]);
    root = createRoot(container);
    await act(async () => root.render(createElement(EditPdfTool)));

    const pendingTextColor = deferred<string>();
    imageMocks.sampleTextColor.mockReturnValueOnce(pendingTextColor.promise);
    const lineButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-b"]',
    );
    const outsideEditor = requiredElement<HTMLElement>(container, 'main.app__content');

    await act(async () => {
      lineButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      lineButton.click();
    });
    expect(imageMocks.sampleTextColor).toHaveBeenCalledTimes(1);

    await act(async () => {
      outsideEditor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      pendingTextColor.resolve('#111111');
    });
    await settleAsyncWork();

    const currentPage = useEditStore.getState().document?.pages[0];
    expect(currentPage?.edits).toEqual([]);
    expect(currentPage?.ocrLines).toEqual([lineB]);
  });

  it('allows only the newest pending line replacement to commit', async () => {
    await act(async () => root.unmount());
    loadPage([], [lineB, lineC]);
    root = createRoot(container);
    await act(async () => root.render(createElement(EditPdfTool)));

    const firstTextColor = deferred<string>();
    imageMocks.sampleTextColor
      .mockReturnValueOnce(firstTextColor.promise)
      .mockResolvedValueOnce('#111111');
    const lineBButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-b"]',
    );
    const lineCButton = requiredElement<HTMLButtonElement>(
      container,
      '[data-testid="tap-line-c"]',
    );

    await act(async () => {
      lineBButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      lineBButton.click();
    });
    await act(async () => {
      lineCButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      lineCButton.click();
    });
    await settleAsyncWork();

    firstTextColor.resolve('#111111');
    await settleAsyncWork();

    const currentPage = useEditStore.getState().document?.pages[0];
    expect(currentPage?.ocrLines).toEqual([lineB]);
    expect(
      currentPage?.edits.some(
        (edit) => edit.type === 'text' && edit.text === lineC.text,
      ),
    ).toBe(true);
    expect(
      currentPage?.edits.some(
        (edit) => edit.type === 'text' && edit.text === lineB.text,
      ),
    ).toBe(false);
  });
});
