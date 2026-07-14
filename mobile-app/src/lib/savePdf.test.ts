import { PDFDocument } from '@cantoo/pdf-lib';

const mockRequestDirectoryPermissionsAsync = jest.fn();
const mockCreateFileAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadSafAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: (...args: unknown[]) =>
      mockRequestDirectoryPermissionsAsync(...args),
    createFileAsync: (...args: unknown[]) => mockCreateFileAsync(...args),
    writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
    readAsStringAsync: (...args: unknown[]) => mockReadSafAsStringAsync(...args),
    deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  },
}));

// Imported after the file-system mock so the module binds to the test functions above.
// eslint-disable-next-line import/first
import { savePdfToPickedDirectory } from './savePdf';

async function validPdfBase64(): Promise<string> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.saveAsBase64();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteAsync.mockResolvedValue(undefined);
  mockWriteAsStringAsync.mockResolvedValue(undefined);
});

it('returns null without creating a file when the directory picker is cancelled', async () => {
  mockRequestDirectoryPermissionsAsync.mockResolvedValue({ granted: false });

  await expect(savePdfToPickedDirectory('file:///cache/edit.pdf', 'edit.pdf')).resolves.toBeNull();
  expect(mockCreateFileAsync).not.toHaveBeenCalled();
});

it('writes and parses back a new PDF in the selected directory', async () => {
  const pdf = await validPdfBase64();
  mockRequestDirectoryPermissionsAsync.mockResolvedValue({
    granted: true,
    directoryUri: 'content://picked-folder',
  });
  mockCreateFileAsync.mockResolvedValue('content://picked-folder/edited.pdf');
  mockReadAsStringAsync.mockResolvedValue(pdf);
  mockReadSafAsStringAsync.mockResolvedValue(pdf);

  await expect(savePdfToPickedDirectory('file:///cache/edit.pdf', 'My: unsafe?.pdf')).resolves.toBe(
    'content://picked-folder/edited.pdf',
  );
  expect(mockCreateFileAsync).toHaveBeenCalledWith(
    'content://picked-folder',
    'My- unsafe-.pdf',
    'application/pdf',
  );
  expect(mockWriteAsStringAsync).toHaveBeenCalledWith('content://picked-folder/edited.pdf', pdf, {
    encoding: 'base64',
  });
});

it('deletes a corrupt destination instead of reporting success', async () => {
  mockRequestDirectoryPermissionsAsync.mockResolvedValue({
    granted: true,
    directoryUri: 'content://picked-folder',
  });
  mockCreateFileAsync.mockResolvedValue('content://picked-folder/edited.pdf');
  mockReadAsStringAsync.mockResolvedValue('source');
  mockReadSafAsStringAsync.mockResolvedValue('not-a-pdf');

  await expect(savePdfToPickedDirectory('file:///cache/edit.pdf', 'edit.pdf')).rejects.toThrow(
    /could not be validated/,
  );
  expect(mockDeleteAsync).toHaveBeenCalledWith('content://picked-folder/edited.pdf', {
    idempotent: true,
  });
});
