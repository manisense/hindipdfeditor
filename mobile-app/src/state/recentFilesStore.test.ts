const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.hindipdfeditor.app/files/',
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));
// Imported after native module mocks.
// eslint-disable-next-line import/first
import { useRecentFilesStore } from './recentFilesStore';

describe('recentFilesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRecentFilesStore.setState({ files: [], loaded: false });
  });

  test('addFile adds a new file and persists to storage', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await useRecentFilesStore.getState().addFile({
      name: 'Sample.pdf',
      hindiName: 'सैंपल.pdf',
      uri: 'file:///storage/Sample.pdf',
      sizeBytes: 1024,
      pageCount: 2,
      category: 'all',
      folder: 'Download',
    });

    const files = useRecentFilesStore.getState().files;
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('Sample.pdf');
    expect(files[0].folder).toBe('Download');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
  });

  test('addFile deduplicates files by URI and name', async () => {
    mockWriteAsStringAsync.mockResolvedValue(undefined);

    await useRecentFilesStore.getState().addFile({
      name: 'Duplicate.pdf',
      uri: 'file:///storage/Duplicate.pdf',
      sizeBytes: 2048,
      pageCount: 1,
      category: 'all',
    });

    await useRecentFilesStore.getState().addFile({
      name: 'Duplicate.pdf',
      uri: 'file:///storage/Duplicate.pdf',
      sizeBytes: 2048,
      pageCount: 3,
      category: 'downloads',
    });

    const files = useRecentFilesStore.getState().files;
    expect(files).toHaveLength(1);
    expect(files[0].pageCount).toBe(3);
  });

  test('toggleStar toggles starred status and persists', async () => {
    mockWriteAsStringAsync.mockResolvedValue(undefined);

    await useRecentFilesStore.getState().addFile({
      name: 'Doc.pdf',
      uri: 'file:///storage/Doc.pdf',
      sizeBytes: 500,
      pageCount: 1,
      category: 'all',
      starred: false,
    });

    const fileId = useRecentFilesStore.getState().files[0].id;
    await useRecentFilesStore.getState().toggleStar(fileId);

    expect(useRecentFilesStore.getState().files[0].starred).toBe(true);

    await useRecentFilesStore.getState().toggleStar(fileId);
    expect(useRecentFilesStore.getState().files[0].starred).toBe(false);
  });

  test('removeFile removes item by ID and persists', async () => {
    mockWriteAsStringAsync.mockResolvedValue(undefined);

    await useRecentFilesStore.getState().addFile({
      name: 'Doc1.pdf',
      uri: 'file:///storage/Doc1.pdf',
      sizeBytes: 500,
      pageCount: 1,
      category: 'all',
    });

    const fileId = useRecentFilesStore.getState().files[0].id;
    await useRecentFilesStore.getState().removeFile(fileId);

    expect(useRecentFilesStore.getState().files).toHaveLength(0);
  });
});
