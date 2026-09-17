'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { markCampDay, unmarkCampDay } from '@/app/meals/manage/actions';
import type { CampDayOverview } from '@/lib/meals/camp';
import type { translations, Lang } from '@/lib/i18n/translations';
import type { MealType } from '@/lib/meals';

type MealsT =
  | (typeof translations)['en']['meals']
  | (typeof translations)['zh']['meals']
  | (typeof translations)['zh-Hant']['meals'];

function formatDay(dateStr: string, lang: Lang): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (lang !== 'en') {
    const wds = ['日', '一', '二', '三', '四', '五', '六'];
    return `${m}月${d}日 周${wds[dt.getDay()]}`;
  }
  const wds = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${wds[dt.getDay()]}, ${months[m - 1]} ${d}`;
}

const mealDotColor: Record<MealType, string> = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-cocm-red',
  dinner: 'bg-cocm-blue',
};

function MarkCampDayForm({ t }: { t: MealsT }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        setMsg(null);
        startTransition(async () => {
          const res = await markCampDay(date);
          if (res.ok) {
            setMsg(t.campDayMarked);
            setDate('');
            router.refresh();
          } else {
            setMsg(t.actionFailed);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-cocm-ink">{t.date}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="h-11 rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 text-[15px] text-cocm-ink outline-none focus:border-cocm-blue"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || !date}
        className="h-11 rounded-[12px] bg-cocm-red px-5 text-[15px] font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.99] disabled:opacity-60"
      >
        {isPending ? '…' : t.markCampDay}
      </button>
      {msg ? <p className="w-full text-[13px] text-cocm-slate">{msg}</p> : null}
      <p className="w-full text-[12px] leading-relaxed text-cocm-slate/80">{t.campDayHint}</p>
    </form>
  );
}

function DayCard({
  day,
  t,
  lang,
  allowUnmark,
  compact,
}: {
  day: CampDayOverview;
  t: MealsT;
  lang: Lang;
  allowUnmark: boolean;
  compact: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(!compact);
  const mealLabel = (mt: MealType) =>
    mt === 'breakfast' ? t.breakfast : mt === 'lunch' ? t.lunch : t.dinner;

  return (
    <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
          <p className="font-serif text-lg text-cocm-ink">{formatDay(day.meal_date, lang)}</p>
          <p className="mt-0.5 text-[13px] text-cocm-slate">
            {day.meals.map((m) => `${mealLabel(m.meal_type)} ${m.time}`).join(' · ') || '—'}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-cocm-red/10 px-2.5 py-1 text-[12px] font-bold text-cocm-red">
            {t.headcountPeople.replace('{n}', String(day.totalDiners))}
          </span>
          {allowUnmark ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await unmarkCampDay(day.meal_date);
                  if (res.ok) router.refresh();
                })
              }
              className="rounded-[10px] border border-cocm-ink/15 px-2.5 py-1 text-[12px] font-semibold text-cocm-slate transition hover:border-cocm-ink/30 hover:text-cocm-ink disabled:opacity-60"
            >
              {isPending ? '…' : t.unmarkCampDay}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-2.5 border-t border-cocm-ink/10 pt-3">
          {day.meals.map((m) => (
            <div key={m.meal_type} className="rounded-[12px] bg-cocm-ink/[0.03] p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-cocm-ink">
                  <span className={`h-2 w-2 rounded-full ${mealDotColor[m.meal_type]}`} />
                  {mealLabel(m.meal_type)}
                  <span className="font-normal text-cocm-slate">{m.time}</span>
                </p>
                <span className="text-[13px] font-semibold text-cocm-slate">
                  {t.headcountPeople.replace('{n}', String(m.headcount))}
                </span>
              </div>
              {m.diners.length > 0 ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-cocm-slate">
                  {t.attendeeList}：
                  {m.diners
                    .map((d) => `${d.name}${d.headcount > 1 ? `×${d.headcount}` : ''}`)
                    .join('、')}
                </p>
              ) : null}
            </div>
          ))}

          <div
            className={`rounded-[12px] p-3 ${
              day.allergens.length > 0
                ? 'border border-amber-500/30 bg-amber-50'
                : 'bg-cocm-ink/[0.03]'
            }`}
          >
            <p className="text-sm font-semibold text-cocm-ink">⚠️ {t.allergensTitle}</p>
            {day.allergens.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {day.allergens.map((a, i) => (
                  <li key={i} className="text-[13px] text-cocm-ink">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-cocm-slate">：{a.allergen}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-cocm-slate">{t.noAllergens}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CampOverview({
  days,
  t,
  lang,
  showControls = false,
  compact = false,
  title,
  desc,
}: {
  days: CampDayOverview[];
  t: MealsT;
  lang: Lang;
  showControls?: boolean;
  compact?: boolean;
  title: string;
  desc: string;
}) {
  return (
    <section className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-cocm-ink">⛺ {title}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{desc}</p>
        </div>
      </div>

      {showControls ? (
        <div className="mt-4 border-b border-cocm-ink/10 pb-4">
          <MarkCampDayForm t={t} />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-cocm-slate">{t.campDaysEmpty}</p>
        ) : (
          days.map((day) => (
            <DayCard
              key={day.meal_date}
              day={day}
              t={t}
              lang={lang}
              allowUnmark={showControls}
              compact={compact}
            />
          ))
        )}
      </div>
    </section>
  );
}
