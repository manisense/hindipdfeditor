import { createContext, useContext } from 'react';

export type AppPopupTone = 'info' | 'success' | 'warning' | 'error';

export type ShowPopupOptions = {
  title: string;
  message: string;
  tone?: AppPopupTone;
  eyebrow?: string;
  actionLabel?: string;
  cancelLabel?: string;
};

export type AppPopupContextValue = {
  showPopup: (options: ShowPopupOptions) => Promise<boolean>;
};

export const AppPopupContext = createContext<AppPopupContextValue>({
  showPopup: async () => true,
});

export function useAppPopup(): AppPopupContextValue {
  return useContext(AppPopupContext);
}
