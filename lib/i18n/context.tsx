'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations, type Lang, resolveLang, nextLang, htmlLangAttr } from './translations';

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.en | typeof translations.zh | (typeof translations)['zh-Hant'];
  toggle: () => void;
};

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  const cookie = document.cookie
    .split('; ')
    .find((r) => r.startsWith('lang='))
    ?.split('=')[1];
  const fromCookie = resolveLang(cookie);
  if (cookie === 'en' || cookie === 'zh' || cookie === 'zh-Hant') return fromCookie;
  const stored = localStorage.getItem('lang');
  if (stored === 'en' || stored === 'zh' || stored === 'zh-Hant') return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('zh-tw') || browser.startsWith('zh-hk') || browser.startsWith('zh-mo'))
    return 'zh-Hant';
  return 'zh'; // default to zh per user base, cycle available
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
    document.documentElement.lang = htmlLangAttr(l);
  }, []);

  const toggle = useCallback(() => {
    setLang(nextLang(lang));
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
