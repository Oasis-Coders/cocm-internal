import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import {
  currentYearMonth,
  formatMoney,
  monthBounds,
  type MealDay,
  type MealSettings,
  type MealType,
  mealTypes,
} from '@/lib/meals';
import {
  updateMealPrices,
  updateTransferInfo,
} from '@/app/meals/manage/actions';
import { MealCalendar } from '@/app/meals/manage/meal-calendar';

type ManagePageProps = {
  searchParams: Promise<{ month?: string; saved?: string; error?: string }>;
};

type StatsRow = {
  userId: string;
  name: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
};

function parseMonthParam(value: string | undefined): { year: number; month: number } {
  const fallback = currentYearMonth();
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;
  return { year, month };
}

export default async function ManageMealsPage({ searchParams }: ManagePageProps) {
  const session = await getSession();
  if (!session.isAuthenticated || (session.role !== 'admin' && session.role !== 'super_admin')) {
    redirect('/meals');
  }

  const params = await searchParams;
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].meals;
  const tc = translations[lang].common;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <AppShell title={t.manageTitle} eyebrow={t.manageEyebrow}>
        <EmptyState title={t.manageTitle} description={translations[lang].auth.supabaseUnavailable} />
      </AppShell>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  const { start, end } = monthBounds(year, month);
  const monthParam = `${year}-${String(month).padStart(2, '0')}`;

  const [{ data: settingsRow }, { data: dayRows }, { data: statRows }] = await Promise.all([
    supabase.from('meal_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('meal_days')
      .select('meal_date, breakfast_available, lunch_available, dinner_available, note')
      .order('meal_date', { ascending: true })
      .limit(500),
    supabase
      .from('meal_signups')
      .select('meal_type, price, user_id')
      .gte('meal_date', start)
      .lt('meal_date', end),
  ]);

  // Per-day signup counts for the calendar (±6 months around today).
  const nowD = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const startOffset = nowD.getMonth() - 5; // first day of month, 5 months back
  const calStartD = new Date(nowD.getFullYear(), startOffset, 1);
  const calEndD = new Date(nowD.getFullYear(), nowD.getMonth() + 7, 0); // last day, 6 months ahead
  const calStartIso = `${calStartD.getFullYear()}-${pad2(calStartD.getMonth() + 1)}-01`;
  const calEndIso = `${calEndD.getFullYear()}-${pad2(calEndD.getMonth() + 1)}-${pad2(calEndD.getDate())}`;
  const { data: signupDateRows } = await supabase
    .from('meal_signups')
    .select('meal_date')
    .gte('meal_date', calStartIso)
    .lte('meal_date', calEndIso);
  const signupCounts: Record<string, number> = {};
  for (const r of (signupDateRows ?? []) as Array<{ meal_date: string }>) {
    signupCounts[r.meal_date] = (signupCounts[r.meal_date] ?? 0) + 1;
  }

  // meal_signups.user_id references auth.users, so join profiles separately.
  const signupUserIds = [...new Set(((statRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))];
  let statProfiles: Array<{ id: string; display_name: string | null; email: string | null }> = [];
  if (signupUserIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', signupUserIds);
    statProfiles = (data ?? []) as typeof statProfiles;
  }
  const profileById = new Map(statProfiles.map((p) => [p.id, p]));

  const settings: MealSettings = {
    breakfast_price: Number(settingsRow?.breakfast_price ?? 0),
    lunch_price: Number(settingsRow?.lunch_price ?? 0),
    dinner_price: Number(settingsRow?.dinner_price ?? 0),
    currency: (settingsRow?.currency as string) ?? 'GBP',
    transfer_info: (settingsRow?.transfer_info as string) ?? '',
  };
  const days = (dayRows ?? []) as MealDay[];

  const statsByUser = new Map<string, StatsRow>();
  const statList = (statRows ?? []) as unknown as Array<{
    meal_type: MealType;
    price: number | string;
    user_id: string;
  }>;
  for (const row of statList) {
    const profile = profileById.get(row.user_id);
    const name = profile?.display_name || profile?.email || row.user_id.slice(0, 8);
    let entry = statsByUser.get(row.user_id);
    if (!entry) {
      entry = { userId: row.user_id, name, breakfast: 0, lunch: 0, dinner: 0, total: 0 };
      statsByUser.set(row.user_id, entry);
    }
    const price = Number(row.price) || 0;
    if (row.meal_type === 'breakfast') entry.breakfast += 1;
    else if (row.meal_type === 'lunch') entry.lunch += 1;
    else entry.dinner += 1;
    entry.total += price;
  }
  const stats = [...statsByUser.values()].sort((a, b) => b.total - a.total);
  const statsTotal = stats.reduce((sum, s) => sum + s.total, 0);

  const mealLabel = (type: MealType) =>
    type === 'breakfast' ? t.breakfast : type === 'lunch' ? t.lunch : t.dinner;

  const inputClass =
    'rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3 py-2 text-sm text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-red focus:ring-2 focus:ring-cocm-red/20';

  return (
    <AppShell title={t.manageTitle} eyebrow={t.manageEyebrow}>
      <div className="mb-4">
        <Link href="/meals" className="text-sm font-semibold text-cocm-red hover:underline">
          ← {t.backToMeals}
        </Link>
      </div>

      {params.saved ? (
        <p className="mb-4 rounded-xl border border-green-600/20 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t.saved}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          action={updateMealPrices}
          className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6"
        >
          <h3 className="font-serif text-xl text-cocm-ink">{t.pricesTitle}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{t.pricesDesc}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {mealTypes.map((type) => (
              <label key={type} className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-cocm-ink">{mealLabel(type)}</span>
                <input
                  type="number"
                  name={type}
                  min="0"
                  step="0.01"
                  required
                  defaultValue={(
                    type === 'breakfast'
                      ? settings.breakfast_price
                      : type === 'lunch'
                        ? settings.lunch_price
                        : settings.dinner_price
                  ).toFixed(2)}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="mt-4 rounded-[12px] bg-cocm-red px-5 py-2.5 text-sm font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98]"
          >
            {tc.save}
          </button>
        </form>

        <form
          action={updateTransferInfo}
          className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6"
        >
          <h3 className="font-serif text-xl text-cocm-ink">{t.transferEditTitle}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{t.transferEditDesc}</p>
          <textarea
            name="transferInfo"
            rows={5}
            defaultValue={settings.transfer_info}
            placeholder={t.transferPlaceholder}
            className={`mt-4 w-full ${inputClass}`}
          />
          <button
            type="submit"
            className="mt-4 rounded-[12px] bg-cocm-red px-5 py-2.5 text-sm font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98]"
          >
            {tc.save}
          </button>
        </form>
      </div>

      <div className="mt-4">
        <MealCalendar
          days={days}
          signupCounts={signupCounts}
          t={t}
          tc={tc}
          lang={lang}
        />
      </div>

      <div className="mt-4 rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-cocm-ink">{t.statsTitle}</h3>
            <p className="mt-1 text-sm text-cocm-slate">{t.statsDesc}</p>
          </div>
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="month" className="text-sm font-semibold text-cocm-ink">
              {t.month}
            </label>
            <input
              id="month"
              type="month"
              name="month"
              defaultValue={monthParam}
              className={inputClass}
            />
            <button
              type="submit"
              className="rounded-[12px] bg-cocm-ink px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-cocm-ink-light active:scale-[0.98]"
            >
              {tc.confirm}
            </button>
          </form>
        </div>

        {stats.length === 0 ? (
          <p className="mt-4 text-sm text-cocm-slate">{t.noSignups}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-cocm-ink/10 text-xs uppercase tracking-[0.15em] text-cocm-slate">
                  <th className="px-4 py-3 font-semibold">{t.name}</th>
                  <th className="px-4 py-3 font-semibold">{t.breakfast}</th>
                  <th className="px-4 py-3 font-semibold">{t.lunch}</th>
                  <th className="px-4 py-3 font-semibold">{t.dinner}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.userId} className="border-b border-cocm-ink/5 transition-colors last:border-0 hover:bg-cocm-ink/[0.02]">
                    <td className="px-4 py-3 font-semibold text-cocm-ink">{row.name}</td>
                    <td className="px-4 py-3 text-cocm-slate">{row.breakfast}</td>
                    <td className="px-4 py-3 text-cocm-slate">{row.lunch}</td>
                    <td className="px-4 py-3 text-cocm-slate">{row.dinner}</td>
                    <td className="px-4 py-3 text-right font-semibold text-cocm-ink">
                      {formatMoney(row.total, settings.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-cocm-ink/[0.03] font-semibold">
                  <td className="px-4 py-3 text-cocm-ink" colSpan={4}>
                    {tc.total}
                  </td>
                  <td className="px-4 py-3 text-right font-serif text-base text-cocm-ink">
                    {formatMoney(statsTotal, settings.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
