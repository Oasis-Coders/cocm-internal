'use client';

import { useState, useTransition } from 'react';

import { toggleMealSignup } from '@/app/meals/actions';
import {
  formatMoney,
  isMealAvailable,
  priceForMeal,
  type MealDay,
  type MealSettings,
  type MealType,
  mealTypes,
} from '@/lib/meals';
import type { Lang } from '@/lib/i18n/translations';

type Labels = {
  breakfast: string;
  lunch: string;
  dinner: string;
  signedUp: string;
  notAvailable: string;
  perPerson: string;
};

type MealSignupListProps = {
  days: MealDay[];
  initialSigned: string[];
  settings: MealSettings;
  labels: Labels;
  lang: Lang;
};

function signupKey(date: string, type: MealType): string {
  return `${date}|${type}`;
}

export function MealSignupList({ days, initialSigned, settings, labels, lang }: MealSignupListProps) {
  const [signed, setSigned] = useState<Set<string>>(() => new Set(initialSigned));
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const mealLabel = (type: MealType) =>
    type === 'breakfast' ? labels.breakfast : type === 'lunch' ? labels.lunch : labels.dinner;

  const dateLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const locale = lang === 'zh' ? 'zh-CN' : 'en-GB';
    const datePart = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
    }).format(d);
    const weekdayPart = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
    return lang === 'zh' ? `${datePart} ${weekdayPart}` : `${weekdayPart}, ${datePart}`;
  };

  const handleToggle = (date: string, type: MealType) => {
    const key = signupKey(date, type);
    if (pending.has(key)) return;

    const wasSigned = signed.has(key);
    setSigned((prev) => {
      const next = new Set(prev);
      if (wasSigned) next.delete(key);
      else next.add(key);
      return next;
    });
    setPending((prev) => new Set(prev).add(key));

    startTransition(async () => {
      try {
        const result = await toggleMealSignup(date, type);
        if (!result.ok) {
          setSigned((prev) => {
            const next = new Set(prev);
            if (wasSigned) next.add(key);
            else next.delete(key);
            return next;
          });
        }
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <div
          key={day.meal_date}
          className="rounded-[20px] border border-cocm-ink/10 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover md:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-xl tracking-tight text-cocm-ink">{dateLabel(day.meal_date)}</h3>
            {day.note ? <p className="text-sm text-cocm-slate">{day.note}</p> : null}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
            {mealTypes.map((type) => {
              const available = isMealAvailable(day, type);
              const key = signupKey(day.meal_date, type);
              const isSigned = signed.has(key);
              const isBusy = pending.has(key) || isPending;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!available || isBusy}
                  onClick={() => handleToggle(day.meal_date, type)}
                  aria-pressed={isSigned}
                  className={[
                    'flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-[14px] border px-2 py-3 text-sm transition-all duration-200 active:scale-[0.97]',
                    !available
                      ? 'cursor-not-allowed border-cocm-ink/10 bg-cocm-paper text-cocm-slate/50'
                      : isSigned
                        ? 'border-cocm-red bg-cocm-red text-white shadow-red-glow'
                        : 'border-cocm-ink/15 bg-white text-cocm-ink hover:-translate-y-0.5 hover:border-cocm-red/60 hover:shadow-card-hover',
                  ].join(' ')}
                >
                  <span className="font-semibold tracking-[-0.01em]">{mealLabel(type)}</span>
                  <span className={isSigned ? 'text-white/90' : 'text-cocm-slate'}>
                    {formatMoney(priceForMeal(settings, type), settings.currency)}
                    <span className="text-xs">/{labels.perPerson}</span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${!available ? '' : isSigned ? 'text-white' : 'text-cocm-red'}`}
                  >
                    {!available ? labels.notAvailable : isSigned ? `✓ ${labels.signedUp}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
