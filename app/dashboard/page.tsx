import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { MetricCard } from '@/components/layout/metric-card';
import { getSession } from '@/lib/auth/session';
import { translations, type Lang } from '@/lib/i18n/translations';

export default async function DashboardPage() {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].dashboard;
  const comingSoon = translations[lang].common.comingSoon;

  const firstName = session.displayName || session.email;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <div className="rounded-panel border border-cocm-ink/10 bg-white p-6 shadow-card md:p-8">
        <h3 className="font-serif text-3xl tracking-tight text-cocm-ink">
          {lang === 'zh' ? `你好，${firstName}` : `Hello, ${firstName}`}
        </h3>
        <p className="mt-3 max-w-2xl text-cocm-slate">{t.welcomeDesc}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
        <MetricCard label={t.mealsThisMonth} value="—" helper={`${t.mealsHint} · ${comingSoon}`} />
        <MetricCard label={t.signupCount} value="—" helper={`${t.signupsHint} · ${comingSoon}`} />
        <MetricCard
          label={t.settlementPending}
          value="—"
          helper={`${t.settlementHint} · ${comingSoon}`}
        />
      </div>
    </AppShell>
  );
}
