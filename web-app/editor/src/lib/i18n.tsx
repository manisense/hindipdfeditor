/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

export type Language = 'en' | 'hi';

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
  isHindi: boolean;
}

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // FAQ
    'faq.eyebrow': 'Frequently asked questions',
    'faq.title': 'Everything you need to know',
    'faq.subtitle': 'Common questions about Hindi PDF editing, Devanagari font shaping, privacy, and tools.',

    // Footer
    'footer.desc': 'Every tool you need to work with Hindi PDFs, in one private, Devanagari-safe place.',
    'footer.editOcr': 'Edit & OCR',
    'footer.organize': 'Organize & optimize',
    'footer.resources': 'Resources & Guides',
    'footer.rights': '© 2026 Hindi PDF Editor. All rights reserved.',
    'footer.tagline': 'Editing runs in your browser · No account needed',
  },
  hi: {
    // FAQ
    'faq.eyebrow': 'अक्सर पूछे जाने वाले सवाल',
    'faq.title': 'जरूरी सवालों के आसान जवाब',
    'faq.subtitle': 'हिंदी पीडीएफ एडिटिंग, फॉन्ट शेपिंग, प्राइवेसी और टूल्स के बारे में सामान्य प्रश्न।',

    // Footer
    'footer.desc': 'हिंदी पीडीएफ के हर काम के टूल, एक ही प्राइवेट जगह पर, सही देवनागरी के साथ।',
    'footer.editOcr': 'एडिट और ओसीआर',
    'footer.organize': 'प्रबंधन और कंप्रेस',
    'footer.resources': 'संसाधन और गाइड्स',
    'footer.rights': '© 2026 Hindi PDF Editor. सर्वाधिकार सुरक्षित।',
    'footer.tagline': 'एडिटिंग आपके ब्राउज़र में · कोई अकाउंट नहीं',
  },
};

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string, defaultText?: string) => defaultText || key,
  isHindi: false,
});

export const LANGUAGE_PREFERENCE_KEY = 'preferred_language';

/** Reads the visitor's explicit language choice; storage can be unavailable in private modes. */
export function readLanguagePreference(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    return saved === 'hi' || saved === 'en' ? saved : null;
  } catch {
    return null;
  }
}

/** Stores the visitor's explicit language choice; storage can be unavailable in private modes. */
export function saveLanguagePreference(lang: Language): void {
  try {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, lang);
  } catch {
    // Storage blocked: the URL still carries the language, so nothing is lost.
  }
}

type LanguageProviderProps = {
  /** Language of the current URL (`/hi/...` is Hindi); each language has its own page. */
  lang: Language;
  /** Returns the path of the current page in another language. */
  pathFor: (lang: Language) => string;
  children: ReactNode;
};

export function LanguageProvider({ lang, pathFor, children }: LanguageProviderProps) {
  const setLang = (newLang: Language) => {
    saveLanguagePreference(newLang);
    if (newLang !== lang) {
      window.location.assign(`${pathFor(newLang)}${window.location.search}${window.location.hash}`);
    }
  };

  const t = (key: string, defaultText?: string): string => {
    const langDict = translations[lang] || translations.en;
    if (langDict[key]) return langDict[key];
    if (translations.en[key]) return translations.en[key];
    return defaultText || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isHindi: lang === 'hi' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  return useContext(I18nContext);
}

/** Returns a picker for inline bilingual UI strings: `tx('Merge', 'जोड़ें')`. */
export function useTx(): (en: string, hi: string) => string {
  const { isHindi } = useLanguage();
  return (en, hi) => (isHindi ? hi : en);
}
