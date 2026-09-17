import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

import { RouteProgress } from '@/components/layout/route-progress';
import { I18nProvider } from '@/lib/i18n/context';
import { resolveLang, htmlLangAttr } from '@/lib/i18n/translations';

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  const title =
    lang === 'en' ? 'COCM Internal' : lang === 'zh-Hant' ? 'COCM 內部系統' : 'COCM 内部系统';
  const description =
    lang === 'en'
      ? 'Internal workspace: meal signups, headcounts and monthly settlement.'
      : lang === 'zh-Hant'
        ? 'COCM 內部系統 — 用餐報名、人數統計與月底結算'
        : 'COCM 内部系统 — 用餐报名、人数统计与月底结算';
  return { title, description, applicationName: title };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  return (
    <html lang={htmlLangAttr(lang)}>
      <body className="brand-wash-bg text-cocm-ink">
        <I18nProvider>
          <RouteProgress />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
