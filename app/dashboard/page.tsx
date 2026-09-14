import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { DailyHeadcountCard } from '@/app/dashboard/daily-headcount-card';
import { getMealDayHeadcount } from '@/app/dashboard/actions';
import { getSession } from '@/lib/auth/session';
import { translations, type Lang } from '@/lib/i18n/translations';
import { todayIso } from '@/lib/meals';

export default async function DashboardPage() {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].dashboard;
  const mealsT = translations[lang].meals;

  const firstName = session.displayName || session.email;
  const isAdmin =
    session.isAuthenticated &&
    (session.role === 'admin' || session.role === 'super_admin');

  const today = todayIso();
  const headcount = isAdmin ? await getMealDayHeadcount(today) : null;

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

      {isAdmin && headcount && (
        <div className="mt-6">
          <DailyHeadcountCard
            lang={lang}
            initialDate={today}
            initial={headcount}
            labels={{
              title: t.dailyTitle,
              pickDate: t.pickDate,
              total: t.total,
              people: t.people,
              noMeals: t.noMeals,
              notServed: mealsT.notAvailable,
              breakfast: mealsT.breakfast,
              lunch: mealsT.lunch,
              dinner: mealsT.dinner,
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
