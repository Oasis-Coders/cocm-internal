'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cancelMealSignup } from '@/app/meals/actions';
import { formatMoney, type MealSignup } from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';

type MealsT = (typeof translations)[Lang]['meals'];

type Props = {
  signups: MealSignup[];
  currency: string;
  t: MealsT;
  lang: Lang;
};

function formatDay(dateStr: string, lang: Lang) {
  const [, m, d] = dateStr.split('-').map(Number);
  if (lang === 'zh') return `${m}月${d}日`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

export function MyBookings({ signups, currency, t, lang }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const mealLabel = (type: string) =>
    type === 'breakfast' ? t.breakfast : type === 'lunch' ? t.lunch : t.dinner;

  const cancel = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      await cancelMealSignup(id);
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <h3 className="font-serif text-xl text-cocm-ink">{t.myBookingsTitle}</h3>
      {signups.length === 0 ? (
        <p className="mt-2 text-sm text-cocm-slate">{t.noMyBookings}</p>
      ) : (
        <ul className="mt-3 divide-y divide-cocm-ink/[0.06]">
          {signups.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-cocm-ink">
                  {formatDay(s.meal_date, lang)} · {mealLabel(s.meal_type)}
                </p>
                <p className="mt-0.5 text-[13px] text-cocm-slate">
                  {s.display_name ?? '—'}
                  {(Number(s.headcount) || 1) > 1 ? ` ×${s.headcount}` : ''}
                  {' · '}
                  {formatMoney(Number(s.price) || 0, currency)}
                </p>
              </div>
              <button
                type="button"
                disabled={pendingId === s.id}
                onClick={() => cancel(s.id)}
                className="shrink-0 rounded-[10px] border border-cocm-ink/15 px-3 py-1.5 text-[13px] font-semibold text-cocm-slate transition hover:border-cocm-red/40 hover:text-cocm-red active:scale-[0.97] disabled:opacity-50"
              >
                {pendingId === s.id ? '…' : t.cancelBooking}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
