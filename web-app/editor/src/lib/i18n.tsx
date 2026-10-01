import { translations } from "../home/translations";
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "hi";

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isHindi: boolean;
  t: (key: string, defaultText?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  isHindi: false,
  t: (key, fallback) => fallback ?? key,
});

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [lang, setLangState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    if (typeof window === "undefined") return "en";
    if (window.location.pathname === "/") return "en";
    if (window.location.pathname === "/hi/") return "hi";
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "hi" || urlLang === "en") return urlLang;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("preferred_language");
    } catch {
      /* Storage can be unavailable in private browsers. */
    }
    if (saved === "hi" || saved === "en") return saved;
    if (navigator.language && navigator.language.startsWith("hi")) return "hi";
    return "en";
  });

  const setLang = (newLang: Language) => {
    if (
      typeof window !== "undefined" &&
      ["/", "/hi/"].includes(window.location.pathname)
    ) {
      window.location.assign(newLang === "hi" ? "/hi/" : "/");
      return;
    }
    setLangState(newLang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("preferred_language", newLang);
      } catch {
        /* UI language still changes without persistence. */
      }
      document.documentElement.lang = newLang;
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        isHindi: lang === "hi",
        t: (key, fallback) =>
          translations[lang][key] ?? translations.en[key] ?? fallback ?? key,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  return useContext(I18nContext);
}

/** Select a translated UI label without changing the document or public route. */
export function useTx(): (en: string, hi: string) => string {
  const { isHindi } = useLanguage();
  return (en, hi) => (isHindi ? hi : en);
}
