import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import {
  currentYearMonth,
  monthBounds,
  type DinerIdentity,
  type MealDiner,
  type MealType,
} from '@/lib/meals';
import { StatsView, type DayStat, type DinerStat } from '@/app/meals/stats/stats-view';
import type { DinerPayment } from '@/app/meals/stats/actions';

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

function isValidPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export default async function MealStatsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].meals;
  const tc = translations[lang].common;

  if (!session.isAuthenticated) {
    redirect('/sign-in?redirectTo=/meals/stats');
  }
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    redirect('/meals');
  }

  const params = await searchParams;
  const { year: cy, month: cm } = currentYearMonth();
  const period = params.month && isValidPeriod(params.month)
    ? params.month
    : `${cy}-${String(cm).padStart(2, '0')}`;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const { start, end } = monthBounds(year, month);

  const supabase = await createSupabaseServerClient();

  const [{ data: dayRows }, { data: signupRows }, { data: dinerRows }, { data: paymentRows }] = await Promise.all([
    supabase!.from('meal_days')
      .select('meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day, note')
      .gte('meal_date', start)
      .lt('meal_date', end)
      .order('meal_date', { ascending: true }),
    supabase!.from('meal_signups')
      .select('id, meal_date, meal_type, diner_id, display_name, identity, headcount, price, booked_by')
      .gte('meal_date', start)
      .lt('meal_date', end)
      .order('meal_date', { ascending: true }),
    supabase!.from('meal_diners').select('id, name, identity').limit(2000),
    supabase!.from('meal_payments')
      .select('id, diner_id, user_id, period, kind, amount, note, recorded_by, created_at')
      .eq('period', period)
      .order('created_at', { ascending: false }),
  ]);

  const diners = ((dinerRows ?? []) as MealDiner[]);
  const dinerName = new Map(diners.map((d) => [d.id, d.name]));
  const dinerIdentity = new Map(diners.map((d) => [d.id, d.identity]));

  type SignupRow = {
    id: string;
    meal_date: string;
    meal_type: MealType;
    diner_id: string | null;
    display_name: string | null;
    identity: DinerIdentity | null;
    headcount: number | null;
    price: number | string | null;
    booked_by: string | null;
  };
  const signups = ((signupRows ?? []) as SignupRow[]);

  // Booker display names.
  const bookerIds = [...new Set(signups.map((s) => s.booked_by).filter(Boolean))] as string[];
  let bookerName = new Map<string, string>();
  if (bookerIds.length > 0) {
    const { data: profiles } = await supabase!.from('profiles')
      .select('id, display_name')
      .in('id', bookerIds);
    bookerName = new Map(((profiles ?? []) as Array<{ id: string; display_name: string | null }>)
      .map((p) => [p.id, p.display_name ?? '—']));
  }

  // Per-day stats.
  const dayStats: DayStat[] = ((dayRows ?? []) as Array<{
    meal_date: string;
    breakfast_available: boolean;
    lunch_available: boolean;
    dinner_available: boolean;
    is_camp_day: boolean;
    note: string | null;
  }>).map((d) => {
    const list = signups.filter((s) => s.meal_date === d.meal_date);
    const counts = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const s of list) {
      const h = Number(s.headcount) || 1;
      if (s.meal_type === 'breakfast') counts.breakfast += h;
      else if (s.meal_type === 'lunch') counts.lunch += h;
      else if (s.meal_type === 'dinner') counts.dinner += h;
    }
    return {
      date: d.meal_date,
      isCamp: !!d.is_camp_day,
      note: d.note,
      counts,
      total: counts.breakfast + counts.lunch + counts.dinner,
      signups: list.map((s) => ({
        meal: s.meal_type,
        name: s.display_name ?? (s.diner_id ? dinerName.get(s.diner_id) ?? '—' : '—'),
        identity: s.identity ?? (s.diner_id ? dinerIdentity.get(s.diner_id) ?? null : null),
        headcount: Number(s.headcount) || 1,
        price: Number(s.price) || 0,
        bookedBy: s.booked_by ? bookerName.get(s.booked_by) ?? '—' : '—',
      })),
    };
  });

  // Per-diner monthly stats.
  const byDiner = new Map<string, DinerStat & { paid: number; adjusted: number }>();
  const ensure = (dinerId: string): DinerStat & { paid: number; adjusted: number } => {
    let e = byDiner.get(dinerId);
    if (!e) {
      e = {
        dinerId,
        name: dinerName.get(dinerId) ?? '—',
        identity: dinerIdentity.get(dinerId) ?? null,
        meals: 0,
        owed: 0,
        paid: 0,
        adjusted: 0,
        outstanding: 0,
      };
      byDiner.set(dinerId, e);
    }
    return e;
  };
  for (const s of signups) {
    if (!s.diner_id) continue;
    const e = ensure(s.diner_id);
    if (s.display_name) e.name = s.display_name;
    if (s.identity) e.identity = s.identity;
    e.meals += Number(s.headcount) || 1;
    e.owed = Math.round((e.owed + (Number(s.price) || 0)) * 100) / 100;
  }
  const payments = ((paymentRows ?? []) as DinerPayment[]).map((p) => ({
    ...p,
    amount: Number(p.amount) || 0,
  }));
  const paymentsByDiner: Record<string, DinerPayment[]> = {};
  for (const p of payments) {
    if (!p.diner_id) continue;
    const e = ensure(p.diner_id);
    if (p.kind === 'payment') e.paid = Math.round((e.paid + p.amount) * 100) / 100;
    else e.adjusted = Math.round((e.adjusted + p.amount) * 100) / 100;
    (paymentsByDiner[p.diner_id] ??= []).push(p);
  }
  const dinerStats: DinerStat[] = [...byDiner.values()]
    .map((e) => ({
      ...e,
      outstanding: Math.round((e.owed - e.paid - e.adjusted) * 100) / 100,
    }))
    .sort((a, b) => b.outstanding - a.outstanding || b.owed - a.owed);

  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  return (
    <AppShell title={t.statsTitle} eyebrow={t.manageEyebrow}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/meals/manage"
          className="inline-flex items-center gap-1.5 rounded-[12px] border border-cocm-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-cocm-ink transition-all hover:border-cocm-ink/30"
        >
          <span aria-hidden="true">←</span> {t.manageMeals}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/meals/stats?month=${fmt(prevMonth)}`}
            className="rounded-[10px] border border-cocm-ink/15 px-3 py-1.5 text-sm font-semibold text-cocm-ink transition hover:border-cocm-ink/30"
            aria-label="Previous month"
          >
            ‹
          </Link>
          <span className="min-w-[110px] text-center font-serif text-lg text-cocm-ink">
            {lang === 'zh' ? `${year}年${month}月` : `${period}`}
          </span>
          <Link
            href={`/meals/stats?month=${fmt(nextMonth)}`}
            className="rounded-[10px] border border-cocm-ink/15 px-3 py-1.5 text-sm font-semibold text-cocm-ink transition hover:border-cocm-ink/30"
            aria-label="Next month"
          >
            ›
          </Link>
        </div>
      </div>

      <StatsView
        days={dayStats}
        diners={dinerStats}
        paymentsByDiner={paymentsByDiner}
        period={period}
        t={t}
        tc={tc}
        lang={lang}
      />
    </AppShell>
  );
}
