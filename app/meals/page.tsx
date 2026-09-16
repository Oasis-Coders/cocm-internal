import { cookies } from 'next/headers';
import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import {
  addDaysIso,
  currentYearMonth,
  defaultMealDay,
  defaultMealSettings,
  formatMoney,
  monthBounds,
  todayIso,
  type MealDay,
  type MealDiner,
  type MealSettings,
  type MealSignup,
} from '@/lib/meals';
import { MealSignupCalendar } from '@/app/meals/meal-signup-calendar';
import { MyBookings } from '@/app/meals/my-bookings';

type PageData = {
  settings: MealSettings;
  days: MealDay[];
  diners: MealDiner[];
  signups: MealSignup[];
  mySignups: MealSignup[];
  recentDiners: MealDiner[];
  paidThisMonth: number;
  ready: boolean;
};

async function loadPageData(userId: string): Promise<PageData> {
  const fallback: PageData = {
    settings: defaultMealSettings,
    days: [],
    diners: [],
    signups: [],
    mySignups: [],
    recentDiners: [],
    paidThisMonth: 0,
    ready: false,
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallback;

  try {
    const { year, month } = currentYearMonth();
    const { start, end } = monthBounds(year, month);
    const today = todayIso();
    const period = `${year}-${String(month).padStart(2, '0')}`;

    const [
      { data: settingsRow },
      { data: dayRows },
      { data: dinerRows },
      { data: signupRows },
      { data: mySignupRows },
      { data: myDinerRows },
      { data: recentContactRows },
    ] = await Promise.all([
      supabase.from('meal_settings').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('meal_days')
        .select(
          'meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day, note'
        )
        .gte('meal_date', today)
        .order('meal_date', { ascending: true })
        .limit(120),
      supabase
        .from('meal_diners')
        .select('id, name, identity, allergens, is_active, user_id')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(2000),
      supabase
        .from('meal_signups')
        .select(
          'id, meal_date, meal_type, price, diner_id, display_name, identity, headcount, booked_by, user_id'
        )
        .gte('meal_date', today)
        .order('meal_date', { ascending: true })
        .limit(5000),
      supabase
        .from('meal_signups')
        .select(
          'id, meal_date, meal_type, price, diner_id, display_name, identity, headcount, booked_by, user_id'
        )
        .or(`booked_by.eq.${userId},user_id.eq.${userId}`)
        .gte('meal_date', start)
        .lt('meal_date', end)
        .order('meal_date', { ascending: true }),
      supabase.from('meal_diners').select('id').eq('user_id', userId),
      // Names this account has booked before (for one-tap re-booking of guests).
      // meal_diner_contacts persists across booking cancellations.
      supabase
        .from('meal_diner_contacts')
        .select('diner_id, last_booked_at')
        .eq('user_id', userId)
        .order('last_booked_at', { ascending: false })
        .limit(8),
    ]);

    if (!dayRows || !dinerRows || !signupRows) return fallback;

    // Most-recently booked diners for this account, excluding their own linked
    // diner — these become the "names I've booked" quick chips. Contacts are
    // already unique per account+diner, ordered by most recent booking.
    const dinerById = new Map(((dinerRows ?? []) as MealDiner[]).map((d) => [d.id, d]));
    const recentDiners: MealDiner[] = [];
    for (const row of (recentContactRows ?? []) as Array<{ diner_id: string | null }>) {
      const d = row.diner_id ? dinerById.get(row.diner_id) : undefined;
      // dinerRows only carries active diners, so deactivated entries drop out.
      if (d && d.user_id !== userId) recentDiners.push(d);
      if (recentDiners.length >= 8) break;
    }

    const myDinerIds = ((myDinerRows ?? []) as Array<{ id: string }>).map((r) => r.id);
    let paidRows: Array<{ amount: number | string }> = [];
    if (myDinerIds.length > 0) {
      const { data } = await supabase
        .from('meal_payments')
        .select('amount')
        .eq('period', period)
        .or(`user_id.eq.${userId},diner_id.in.(${myDinerIds.join(',')})`);
      paidRows = (data ?? []) as Array<{ amount: number | string }>;
    } else {
      const { data } = await supabase
        .from('meal_payments')
        .select('amount')
        .eq('user_id', userId)
        .eq('period', period);
      paidRows = (data ?? []) as Array<{ amount: number | string }>;
    }

    // Explicit admin rows win; weekdays without a row fall back to the
    // default (Mon–Fri lunch bookable). Covers the same ~120-day window
    // the calendar query loads.
    const paidThisMonth = paidRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const dayMap = new Map<string, MealDay>();
    for (const d of dayRows as MealDay[]) dayMap.set(d.meal_date, d);
    for (let i = 0; i < 120; i++) {
      const iso = addDaysIso(today, i);
      if (!dayMap.has(iso)) {
        const v = defaultMealDay(iso);
        if (v) dayMap.set(iso, v);
      }
    }
    const days = [...dayMap.values()].sort((a, b) => (a.meal_date < b.meal_date ? -1 : 1));

    return {
      settings: {
        breakfast_price: Number(settingsRow?.breakfast_price ?? 0),
        lunch_price: Number(settingsRow?.lunch_price ?? 0),
        dinner_price: Number(settingsRow?.dinner_price ?? 0),
        price_staff: Number(settingsRow?.price_staff ?? 3),
        price_other: Number(settingsRow?.price_other ?? 5),
        currency: (settingsRow?.currency as string) ?? 'GBP',
        transfer_info: (settingsRow?.transfer_info as string) ?? '',
      },
      days,
      diners: (dinerRows ?? []) as MealDiner[],
      signups: (signupRows as MealSignup[]).map((s) => ({
        ...s,
        price: Number(s.price) || 0,
        headcount: Number(s.headcount) || 1,
      })),
      mySignups: ((mySignupRows ?? []) as MealSignup[]).map((s) => ({
        ...s,
        price: Number(s.price) || 0,
        headcount: Number(s.headcount) || 1,
      })),
      recentDiners,
      paidThisMonth: Math.round(paidThisMonth * 100) / 100,
      ready: true,
    };
  } catch {
    return fallback;
  }
}

export default async function MealsPage() {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].meals;

  if (!session.isAuthenticated || !session.userId) {
    return (
      <AppShell title={t.title} eyebrow={t.eyebrow}>
        <EmptyState title={t.title} description={translations[lang].auth.supabaseUnavailable} />
      </AppShell>
    );
  }

  const data = await loadPageData(session.userId);

  const monthOwed = data.mySignups.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const monthOutstanding = Math.round((monthOwed - data.paidThisMonth) * 100) / 100;
  const monthHeadcount = data.mySignups.reduce((sum, s) => sum + (Number(s.headcount) || 1), 0);
  const isAdmin = session.role === 'admin' || session.role === 'super_admin';

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      {!data.ready ? (
        <EmptyState title={t.notReadyTitle} description={t.notReadyDesc} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-[20px] bg-cocm-ink p-5 text-white shadow-card md:p-6">
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-cocm-red/25 blur-[28px]" />
                <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-[#3f43a8] blur-[24px]" />
              </div>
              <div className="relative">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  <span className="h-1 w-1 rounded-full bg-cocm-red" aria-hidden="true" />
                  {t.monthTotal}
                </p>
                <p className="mt-2 font-serif text-4xl tracking-tight text-white md:text-5xl">
                  {formatMoney(monthOutstanding, data.settings.currency)}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {t.outstanding} · {monthHeadcount} {t.count}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {t.owed} {formatMoney(monthOwed, data.settings.currency)} · {t.paid}{' '}
                  {formatMoney(data.paidThisMonth, data.settings.currency)}
                </p>
              </div>
            </div>
            <div className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cocm-slate">
                <span className="h-1 w-1 rounded-full bg-cocm-red" aria-hidden="true" />
                {t.transferTitle}
              </p>
              {data.settings.transfer_info ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-cocm-ink">
                  {data.settings.transfer_info}
                </p>
              ) : (
                <p className="mt-2 text-sm text-cocm-slate">{t.transferEmpty}</p>
              )}
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href="/meals/stats"
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-cocm-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-cocm-ink transition-all hover:border-cocm-ink/30"
              >
                {t.statsTitle}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/meals/manage"
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-cocm-red px-4 py-2.5 text-sm font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark"
              >
                {t.manageMeals}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : null}

          <div className="mt-8">
            <MealSignupCalendar
              days={data.days}
              diners={data.diners}
              signups={data.signups}
              recentDiners={data.recentDiners}
              myUserId={session.userId}
              prices={{
                price_staff: data.settings.price_staff,
                price_other: data.settings.price_other,
              }}
              t={t}
              lang={lang}
            />
          </div>

          <div className="mt-8">
            <MyBookings
              signups={data.mySignups}
              currency={data.settings.currency}
              t={t}
              lang={lang}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
