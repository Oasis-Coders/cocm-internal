import type { Metadata } from 'next';
import './globals.css';

import { RouteProgress } from '@/components/layout/route-progress';
import { I18nProvider } from '@/lib/i18n/context';

export const metadata: Metadata = {
  title: 'COCM Internal',
  description: 'COCM 内部系统 — 用餐报名、人数统计与月底结算 / Internal workspace: meal signups, headcounts and monthly settlement.',
  applicationName: 'COCM Internal',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="bg-cocm-paper text-cocm-ink">
        <I18nProvider>
          <RouteProgress />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
