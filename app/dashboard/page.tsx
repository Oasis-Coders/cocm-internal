import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { MetricCard } from '@/components/layout/metric-card';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import { currentYearMonth, formatMoney, monthBounds } from '@/lib/meals';

type DashboardStats = {
  daysThisMonth: number | null;
  mySignupsThisMonth: number | null;
  myTotalThisMonth: number | null;
  currency: string;
};

async function loadDashboardStats(userId: string): Promise<DashboardStats> {
  const fallback: DashboardStats = {
    daysThisMonth: null,
    mySignupsThisMonth: null,
    myTotalThisMonth: null,
    currency: 'GBP',
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallback;

  try {
    const { year, month } = currentYearMonth();
    const { start, end } = monthBounds(year, month);

    const [{ count: dayCount }, { data: signupRows }, { data: settingsRow }] = await Promise.all([
      supabase
        .from('meal_days')
        .select('meal_date', { count: 'exact', head: true })
        .gte('meal_date', start)
        .lt('meal_date', end),
      supabase
        .from('meal_signups')
        .select('price')
        .eq('user_id', userId)
        .gte('meal_date', start)
        .lt('meal_date', end),
      supabase.from('meal_settings').select('currency').eq('id', 1).maybeSingle(),
    ]);

    const rows = signupRows ?? [];
    return {
      daysThisMonth: dayCount ?? 0,
      mySignupsThisMonth: rows.length,
      myTotalThisMonth: rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0),
      currency: (settingsRow?.currency as string) ?? 'GBP',
    };
  } catch {
    return fallback;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].dashboard;
  const comingSoon = translations[lang].common.comingSoon;

  const firstName = session.displayName || session.email;
  const stats =
    session.isAuthenticated && session.userId
      ? await loadDashboardStats(session.userId)
      : { daysThisMonth: null, mySignupsThisMonth: null, myTotalThisMonth: null, currency: 'GBP' };

  const fmt = (n: number | null) => (n === null ? '—' : String(n));

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <div className="rounded-panel border border-cocm-ink/10 bg-white p-6 shadow-card md:p-8">
        <h3 className="font-serif text-3xl tracking-tight text-cocm-ink">
          {lang === 'zh' ? `你好，${firstName}` : `Hello, ${firstName}`}
        </h3>
        <p className="mt-3 max-w-2xl text-cocm-slate">{t.welcomeDesc}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
        <MetricCard
          label={t.mealsThisMonth}
          value={fmt(stats.daysThisMonth)}
          helper={stats.daysThisMonth === null ? `${t.mealsHint} · ${comingSoon}` : t.mealsHint}
        />
        <MetricCard
          label={t.signupCount}
          value={fmt(stats.mySignupsThisMonth)}
          helper={stats.mySignupsThisMonth === null ? `${t.signupsHint} · ${comingSoon}` : t.signupsHint}
        />
        <MetricCard
          label={t.settlementPending}
          value={
            stats.myTotalThisMonth === null
              ? '—'
              : formatMoney(stats.myTotalThisMonth, stats.currency)
          }
          helper={
            stats.myTotalThisMonth === null ? `${t.settlementHint} · ${comingSoon}` : t.settlementHint
          }
        />
      </div>
    </AppShell>
  );
}
