const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockCheckForUpdateAsync = jest.fn();
const mockFetchUpdateAsync = jest.fn();
const mockReloadAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.hindipdfeditor.app/files/',
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));

jest.mock('expo-updates', () => ({
  isEnabled: false,
  checkForUpdateAsync: () => mockCheckForUpdateAsync(),
  fetchUpdateAsync: () => mockFetchUpdateAsync(),
  reloadAsync: () => mockReloadAsync(),
}));

// Imported after native module mocks.
// eslint-disable-next-line import/first
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      language: 'bilingual',
      theme: 'light',
      lastCheckedForUpdates: null,
      isCheckingUpdate: false,
      updateStatus: 'idle',
      updateMessage: null,
      loaded: false,
    });
  });

  test('sets language and persists to storage', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await useSettingsStore.getState().setLanguage('hindi');

    expect(useSettingsStore.getState().language).toBe('hindi');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('app_settings.json'),
      expect.stringContaining('"language":"hindi"'),
    );
  });

  test('sets theme and persists to storage', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await useSettingsStore.getState().setTheme('dark');

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('app_settings.json'),
      expect.stringContaining('"theme":"dark"'),
    );
  });

  test('checkForUpdates runs check, sets latest status and persists timestamp', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    const result = await useSettingsStore.getState().checkForUpdates();

    expect(result.isLatest).toBe(true);
    expect(useSettingsStore.getState().updateStatus).toBe('latest');
    expect(useSettingsStore.getState().isCheckingUpdate).toBe(false);
    expect(useSettingsStore.getState().lastCheckedForUpdates).not.toBeNull();
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
  });

  test('initStore loads saved settings correctly', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true });
    mockReadAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({
        language: 'english',
        theme: 'system',
        lastCheckedForUpdates: 'Yesterday at 10:00 AM',
      }),
    );

    await useSettingsStore.getState().initStore();

    expect(useSettingsStore.getState().loaded).toBe(true);
    expect(useSettingsStore.getState().language).toBe('english');
    expect(useSettingsStore.getState().theme).toBe('system');
    expect(useSettingsStore.getState().lastCheckedForUpdates).toBe('Yesterday at 10:00 AM');
  });
});
