'use client';

import { useState } from 'react';

import { getMealDayHeadcount, type DayHeadcount } from '@/app/dashboard/actions';
import { mealTypes, type MealType } from '@/lib/meals';
import type { Lang } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

type Props = {
  lang: Lang;
  initialDate: string;
  initial: DayHeadcount;
  labels: {
    title: string;
    pickDate: string;
    total: string;
    people: string;
    noMeals: string;
    notServed: string;
    breakfast: string;
    lunch: string;
    dinner: string;
  };
};

const mealLabelKey: Record<MealType, 'breakfast' | 'lunch' | 'dinner'> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
};

function weekdayLabel(dateIso: string, lang: Lang): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const zh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return lang !== 'en' ? zh[d.getDay()] : en[d.getDay()];
}

export function DailyHeadcountCard({ lang, initialDate, initial, labels }: Props) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<DayHeadcount>(initial);
  const [loading, setLoading] = useState(false);

  const onPick = async (value: string) => {
    setDate(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setLoading(true);
    try {
      const res = await getMealDayHeadcount(value);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  const available = data.available;

  return (
    <section className="rounded-[20px] border border-cocm-ink/5 bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold tracking-tight text-cocm-ink">
          {labels.title}
          <span className="ml-2 align-middle text-[12px] font-medium text-cocm-slate/70">
            {date} · {weekdayLabel(date, lang)}
          </span>
        </h3>
        <label className="flex items-center gap-2 text-[13px] text-cocm-slate">
          <span>{labels.pickDate}</span>
          <input
            type="date"
            value={date}
            max="2100-12-31"
            onChange={(e) => onPick(e.target.value)}
            className="rounded-[10px] border border-cocm-ink/15 bg-white px-2.5 py-1.5 text-[13px] text-cocm-ink outline-none focus:border-cocm-blue"
          />
        </label>
      </div>

      <div className={cn('mt-4', loading && 'pointer-events-none opacity-50')}>
        {available === null ? (
          <p className="rounded-[12px] bg-cocm-ink/[0.03] px-4 py-6 text-center text-[13px] text-cocm-slate/70">
            {labels.noMeals}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {mealTypes.map((t) => {
                const served = available.includes(t);
                return (
                  <div
                    key={t}
                    className={cn(
                      'rounded-[14px] border px-4 py-4 text-center',
                      served
                        ? 'border-cocm-ink/10 bg-cocm-ink/[0.02]'
                        : 'border-dashed border-cocm-ink/10 bg-transparent opacity-50'
                    )}
                  >
                    <p className="text-[12px] font-medium text-cocm-slate">
                      {labels[mealLabelKey[t]]}
                    </p>
                    <p className="mt-1 font-serif text-[32px] leading-none text-cocm-ink">
                      {served ? data.counts[t] : '–'}
                    </p>
                    <p className="mt-1 text-[11px] text-cocm-slate/60">
                      {served ? labels.people : labels.notServed}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[12px] bg-cocm-ink px-4 py-3 text-white">
              <span className="text-[13px] font-medium text-white/80">{labels.total}</span>
              <span className="font-serif text-[22px] leading-none">
                {data.total}
                <span className="ml-1 font-sans text-[12px] text-white/60">{labels.people}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
