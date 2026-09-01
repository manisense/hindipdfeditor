import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';

import { APP_VERSION } from '../constants/legal';
import { safeUpdates } from '../lib/safeUpdates';

export type AppLanguage = 'bilingual' | 'english' | 'hindi';
export type AppTheme = 'light' | 'dark' | 'system';

export type CheckUpdateResult = {
  isAvailable: boolean;
  isLatest: boolean;
  version: string;
  isDev?: boolean;
  error?: string;
};

export type SettingsState = {
  language: AppLanguage;
  theme: AppTheme;
  lastCheckedForUpdates: string | null;
  isCheckingUpdate: boolean;
  updateStatus: 'idle' | 'checking' | 'latest' | 'available' | 'error';
  updateMessage: string | null;
  loaded: boolean;

  initStore: () => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  checkForUpdates: () => Promise<CheckUpdateResult>;
  reloadAppUpdate: () => Promise<void>;
};

type PersistedSettings = {
  language: AppLanguage;
  theme: AppTheme;
  lastCheckedForUpdates: string | null;
};

const STORAGE_PATH = `${FileSystem.documentDirectory ?? ''}app_settings.json`;

async function persistSettings(data: PersistedSettings): Promise<void> {
  try {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(STORAGE_PATH, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to persist app settings', err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'bilingual',
  theme: 'light',
  lastCheckedForUpdates: null,
  isCheckingUpdate: false,
  updateStatus: 'idle',
  updateMessage: null,
  loaded: false,

  initStore: async () => {
    try {
      if (!FileSystem.documentDirectory) return;
      const info = await FileSystem.getInfoAsync(STORAGE_PATH);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(STORAGE_PATH);
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        set({
          language: parsed.language ?? 'bilingual',
          theme: parsed.theme ?? 'light',
          lastCheckedForUpdates: parsed.lastCheckedForUpdates ?? null,
          loaded: true,
        });
        return;
      }
    } catch {
      // ignore parse error, start with defaults
    }
    set({ loaded: true });
  },

  setLanguage: async (language: AppLanguage) => {
    set({ language });
    const { theme, lastCheckedForUpdates } = get();
    await persistSettings({ language, theme, lastCheckedForUpdates });
  },

  setTheme: async (theme: AppTheme) => {
    set({ theme });
    const { language, lastCheckedForUpdates } = get();
    await persistSettings({ language, theme, lastCheckedForUpdates });
  },

  checkForUpdates: async (): Promise<CheckUpdateResult> => {
    set({ isCheckingUpdate: true, updateStatus: 'checking', updateMessage: null });

    const now = new Date();
    const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const checkRecord = `Today at ${timestampStr}`;

    try {
      if (!safeUpdates.isEnabled || __DEV__) {
        // In local dev client, simulate check smoothly
        await new Promise((resolve) => setTimeout(resolve, 600));
        set({
          isCheckingUpdate: false,
          updateStatus: 'latest',
          updateMessage: `You are on the latest version (${APP_VERSION})`,
          lastCheckedForUpdates: checkRecord,
        });

        const { language, theme } = get();
        await persistSettings({ language, theme, lastCheckedForUpdates: checkRecord });

        return {
          isAvailable: false,
          isLatest: true,
          version: APP_VERSION,
          isDev: true,
        };
      }

      const updateCheck = await safeUpdates.checkForUpdateAsync();
      if (updateCheck.isAvailable) {
        await safeUpdates.fetchUpdateAsync();
        set({
          isCheckingUpdate: false,
          updateStatus: 'available',
          updateMessage: 'New update downloaded. Restart to apply.',
          lastCheckedForUpdates: checkRecord,
        });

        const { language, theme } = get();
        await persistSettings({ language, theme, lastCheckedForUpdates: checkRecord });

        return {
          isAvailable: true,
          isLatest: false,
          version: APP_VERSION,
        };
      }

      set({
        isCheckingUpdate: false,
        updateStatus: 'latest',
        updateMessage: `You are on the latest version (${APP_VERSION})`,
        lastCheckedForUpdates: checkRecord,
      });

      const { language, theme } = get();
      await persistSettings({ language, theme, lastCheckedForUpdates: checkRecord });

      return {
        isAvailable: false,
        isLatest: true,
        version: APP_VERSION,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Update check failed';
      set({
        isCheckingUpdate: false,
        updateStatus: 'error',
        updateMessage: errMsg,
      });
      return {
        isAvailable: false,
        isLatest: false,
        version: APP_VERSION,
        error: errMsg,
      };
    }
  },

  reloadAppUpdate: async () => {
    try {
      if (safeUpdates.isEnabled) {
        await safeUpdates.reloadAsync();
      }
    } catch (err) {
      console.warn('Failed to reload app update', err);
    }
  },
}));
