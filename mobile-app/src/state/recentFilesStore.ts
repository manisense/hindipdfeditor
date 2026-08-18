import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';

export type RecentFile = {
  id: string;
  name: string;
  hindiName?: string;
  uri: string;
  thumbnailUri?: string;
  sizeBytes: number;
  date: string;
  dateModified?: number;
  folder?: string;
  path?: string;
  pageCount: number;
  starred?: boolean;
  isRecent?: boolean;
  category: 'all' | 'downloads' | 'starred';
};

const STORAGE_PATH = `${FileSystem.documentDirectory ?? ''}recent_files_index.json`;

type RecentFilesState = {
  files: RecentFile[];
  loaded: boolean;
  initStore: () => Promise<void>;
  addFile: (file: Omit<RecentFile, 'id' | 'date'>) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  removeFile: (id: string) => Promise<void>;
};

async function persistFiles(files: RecentFile[]): Promise<void> {
  try {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(STORAGE_PATH, JSON.stringify(files));
  } catch (err) {
    console.warn('Failed to persist recent files', err);
  }
}

export const useRecentFilesStore = create<RecentFilesState>((set, get) => ({
  files: [],
  loaded: false,

  initStore: async () => {
    try {
      if (!FileSystem.documentDirectory) return;
      const info = await FileSystem.getInfoAsync(STORAGE_PATH);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(STORAGE_PATH);
        const parsed = JSON.parse(raw) as RecentFile[];
        if (Array.isArray(parsed)) {
          set({ files: parsed, loaded: true });
          return;
        }
      }
    } catch {
      // ignore parse error, start empty
    }
    set({ files: [], loaded: true });
  },

  addFile: async (newFile) => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const file: RecentFile = {
      ...newFile,
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: today,
    };
    const current = get().files;
    const filtered = current.filter((f) => f.uri !== newFile.uri && f.name !== newFile.name);
    const updated = [file, ...filtered].slice(0, 30);
    set({ files: updated });
    await persistFiles(updated);
  },

  toggleStar: async (id) => {
    const updated = get().files.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f));
    set({ files: updated });
    await persistFiles(updated);
  },

  removeFile: async (id) => {
    const updated = get().files.filter((f) => f.id !== id);
    set({ files: updated });
    await persistFiles(updated);
  },
}));
