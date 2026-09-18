import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getStoredLang, setStoredLang } from '@/lib/storage';
import { getT, type TranslationKey } from '@/lib/i18n';
import type { Language } from '@/lib/types';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  tFn: (key: 'toastImported' | 'toastMigrated' | 'wordsCount', n: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => getStoredLang());

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    setStoredLang(newLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'en' ? 'vi' : 'en';
      setStoredLang(next);
      return next;
    });
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return getT(lang)[key] as string;
  }, [lang]);

  const tFn = useCallback((key: 'toastImported' | 'toastMigrated' | 'wordsCount', n: number) => {
    const fn = getT(lang)[key] as unknown as (n: number) => string;
    return fn(n);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
