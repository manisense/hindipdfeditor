const mockGetInfoAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockVerify = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/files/',
  cacheDirectory: 'file:///data/cache/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
}));
jest.mock('./verifyPdf', () => ({
  verifyPdfOutput: (...args: unknown[]) => mockVerify(...args),
}));

// Imported after the mocks so the module binds to the test functions above.
// eslint-disable-next-line import/first
import { discardTemporaryOutput, numberedFileName, persistOutput } from './persistOutput';

const TEMP = 'file:///data/cache/merged-1.pdf';

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteAsync.mockResolvedValue(undefined);
  mockCopyAsync.mockResolvedValue(undefined);
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockVerify.mockResolvedValue({ pageCount: 3, sizeBytes: 2048 });
});

it('numbers later copies before the extension', () => {
  expect(numberedFileName('पत्र.pdf', 1)).toBe('पत्र.pdf');
  expect(numberedFileName('पत्र.pdf', 3)).toBe('पत्र (3).pdf');
});

it('copies into the tool folder, verifies the copy and deletes the temporary file', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: false });
  await expect(persistOutput(TEMP, 'Merged', 'a/b.pdf', 3)).resolves.toEqual({
    uri: 'file:///data/files/Merged/a-b.pdf',
    name: 'a-b.pdf',
    pageCount: 3,
    sizeBytes: 2048,
  });
  expect(mockMakeDirectoryAsync).toHaveBeenCalledWith('file:///data/files/Merged/', {
    intermediates: true,
  });
  expect(mockVerify).toHaveBeenCalledWith('file:///data/files/Merged/a-b.pdf', 3);
  expect(mockDeleteAsync).toHaveBeenCalledWith(TEMP, { idempotent: true });
});

it('adds (n) instead of overwriting an earlier file', async () => {
  mockGetInfoAsync
    .mockResolvedValueOnce({ exists: true })
    .mockResolvedValueOnce({ exists: true })
    .mockResolvedValue({ exists: false });
  const saved = await persistOutput(TEMP, 'Split', 'नया पत्र.pdf');
  expect(saved.name).toBe('नया पत्र (3).pdf');
  expect(mockCopyAsync).toHaveBeenCalledWith({
    from: TEMP,
    to: `file:///data/files/Split/${encodeURIComponent('नया पत्र (3).pdf')}`,
  });
});

it('deletes the copy and rethrows when the copy fails the check', async () => {
  mockGetInfoAsync.mockResolvedValue({ exists: false });
  mockVerify.mockRejectedValue(new Error('not a PDF'));
  await expect(persistOutput(TEMP, 'Compressed', 'x.pdf', 1)).rejects.toThrow('not a PDF');
  expect(mockDeleteAsync).toHaveBeenCalledWith('file:///data/files/Compressed/x.pdf', {
    idempotent: true,
  });
  expect(mockDeleteAsync).toHaveBeenCalledWith(TEMP, { idempotent: true });
});

it('never deletes a file outside the app cache', async () => {
  await discardTemporaryOutput('file:///data/files/Edited/source.pdf');
  await discardTemporaryOutput('content://com.android.providers/document/1');
  expect(mockDeleteAsync).not.toHaveBeenCalled();
});
