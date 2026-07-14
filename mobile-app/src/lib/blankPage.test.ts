const mockWriteAsStringAsync = jest.fn();

jest.mock('expo-crypto', () => ({ randomUUID: () => 'blank-id' }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));

// Imported after native module mocks.
// eslint-disable-next-line import/first
import { createBlankPage } from './blankPage';

it('creates a stretchable white page with canonical point and logical pixel dimensions', async () => {
  const page = await createBlankPage(612, 792, 3);

  expect(page).toMatchObject({
    widthPt: 612,
    heightPt: 792,
    imagePxWidth: 1836,
    imagePxHeight: 2376,
    backgroundImageUri: 'file:///cache/blank-page-blank-id.png',
    edits: [],
    ocrLines: [],
    isBlank: true,
  });
  expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
    'file:///cache/blank-page-blank-id.png',
    expect.any(String),
    { encoding: 'base64' },
  );
});

it('rejects invalid page dimensions', async () => {
  await expect(createBlankPage(0, 792, 3)).rejects.toThrow(/must be positive/);
});
