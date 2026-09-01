/**
 * Safe wrapper around expo-updates that gracefully falls back if the native module
 * is not compiled into the currently running APK (e.g. older development clients).
 */

export type SafeUpdateCheckResult = {
  isAvailable: boolean;
  manifest?: unknown;
};

export type SafeUpdatesModule = {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<SafeUpdateCheckResult>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

function getNativeUpdatesModule(): SafeUpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as typeof import('expo-updates');
    if (Updates && typeof Updates.checkForUpdateAsync === 'function') {
      return Updates;
    }
  } catch {
    // Native module not linked in current binary (e.g. development client)
  }
  return null;
}

export const safeUpdates: SafeUpdatesModule = {
  get isEnabled() {
    const mod = getNativeUpdatesModule();
    return mod?.isEnabled ?? false;
  },

  async checkForUpdateAsync(): Promise<SafeUpdateCheckResult> {
    const mod = getNativeUpdatesModule();
    if (mod && mod.isEnabled) {
      return await mod.checkForUpdateAsync();
    }
    return { isAvailable: false };
  },

  async fetchUpdateAsync(): Promise<{ isNew: boolean }> {
    const mod = getNativeUpdatesModule();
    if (mod && mod.isEnabled) {
      return await mod.fetchUpdateAsync();
    }
    return { isNew: false };
  },

  async reloadAsync(): Promise<void> {
    const mod = getNativeUpdatesModule();
    if (mod && mod.isEnabled) {
      await mod.reloadAsync();
    }
  },
};
