import { PDFDocument } from '@cantoo/pdf-lib';
import type { DocumentState } from '../state/editStore';

const mockReadAsStringAsync = jest.fn<Promise<string>, [string, unknown?]>();
const mockGetInfoAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockPrintToFileAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: [string, unknown?]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'merged-id' }));

jest.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));

// Imported after the mocks above so exportPdf.ts picks up the mocked modules.
// eslint-disable-next-line import/first
import { exportPdf } from './exportPdf';

async function makeFixturePdfBase64(widthPt: number, heightPt: number): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([widthPt, heightPt]);
  return pdfDoc.saveAsBase64();
}

function makeDocument(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    sourceUri: 'file:///fake/source.pdf',
    pageCount: 1,
    pages: [
      {
        pageIndex: 0,
        widthPt: 400,
        heightPt: 600,
        backgroundImageUri: 'file:///fake/page-0.jpg',
        imagePxWidth: 800,
        imagePxHeight: 1200,
        edits: [],
        ocrLines: [],
      },
    ],
    legacyFontWarnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteAsync.mockResolvedValue(undefined);
  mockWriteAsStringAsync.mockResolvedValue(undefined);
});

const mockFonts = {
  NotoSansDevanagari: { base64: 'ZmFrZS1mb250', cssFontWeight: '100 900' as const },
  Mukta: { base64: 'ZmFrZS1kb2N1bWVudC1mb250', cssFontWeight: '400' as const },
};

describe('exportPdf', () => {
  it("passes the document's stored page size (in points) to Print.printToFileAsync, not a hardcoded size", async () => {
    const outputBase64 = await makeFixturePdfBase64(400, 600);

    mockReadAsStringAsync.mockImplementation(async (uri: string) =>
      uri === 'file:///fake/page-0.jpg' ? 'ZmFrZS1qcGVn' : outputBase64,
    );
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    const result = await exportPdf(
      makeDocument({ pages: [{ ...makeDocument().pages[0], widthPt: 400, heightPt: 600 }] }),
      mockFonts,
    );

    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    const call = mockPrintToFileAsync.mock.calls[0][0];
    expect(call.width).toBe(400);
    expect(call.height).toBe(600);
    expect(typeof call.html).toBe('string');
    // The background image must be inlined as a data URI, not left as a file:// reference -
    // confirmed on a real device that the print WebView renders those blank (see CHANGELOG).
    expect(call.html).not.toContain('file:///fake/page-0.jpg');
    expect(call.html).toContain('data:image/jpeg;base64,ZmFrZS1qcGVn');
    expect(result).toBe('file:///fake/output.pdf');
  });

  it('never reads from or writes back to the original sourceUri as the output', async () => {
    const outputBase64 = await makeFixturePdfBase64(400, 600);
    mockReadAsStringAsync.mockResolvedValue(outputBase64);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 999 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///cache/new-export-123.pdf' });

    const result = await exportPdf(
      makeDocument({ sourceUri: 'file:///original/doc.pdf' }),
      mockFonts,
    );

    expect(result).not.toBe('file:///original/doc.pdf');
    expect(result).toBe('file:///cache/new-export-123.pdf');
  });

  it('prints pages independently and merges exactly one validated sheet per source page', async () => {
    const page0 = {
      ...makeDocument().pages[0],
      edits: [
        {
          type: 'text' as const,
          id: 'noto-edit',
          page: 0,
          xPt: 10,
          yPt: 10,
          fontSizePt: 12,
          text: 'धर्म',
          color: '#111111',
          fontFamily: 'NotoSansDevanagari' as const,
        },
      ],
    };
    const page1 = {
      ...page0,
      pageIndex: 1,
      widthPt: 500,
      heightPt: 700,
      backgroundImageUri: 'file:///fake/page-1.jpg',
      imagePxWidth: 1500,
      imagePxHeight: 2100,
      edits: [
        {
          ...page0.edits[0],
          id: 'mukta-edit',
          page: 1,
          fontFamily: 'Mukta' as const,
        },
      ],
    };
    const printed0 = await makeFixturePdfBase64(400, 600);
    const printed1 = await makeFixturePdfBase64(500, 700);
    let mergedBase64 = '';

    mockPrintToFileAsync
      .mockResolvedValueOnce({ uri: 'file:///cache/printed-0.pdf' })
      .mockResolvedValueOnce({ uri: 'file:///cache/printed-1.pdf' });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
    mockWriteAsStringAsync.mockImplementation(async (_uri: string, value: string) => {
      mergedBase64 = value;
    });
    mockReadAsStringAsync.mockImplementation(async (uri: string) => {
      if (uri.endsWith('.jpg')) return 'ZmFrZS1qcGVn';
      if (uri.endsWith('printed-0.pdf')) return printed0;
      if (uri.endsWith('printed-1.pdf')) return printed1;
      if (uri.endsWith('hindi-pdf-editor-merged-id.pdf')) return mergedBase64;
      throw new Error(`Unexpected read: ${uri}`);
    });

    const result = await exportPdf(
      makeDocument({ pageCount: 2, pages: [page0, page1] }),
      mockFonts,
    );

    expect(result).toBe('file:///cache/hindi-pdf-editor-merged-id.pdf');
    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(2);
    expect(mockPrintToFileAsync.mock.calls.map(([call]) => [call.width, call.height])).toEqual([
      [400, 600],
      [500, 700],
    ]);
    expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain(
      mockFonts.NotoSansDevanagari.base64,
    );
    expect(mockPrintToFileAsync.mock.calls[0][0].html).not.toContain(mockFonts.Mukta.base64);
    expect(mockPrintToFileAsync.mock.calls[1][0].html).toContain(mockFonts.Mukta.base64);
    expect(mockPrintToFileAsync.mock.calls[1][0].html).not.toContain(
      mockFonts.NotoSansDevanagari.base64,
    );
    const merged = await PDFDocument.load(mergedBase64);
    expect(merged.getPages().map((page) => page.getSize())).toEqual([
      { width: 400, height: 600 },
      { width: 500, height: 700 },
    ]);
    expect(mockDeleteAsync).toHaveBeenCalledTimes(2);
  });

  it('rejects a page print that contains an unexpected extra blank sheet', async () => {
    const printed = await PDFDocument.create();
    printed.addPage([400, 600]);
    printed.addPage([400, 600]);
    mockReadAsStringAsync.mockImplementation(async (uri: string) =>
      uri.endsWith('.jpg') ? 'ZmFrZS1qcGVn' : printed.saveAsBase64(),
    );
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///cache/printed.pdf' });

    await expect(exportPdf(makeDocument(), mockFonts)).rejects.toThrow(/could not be re-parsed/);
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/printed.pdf', {
      idempotent: true,
    });
  });

  it('throws if the document has no pages', async () => {
    await expect(exportPdf(makeDocument({ pages: [] }), mockFonts)).rejects.toThrow(/no pages/);
  });

  it('throws if the output file does not exist after export', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), mockFonts)).rejects.toThrow(/missing or empty/);
  });

  it('throws if the output file exists but is empty', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), mockFonts)).rejects.toThrow(/missing or empty/);
  });

  it('throws if the output file cannot be re-parsed as a PDF (silent corruption guard)', async () => {
    mockReadAsStringAsync.mockResolvedValue(Buffer.from('not a pdf').toString('base64'));
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 42 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), mockFonts)).rejects.toThrow(/could not be re-parsed/);
  });
});
