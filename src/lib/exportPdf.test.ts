import { PDFDocument } from '@cantoo/pdf-lib';
import type { DocumentState } from '../state/editStore';

const mockReadAsStringAsync = jest.fn<Promise<string>, [string, unknown?]>();
const mockGetInfoAsync = jest.fn();
const mockPrintToFileAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  readAsStringAsync: (...args: [string, unknown?]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  EncodingType: { Base64: 'base64' },
}));

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
        backgroundImageUri: 'file:///fake/page-0.png',
        imagePxWidth: 800,
        imagePxHeight: 1200,
        edits: [],
      },
    ],
    legacyFontWarnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('exportPdf', () => {
  it('reads the source PDF page size and passes it (in points) to Print.printToFileAsync, not a hardcoded size', async () => {
    const sourceBase64 = await makeFixturePdfBase64(400, 600);
    const outputBase64 = await makeFixturePdfBase64(400, 600);

    mockReadAsStringAsync.mockImplementation(async (uri: string) =>
      uri === 'file:///fake/output.pdf' ? outputBase64 : sourceBase64,
    );
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    const result = await exportPdf(makeDocument(), 'ZmFrZS1mb250');

    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    const call = mockPrintToFileAsync.mock.calls[0][0];
    expect(call.width).toBe(400);
    expect(call.height).toBe(600);
    expect(typeof call.html).toBe('string');
    expect(call.html).toContain('file:///fake/page-0.png');
    expect(result).toBe('file:///fake/output.pdf');
  });

  it('never reads from or writes back to the original sourceUri as the output', async () => {
    const sourceBase64 = await makeFixturePdfBase64(595, 842);
    mockReadAsStringAsync.mockResolvedValue(sourceBase64);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 999 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///cache/new-export-123.pdf' });

    const result = await exportPdf(
      makeDocument({ sourceUri: 'file:///original/doc.pdf' }),
      'Zm9udA==',
    );

    expect(result).not.toBe('file:///original/doc.pdf');
    expect(result).toBe('file:///cache/new-export-123.pdf');
  });

  it('throws if the output file does not exist after export', async () => {
    const sourceBase64 = await makeFixturePdfBase64(400, 600);
    mockReadAsStringAsync.mockResolvedValue(sourceBase64);
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), 'Zm9udA==')).rejects.toThrow(/missing or empty/);
  });

  it('throws if the output file exists but is empty', async () => {
    const sourceBase64 = await makeFixturePdfBase64(400, 600);
    mockReadAsStringAsync.mockResolvedValue(sourceBase64);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), 'Zm9udA==')).rejects.toThrow(/missing or empty/);
  });

  it('throws if the output file cannot be re-parsed as a PDF (silent corruption guard)', async () => {
    const sourceBase64 = await makeFixturePdfBase64(400, 600);
    mockReadAsStringAsync.mockImplementation(async (uri: string) =>
      uri === 'file:///fake/output.pdf'
        ? Buffer.from('not a pdf').toString('base64')
        : sourceBase64,
    );
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 42 });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///fake/output.pdf' });

    await expect(exportPdf(makeDocument(), 'Zm9udA==')).rejects.toThrow(/could not be re-parsed/);
  });
});
