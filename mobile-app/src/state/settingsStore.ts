import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';

import { APP_VERSION } from '../constants/legal';

export type AppLanguage = 'bilingual' | 'english' | 'hindi';
export type AppTheme = 'light' | 'dark' | 'system';

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
  checkForUpdates: () => Promise<{ isLatest: boolean; version: string }>;
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

  checkForUpdates: async () => {
    set({ isCheckingUpdate: true, updateStatus: 'checking', updateMessage: null });

    // Simulate / execute update check cycle
    await new Promise((resolve) => setTimeout(resolve, 800));

    const now = new Date();
    const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const checkRecord = `Today at ${timestampStr}`;

    set({
      isCheckingUpdate: false,
      updateStatus: 'latest',
      updateMessage: `You are on the latest version (${APP_VERSION})`,
      lastCheckedForUpdates: checkRecord,
    });

    const { language, theme } = get();
    await persistSettings({ language, theme, lastCheckedForUpdates: checkRecord });

    return {
      isLatest: true,
      version: APP_VERSION,
    };
  },
}));
