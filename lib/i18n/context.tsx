'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations, type Lang } from './translations';

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.en | typeof translations.zh;
  toggle: () => void;
};

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  const cookie = document.cookie.split('; ').find((r) => r.startsWith('lang='))?.split('=')[1] as Lang | undefined;
  if (cookie === 'en' || cookie === 'zh') return cookie;
  const stored = localStorage.getItem('lang') as Lang | null;
  if (stored === 'en' || stored === 'zh') return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('zh')) return 'zh';
  return 'zh'; // default to zh per user base, but toggle available
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getInitialLang());
    setMounted(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
    document.cookie = `lang=${l}; path=/; max-age=31536000`;
    // update html lang attr
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  // avoid hydration mismatch by rendering zh initially on server, then sync
  const t = translations[lang];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, toggle }}>
      {/* keep consistent while mounting */}
      <div suppressHydrationWarning>{children}</div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
