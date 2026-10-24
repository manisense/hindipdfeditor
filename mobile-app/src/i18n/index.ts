import { useCallback } from 'react';

import { useSettingsStore, type AppLanguage } from '../state/settingsStore';

/** Chooses the label for the current app language. Bilingual joins both with a middle dot. */
export function pickText(language: AppLanguage, en: string, hi: string): string {
  if (language === 'english' || !hi) return en;
  if (language === 'hindi') return hi;
  return `${en} · ${hi}`;
}

/** Hook returning `tx(en, hi)` bound to the current language. */
export function useTx(): (en: string, hi: string) => string {
  const language = useSettingsStore((s) => s.language);
  return useCallback((en: string, hi: string) => pickText(language, en, hi), [language]);
}

/** True when screens should use the Devanagari font for UI text. */
export function useIsHindi(): boolean {
  return useSettingsStore((s) => s.language === 'hindi');
}
