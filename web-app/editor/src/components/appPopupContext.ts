import { createContext, useContext } from 'react';

export type AppPopupTone = 'info' | 'success' | 'warning' | 'error';

export type ShowPopupOptions = {
  title: string;
  message: string;
  tone?: AppPopupTone;
  eyebrow?: string;
  actionLabel?: string;
};

export type AppPopupContextValue = {
  showPopup: (options: ShowPopupOptions) => Promise<void>;
};

export const AppPopupContext = createContext<AppPopupContextValue | null>(null);

/** Returns the shared popup dispatcher; callers must be inside AppPopupProvider. */
export function useAppPopup(): AppPopupContextValue {
  const context = useContext(AppPopupContext);
  if (!context) {
    throw new Error('useAppPopup must be used within AppPopupProvider');
  }
  return context;
}
