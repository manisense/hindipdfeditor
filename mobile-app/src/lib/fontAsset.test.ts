const mockAssetDownloadAsync = jest.fn();
const mockAssetFromModule = jest.fn((_moduleId: number) => ({
  localUri: 'file:///bundled-font.ttf',
  downloadAsync: mockAssetDownloadAsync,
}));
const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockLoadAsync = jest.fn();

jest.mock('expo-asset', () => ({
  Asset: { fromModule: (moduleId: number) => mockAssetFromModule(moduleId) },
}));
jest.mock('expo-font', () => ({
  loadAsync: (...args: unknown[]) => mockLoadAsync(...args),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
}));

// Imported after native module mocks.
// eslint-disable-next-line import/first
import { fontFaceWeight, fontLabel, getFontBase64, installFontFamily } from './fontAsset';

beforeEach(() => {
  jest.clearAllMocks();
  mockAssetDownloadAsync.mockResolvedValue(undefined);
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockDeleteAsync.mockResolvedValue(undefined);
  mockDownloadAsync.mockResolvedValue({ uri: 'file:///documents/fonts/Hind.ttf' });
  mockLoadAsync.mockResolvedValue(undefined);
});

it('loads a bundled font asset and returns it for export embedding', async () => {
  mockReadAsStringAsync.mockResolvedValue('bundled-base64');

  await expect(getFontBase64('NotoSansDevanagari')).resolves.toBe('bundled-base64');
  expect(mockAssetFromModule).toHaveBeenCalled();
  expect(mockAssetDownloadAsync).toHaveBeenCalled();
});

it('downloads Mukta from the pinned official Google Fonts commit and validates it before load', async () => {
  mockGetInfoAsync
    .mockResolvedValueOnce({ exists: false })
    .mockResolvedValueOnce({ exists: true, size: 432_248 });
  mockReadAsStringAsync.mockResolvedValue('AAEAAA-valid-font-base64');

  await installFontFamily('Mukta');

  expect(mockDownloadAsync).toHaveBeenCalledWith(
    'https://raw.githubusercontent.com/google/fonts/ec0464b978de222073645d6d3366f3fdf03376d8/ofl/mukta/Mukta-Regular.ttf',
    'file:///documents/fonts/Mukta.ttf',
  );
  expect(mockLoadAsync).toHaveBeenCalledWith({ Mukta: 'file:///documents/fonts/Mukta.ttf' });
  await expect(getFontBase64('Mukta')).resolves.toBe('AAEAAA-valid-font-base64');
});

it('uses stable human-readable labels for downloaded families', () => {
  expect(fontLabel('Mukta')).toBe('Mukta');
  expect(fontFaceWeight('NotoSansDevanagari')).toBe('100 900');
  expect(fontFaceWeight('Mukta')).toBe('400');
});
