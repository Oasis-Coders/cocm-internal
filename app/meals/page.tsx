import { cookies } from 'next/headers';
import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import {
  currentYearMonth,
  defaultMealSettings,
  formatMoney,
  monthBounds,
  todayIso,
  type MealDay,
  type MealSettings,
  type MealSignup,
} from '@/lib/meals';
import { MealSignupList } from '@/app/meals/meal-signup-list';

type PageData = {
  settings: MealSettings;
  days: MealDay[];
  signups: MealSignup[];
  paidThisMonth: number;
  ready: boolean;
};

async function loadPageData(userId: string): Promise<PageData> {
  const fallback: PageData = {
    settings: defaultMealSettings,
    days: [],
    signups: [],
    paidThisMonth: 0,
    ready: false,
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallback;

  try {
    const { year, month } = currentYearMonth();
    const { start } = monthBounds(year, month);
    const today = todayIso();

    const period = `${year}-${String(month).padStart(2, '0')}`;
    const [{ data: settingsRow }, { data: dayRows }, { data: signupRows }, { data: paymentRows }] = await Promise.all([
      supabase.from('meal_settings').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('meal_days')
        .select('meal_date, breakfast_available, lunch_available, dinner_available, note')
        .gte('meal_date', today)
        .order('meal_date', { ascending: true })
        .limit(90),
      supabase
        .from('meal_signups')
        .select('meal_date, meal_type, price')
        .eq('user_id', userId)
        .gte('meal_date', start)
        .order('meal_date', { ascending: true }),
      supabase
        .from('meal_payments')
        .select('amount')
        .eq('user_id', userId)
        .eq('period', period),
    ]);

    if (!dayRows || !signupRows) return fallback;

    const paidThisMonth = ((paymentRows ?? []) as Array<{ amount: number | string }>).reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    );

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
      days: dayRows as MealDay[],
      signups: (signupRows as MealSignup[]).map((s) => ({
        ...s,
        price: Number(s.price) || 0,
      })),
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
  const { year, month } = currentYearMonth();
  const { start, end } = monthBounds(year, month);

  const monthSignups = data.signups.filter((s) => s.meal_date >= start && s.meal_date < end);
  const monthTotal = monthSignups.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const monthOutstanding = Math.round((monthTotal - data.paidThisMonth) * 100) / 100;
  const signedKeys = data.signups.map((s) => `${s.meal_date}|${s.meal_type}`);
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
                  {t.outstanding} · {monthSignups.length} {t.count}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {t.owed} {formatMoney(monthTotal, data.settings.currency)} · {t.paid}{' '}
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
            <div className="mt-4 flex justify-end">
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
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-serif text-2xl tracking-tight text-cocm-ink">{t.upcomingTitle}</h3>
              <p className="text-sm text-cocm-slate">{t.tapToToggle}</p>
            </div>
            {data.days.length === 0 ? (
              <EmptyState title={t.upcomingTitle} description={t.noUpcoming} />
            ) : (
              <MealSignupList
                days={data.days}
                initialSigned={signedKeys}
                settings={data.settings}
                labels={{
                  breakfast: t.breakfast,
                  lunch: t.lunch,
                  dinner: t.dinner,
                  signedUp: t.signedUp,
                  notAvailable: t.notAvailable,
                  perPerson: t.perPerson,
                }}
                lang={lang}
              />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
