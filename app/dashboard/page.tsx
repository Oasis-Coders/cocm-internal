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
      <div className="relative overflow-hidden rounded-[24px] bg-cocm-ink p-6 text-white shadow-panel md:p-8">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-cocm-red/25 blur-[32px]" />
          <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#3f43a8] blur-[28px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-cocm-red/10 via-transparent to-transparent" aria-hidden="true" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.eyebrow}
          </p>
          <h3 className="mt-2 font-serif text-3xl tracking-tight text-white">
            {lang === 'zh' ? `你好，${firstName}` : `Hello, ${firstName}`}
          </h3>
          <p className="mt-3 max-w-2xl leading-relaxed text-white/70">{t.welcomeDesc}</p>
        </div>
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
