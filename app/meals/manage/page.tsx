import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';
import {
  addDaysIso,
  defaultMealDay,
  todayIso,
  type MealDay,
  type MealDiner,
  type MealSettings,
} from '@/lib/meals';
import {
  addDiner,
  setDinerActive,
  updateMealPrices,
  updateTransferInfo,
} from '@/app/meals/manage/actions';
import { MealCalendar } from '@/app/meals/manage/meal-calendar';
import { RosterManager } from '@/app/meals/manage/roster-manager';

type ManagePageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

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

  const [{ data: settingsRow }, { data: dayRows }, { data: dinerRows }] = await Promise.all([
    supabase.from('meal_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('meal_days')
      .select('meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day, note')
      .order('meal_date', { ascending: true })
      .limit(500),
    supabase
      .from('meal_diners')
      .select('id, name, identity, allergens, is_active, user_id')
      .order('name', { ascending: true })
      .limit(2000),
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
    .select('meal_date, headcount')
    .gte('meal_date', calStartIso)
    .lte('meal_date', calEndIso);
  const signupCounts: Record<string, number> = {};
  for (const r of (signupDateRows ?? []) as Array<{ meal_date: string; headcount: number | null }>) {
    signupCounts[r.meal_date] = (signupCounts[r.meal_date] ?? 0) + (Number(r.headcount) || 1);
  }

  const settings: MealSettings = {
    breakfast_price: Number(settingsRow?.breakfast_price ?? 0),
    lunch_price: Number(settingsRow?.lunch_price ?? 0),
    dinner_price: Number(settingsRow?.dinner_price ?? 0),
    price_staff: Number(settingsRow?.price_staff ?? 3),
    price_other: Number(settingsRow?.price_other ?? 5),
    currency: (settingsRow?.currency as string) ?? 'GBP',
    transfer_info: (settingsRow?.transfer_info as string) ?? '',
  };
  // Merge the Mon–Fri lunch default so the admin sees effective
  // availability and can override any day. Explicit rows win.
  const dayMap = new Map<string, MealDay>();
  for (const d of ((dayRows ?? []) as MealDay[])) dayMap.set(d.meal_date, d);
  const defaultDates: string[] = [];
  const todayStr = todayIso();
  for (let i = 0; i < 180; i++) {
    const iso = addDaysIso(todayStr, i);
    if (!dayMap.has(iso)) {
      const v = defaultMealDay(iso);
      if (v) {
        dayMap.set(iso, v);
        defaultDates.push(iso);
      }
    }
  }
  const days = [...dayMap.values()].sort((a, b) =>
    a.meal_date < b.meal_date ? -1 : 1
  );
  const diners = (dinerRows ?? []) as MealDiner[];

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
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="font-semibold text-cocm-ink">{t.priceStaff}</span>
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-cocm-slate"
                >
                  £
                </span>
                <input
                  type="number"
                  name="price_staff"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={settings.price_staff.toFixed(2)}
                  className={`${inputClass} w-full min-w-0 pl-8`}
                />
              </span>
              <span className="text-xs text-cocm-slate">{t.priceStaffHint}</span>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="font-semibold text-cocm-ink">{t.priceOther}</span>
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-cocm-slate"
                >
                  £
                </span>
                <input
                  type="number"
                  name="price_other"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={settings.price_other.toFixed(2)}
                  className={`${inputClass} w-full min-w-0 pl-8`}
                />
              </span>
              <span className="text-xs text-cocm-slate">{t.priceOtherHint}</span>
            </label>
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
          defaultDates={defaultDates}
          signupCounts={signupCounts}
          t={t}
          tc={tc}
          lang={lang}
        />
      </div>

      <RosterManager
        diners={diners}
        t={t}
        tc={tc}
        lang={lang}
        inputClass={inputClass}
      />

      <div className="mt-4 rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-cocm-ink">{t.statsTitle}</h3>
            <p className="mt-1 text-sm text-cocm-slate">{t.statsDesc}</p>
          </div>
          <Link
            href="/meals/stats"
            className="inline-flex items-center gap-1.5 rounded-[12px] bg-cocm-red px-5 py-2.5 text-sm font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark"
          >
            {t.statsTitle}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
