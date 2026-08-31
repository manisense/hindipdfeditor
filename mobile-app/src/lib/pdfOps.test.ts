import { PDFDocument } from '@cantoo/pdf-lib';

const mockReadAsStringAsync = jest.fn<Promise<string>, [string, unknown?]>();
const mockGetInfoAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: [string, unknown?]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid-123' }));

jest.mock('./pdfToImages', () => ({
  renderPage: jest.fn().mockResolvedValue({
    uri: 'file:///cache/rendered-page.jpg',
    pxWidth: 800,
    pxHeight: 1200,
  }),
}));

/* eslint-disable import/first */
import { compressPdfFile, extractPdfPages, mergePdfFiles, splitPdfFile } from './pdfOps';

async function createTestPdfBase64(pageCount: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595, 842]);
  }
  return doc.saveAsBase64();
}

describe('pdfOps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 50000 });
  });

  describe('mergePdfFiles', () => {
    it('throws when fewer than 2 files are provided', async () => {
      await expect(mergePdfFiles(['file:///single.pdf'])).rejects.toThrow(
        'Select at least two PDF files to merge',
      );
    });

    it('merges multiple PDF files into one output PDF', async () => {
      const pdf1Base64 = await createTestPdfBase64(2);
      const pdf2Base64 = await createTestPdfBase64(3);

      mockReadAsStringAsync.mockImplementation((uri) => {
        if (uri.includes('pdf1')) return Promise.resolve(pdf1Base64);
        return Promise.resolve(pdf2Base64);
      });

      const outputUri = await mergePdfFiles(['file:///path/pdf1.pdf', 'file:///path/pdf2.pdf']);

      expect(outputUri).toBe('file:///cache/merged-test-uuid-123.pdf');
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        'file:///cache/merged-test-uuid-123.pdf',
        expect.any(String),
        { encoding: 'base64' },
      );
    });
  });

  describe('splitPdfFile', () => {
    it('throws when page range is invalid', async () => {
      const pdfBase64 = await createTestPdfBase64(3);
      mockReadAsStringAsync.mockResolvedValue(pdfBase64);

      await expect(splitPdfFile('file:///path/doc.pdf', 0, 2)).rejects.toThrow(
        'Page range must be between 1 and 3',
      );
      await expect(splitPdfFile('file:///path/doc.pdf', 2, 4)).rejects.toThrow(
        'Page range must be between 1 and 3',
      );
      await expect(splitPdfFile('file:///path/doc.pdf', 3, 1)).rejects.toThrow(
        'Page range must be between 1 and 3',
      );
    });

    it('extracts valid page range into a new PDF', async () => {
      const pdfBase64 = await createTestPdfBase64(5);
      mockReadAsStringAsync.mockResolvedValue(pdfBase64);

      const outputUri = await splitPdfFile('file:///path/doc.pdf', 2, 4);

      expect(outputUri).toBe('file:///cache/split-test-uuid-123.pdf');
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        'file:///cache/split-test-uuid-123.pdf',
        expect.any(String),
        { encoding: 'base64' },
      );
    });
  });

  describe('extractPdfPages', () => {
    it('throws when pageIndices is empty', async () => {
      await expect(extractPdfPages('file:///path/doc.pdf', [])).rejects.toThrow(
        'extractPdfPages: at least one page index must be specified',
      );
    });

    it('throws when any page index is out of bounds', async () => {
      const pdfBase64 = await createTestPdfBase64(3);
      mockReadAsStringAsync.mockResolvedValue(pdfBase64);

      await expect(extractPdfPages('file:///path/doc.pdf', [-1])).rejects.toThrow(
        'extractPdfPages: page index -1 is out of bounds (0..2)',
      );
      await expect(extractPdfPages('file:///path/doc.pdf', [0, 3])).rejects.toThrow(
        'extractPdfPages: page index 3 is out of bounds (0..2)',
      );
    });

    it('extracts arbitrary non-contiguous pages and deduplicates indices', async () => {
      const pdfBase64 = await createTestPdfBase64(5);
      mockReadAsStringAsync.mockResolvedValue(pdfBase64);

      // User selects page index 0 and 4, with duplicate 0
      const outputUri = await extractPdfPages('file:///path/doc.pdf', [0, 4, 0]);

      expect(outputUri).toBe('file:///cache/split-test-uuid-123.pdf');
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        'file:///cache/split-test-uuid-123.pdf',
        expect.any(String),
        { encoding: 'base64' },
      );
    });
  });

  describe('compressPdfFile', () => {
    it('rasterizes pages and builds a compressed PDF', async () => {
      // Valid minimal 1x1 JPEG base64 with SOI marker
      mockReadAsStringAsync.mockResolvedValue(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      );
      const result = await compressPdfFile('file:///path/source.pdf', 1, 2);

      expect(result.uri).toBe('file:///cache/compressed-test-uuid-123.pdf');
      expect(result.pageCount).toBe(1);
    });
  });
});
