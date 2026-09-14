'use client';

import { useI18n } from './context';
import { useCallback } from 'react';

export function useT() {
  const { lang, t, setLang, toggle } = useI18n();

  // simple interpolation: replace {key} or {n}
  const tt = useCallback(
    (path: string, vars?: Record<string, string | number>): string => {
      // path like 'common.save' or 'nav.dashboard'
      const parts = path.split('.');
      let cur: any = t;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else return path; // fallback to key if missing
      }
      if (typeof cur !== 'string') return path;
      let res = cur as string;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          res = res.replaceAll(`{${k}}`, String(v));
        });
      }
      return res;
    },
    [t]
  );

  return { t, tt, lang, setLang, toggle, isZh: lang === 'zh', isEn: lang === 'en' };
}
