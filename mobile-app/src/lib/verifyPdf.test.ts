import { PDFDocument } from '@cantoo/pdf-lib';

const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

// Imported after the file-system mock so the module binds to the test functions above.
// eslint-disable-next-line import/first
import { verifyPdfOutput } from './verifyPdf';

async function pdfBase64(pages: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return doc.saveAsBase64();
}

beforeEach(() => jest.clearAllMocks());

it('returns the size and page count of a file that parses back', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2048 });
  mockReadAsStringAsync.mockResolvedValue(await pdfBase64(3));
  await expect(verifyPdfOutput('file:///out.pdf', 3)).resolves.toEqual({
    sizeBytes: 2048,
    pageCount: 3,
  });
});

it('rejects a missing or empty file without reading it', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
  await expect(verifyPdfOutput('file:///out.pdf', 1)).rejects.toThrow(/missing or empty/);
  expect(mockReadAsStringAsync).not.toHaveBeenCalled();
});

it('rejects a file that is not a PDF', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 10 });
  mockReadAsStringAsync.mockResolvedValue(btoa('not a pdf'));
  await expect(verifyPdfOutput('file:///out.pdf', 1)).rejects.toThrow(/could not be re-parsed/);
});

it('rejects a page count that does not match', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2048 });
  mockReadAsStringAsync.mockResolvedValue(await pdfBase64(2));
  await expect(verifyPdfOutput('file:///out.pdf', 3)).rejects.toThrow(/expected 3 page/);
});

it('skips the page count check when no count is expected', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2048 });
  mockReadAsStringAsync.mockResolvedValue(await pdfBase64(2));
  await expect(verifyPdfOutput('file:///out.pdf')).resolves.toEqual({
    sizeBytes: 2048,
    pageCount: 2,
  });
});
