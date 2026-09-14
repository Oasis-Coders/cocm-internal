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
  addMealDay,
  deleteMealDay,
  toggleMealAvailability,
  updateMealPrices,
  updateTransferInfo,
} from '@/app/meals/manage/actions';
import { DeleteDayButton } from '@/app/meals/manage/delete-day-button';

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
      .order('meal_date', { ascending: false })
      .limit(120),
    supabase
      .from('meal_signups')
      .select('meal_type, price, user_id')
      .gte('meal_date', start)
      .lt('meal_date', end),
  ]);

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

      <div className="mt-4 rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
        <h3 className="font-serif text-xl text-cocm-ink">{t.daysTitle}</h3>
        <p className="mt-1 text-sm text-cocm-slate">{t.daysDesc}</p>

        <form action={addMealDay} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cocm-ink">{t.date}</span>
            <input type="date" name="date" required className={inputClass} />
          </label>
          {mealTypes.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-cocm-ink">
              <input type="checkbox" name={type} defaultChecked className="h-4 w-4 accent-cocm-red" />
              {mealLabel(type)}
            </label>
          ))}
          <input
            type="text"
            name="note"
            placeholder={t.notePlaceholder}
            maxLength={200}
            className={`${inputClass} min-w-[180px] flex-1`}
            aria-label={t.note}
          />
          <button
            type="submit"
            className="rounded-[12px] bg-cocm-ink px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cocm-ink-light active:scale-[0.98]"
          >
            {t.addDay}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          {days.length === 0 ? (
            <p className="text-sm text-cocm-slate">{t.noUpcoming}</p>
          ) : (
            days.map((day) => (
              <div
                key={day.meal_date}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cocm-ink/10 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-cocm-ink">{day.meal_date}</p>
                  {day.note ? <p className="text-sm text-cocm-slate">{day.note}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {mealTypes.map((type) => {
                    const available =
                      type === 'breakfast'
                        ? day.breakfast_available
                        : type === 'lunch'
                          ? day.lunch_available
                          : day.dinner_available;
                    return (
                      <form key={type} action={toggleMealAvailability.bind(null, day.meal_date, type)}>
                        <button
                          type="submit"
                          aria-pressed={available}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                            available
                              ? 'bg-cocm-red/10 text-cocm-red'
                              : 'bg-cocm-ink/5 text-cocm-slate line-through'
                          }`}
                        >
                          {mealLabel(type)}
                        </button>
                      </form>
                    );
                  })}
                  <DeleteDayButton
                    date={day.meal_date}
                    label={t.deleteDay}
                    confirmMessage={t.confirmDeleteDay}
                    action={deleteMealDay.bind(null, day.meal_date)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
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
