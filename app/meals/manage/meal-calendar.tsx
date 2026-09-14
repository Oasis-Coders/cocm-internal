'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  removeMealDay,
  removeMealDayRange,
  saveMealDay,
  saveMealDayRange,
} from '@/app/meals/manage/actions';
import { mealTypes, type MealDay, type MealType } from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';

type MealsT = (typeof translations)[Lang]['meals'];
type CommonT = (typeof translations)[Lang]['common'];

type Props = {
  days: MealDay[];
  signupCounts: Record<string, number>;
  t: MealsT;
  tc: CommonT;
  lang: Lang;
};

type Selection = { start: string; end: string };

const mealDotColor: Record<MealType, string> = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-cocm-red',
  dinner: 'bg-cocm-blue',
};

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatDay(dateStr: string, lang: Lang) {
  const [, m, d] = dateStr.split('-').map(Number);
  if (lang === 'zh') return `${m}月${d}日`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

function formatMonth(year: number, month: number, lang: Lang) {
  if (lang === 'zh') return `${year}年${month}月`;
  return `${EN_MONTHS[month - 1]} ${year}`;
}

export function MealCalendar({ days, signupCounts, t, tc, lang }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirming, setConfirming] = useState<'single' | 'range' | null>(null);

  const dragAnchor = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const today = useMemo(todayIso, []);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.meal_date, d])), [days]);

  // Editor form state, synced whenever the selection changes.
  const [editor, setEditor] = useState({ breakfast: true, lunch: true, dinner: true, note: '' });
  useEffect(() => {
    if (!selection) return;
    setConfirming(null);
    if (selection.start === selection.end) {
      const existing = dayMap.get(selection.start);
      setEditor({
        breakfast: existing ? existing.breakfast_available : true,
        lunch: existing ? existing.lunch_available : true,
        dinner: existing ? existing.dinner_available : true,
        note: existing?.note ?? '',
      });
    } else {
      // Bulk editor defaults: copy the first existing day in the range, else all on.
      let seed: MealDay | undefined;
      for (const [date, day] of dayMap) {
        if (date >= selection.start && date <= selection.end) {
          seed = day;
          break;
        }
      }
      setEditor({
        breakfast: seed ? seed.breakfast_available : true,
        lunch: seed ? seed.lunch_available : true,
        dinner: seed ? seed.dinner_available : true,
        note: '',
      });
    }
  }, [selection, dayMap]);

  // End drag even if the pointer leaves the grid.
  useEffect(() => {
    const up = () => {
      dragAnchor.current = null;
      setDragging(false);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const cells = useMemo(() => {
    const firstDow = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // Monday-first
    const dim = new Date(viewYear, viewMonth, 0).getDate();
    const list: Array<string | null> = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= dim; d++) list.push(toIso(viewYear, viewMonth, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewYear, viewMonth]);

  const weekdays = lang === 'zh'
    ? ['一', '二', '三', '四', '五', '六', '日']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isSingle = selection !== null && selection.start === selection.end;
  const selectedDay = isSingle ? dayMap.get(selection.start) : undefined;
  const rangeSignupTotal = useMemo(() => {
    if (!selection || isSingle) return 0;
    let total = 0;
    for (const [date, count] of Object.entries(signupCounts)) {
      if (date >= selection.start && date <= selection.end) total += count;
    }
    return total;
  }, [selection, isSingle, signupCounts]);

  const goMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };
  const goToday = () => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth() + 1);
  };

  const onDayDown = (date: string) => {
    dragAnchor.current = date;
    setDragging(true);
    setSelection({ start: date, end: date });
  };
  const onDayEnter = (date: string) => {
    if (!dragging || !dragAnchor.current) return;
    const a = dragAnchor.current;
    setSelection({ start: a <= date ? a : date, end: a <= date ? date : a });
  };

  const runAction = (fn: () => Promise<{ ok: boolean }>) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setConfirming(null);
        router.refresh();
      }
    });
  };

  const toggleMeal = (type: MealType) =>
    setEditor((e) => ({ ...e, [type]: !e[type] }));

  const mealLabel = (type: MealType) =>
    type === 'breakfast' ? t.breakfast : type === 'lunch' ? t.lunch : t.dinner;

  const navBtn =
    'rounded-[10px] border border-cocm-ink/15 px-3 py-1.5 text-sm font-semibold text-cocm-ink transition hover:border-cocm-ink/30 hover:bg-cocm-ink/[0.03] active:scale-[0.97]';

  const selectedCount = selection
    ? (() => {
        const [sy, sm, sd] = selection.start.split('-').map(Number);
        const [ey, em, ed] = selection.end.split('-').map(Number);
        const diff =
          (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000 + 1;
        return Math.round(diff);
      })()
    : 0;

  return (
    <div className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-cocm-ink">{t.daysTitle}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{t.calHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goMonth(-1)} className={navBtn} aria-label="Previous month">
            ‹
          </button>
          <span className="min-w-[120px] text-center font-serif text-lg text-cocm-ink">
            {formatMonth(viewYear, viewMonth, lang)}
          </span>
          <button type="button" onClick={() => goMonth(1)} className={navBtn} aria-label="Next month">
            ›
          </button>
          <button type="button" onClick={goToday} className={navBtn}>
            {t.today}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <div className="select-none">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-cocm-slate/70">
            {weekdays.map((w) => (
              <div key={w} className="py-1.5">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const day = dayMap.get(date);
              const count = signupCounts[date] ?? 0;
              const inRange = selection !== null && date >= selection.start && date <= selection.end;
              const isEndpoint = selection !== null && (date === selection.start || date === selection.end);
              const isToday = date === today;
              const d = Number(date.slice(8, 10));
              return (
                <button
                  key={date}
                  type="button"
                  onMouseDown={() => onDayDown(date)}
                  onMouseEnter={() => onDayEnter(date)}
                  className={`relative flex min-h-[64px] flex-col items-center justify-start gap-1 rounded-[12px] border px-1 pb-1.5 pt-2 text-sm transition md:min-h-[76px] ${
                    isEndpoint
                      ? 'border-cocm-blue bg-cocm-blue text-white shadow-card'
                      : inRange
                        ? 'border-cocm-blue/40 bg-cocm-blue/[0.08] text-cocm-ink'
                        : day
                          ? 'border-cocm-ink/10 bg-white text-cocm-ink hover:border-cocm-blue/50 hover:bg-cocm-blue/[0.04]'
                          : 'border-dashed border-cocm-ink/10 bg-cocm-ink/[0.015] text-cocm-slate/60 hover:border-cocm-blue/40 hover:text-cocm-ink'
                  }`}
                >
                  <span className={`font-semibold leading-none ${isToday && !isEndpoint ? 'text-cocm-red' : ''}`}>
                    {d}
                    {isToday && !isEndpoint ? <span className="text-cocm-red"> •</span> : null}
                  </span>
                  {day ? (
                    <span className="flex items-center gap-1">
                      {mealTypes.map((mt) => {
                        const on =
                          mt === 'breakfast'
                            ? day.breakfast_available
                            : mt === 'lunch'
                              ? day.lunch_available
                              : day.dinner_available;
                        return on ? (
                          <span
                            key={mt}
                            title={mealLabel(mt)}
                            className={`h-1.5 w-1.5 rounded-full ${mealDotColor[mt]}`}
                          />
                        ) : null;
                      })}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-0">·</span>
                  )}
                  {count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight ${
                        isEndpoint ? 'bg-white/25 text-white' : 'bg-cocm-ink/[0.06] text-cocm-slate'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-cocm-slate">
            {mealTypes.map((mt) => (
              <span key={mt} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${mealDotColor[mt]}`} />
                {mealLabel(mt)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-cocm-ink/[0.06] px-1.5 text-[10px] font-semibold">3</span>
              {lang === 'zh' ? '报名人次' : 'signups'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-cocm-red">•</span>
              {t.today}
            </span>
          </div>
        </div>

        {/* Editor panel */}
        <div className="rounded-[16px] border border-cocm-ink/10 bg-cocm-blue/[0.04] p-4 md:p-5">
          {!selection ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cocm-blue/10 text-xl text-cocm-blue">
                📅
              </div>
              <p className="mt-3 text-sm text-cocm-slate">{t.selectDayFirst}</p>
            </div>
          ) : isSingle ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cocm-red">
                {selectedDay ? t.editMealDay : t.newMealDay}
              </p>
              <h4 className="mt-1 font-serif text-2xl text-cocm-ink">
                {formatDay(selection.start, lang)}
              </h4>
              {(signupCounts[selection.start] ?? 0) > 0 ? (
                <p className="mt-1 text-[12px] text-cocm-slate">
                  {lang === 'zh'
                    ? `${signupCounts[selection.start]} 人已报名`
                    : `${signupCounts[selection.start]} signed up`}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {mealTypes.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    aria-pressed={editor[mt]}
                    onClick={() => toggleMeal(mt)}
                    className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                      editor[mt]
                        ? 'border-cocm-blue bg-cocm-blue text-white shadow-card'
                        : 'border-cocm-ink/15 bg-white text-cocm-slate hover:border-cocm-ink/30'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${editor[mt] ? 'bg-white' : mealDotColor[mt]}`} />
                    {mealLabel(mt)}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-[13px] font-semibold text-cocm-ink">
                {t.note}
                <input
                  type="text"
                  value={editor.note}
                  onChange={(e) => setEditor((ed) => ({ ...ed, note: e.target.value }))}
                  placeholder={t.notePlaceholder}
                  maxLength={200}
                  className="mt-2 h-11 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 text-[15px] font-normal text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-blue focus:ring-2 focus:ring-cocm-blue/20"
                />
              </label>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    saveMealDay({
                      date: selection.start,
                      breakfast: editor.breakfast,
                      lunch: editor.lunch,
                      dinner: editor.dinner,
                      note: editor.note || null,
                    })
                  )
                }
                className="mt-4 h-11 w-full rounded-[12px] bg-cocm-red text-[15px] font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.99] disabled:opacity-60"
              >
                {isPending ? '…' : tc.save}
              </button>

              {selectedDay ? (
                <div className="mt-2">
                  {confirming === 'single' ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(() => removeMealDay(selection.start))}
                      className="h-11 w-full rounded-[12px] bg-cocm-ink text-[15px] font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.99] disabled:opacity-60"
                    >
                      {t.confirmDeleteBtn}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming('single')}
                      className="h-11 w-full rounded-[12px] border-[1.5px] border-cocm-red/40 text-[15px] font-semibold text-cocm-red transition hover:bg-cocm-red/5 active:scale-[0.99]"
                    >
                      {t.deleteDay}
                    </button>
                  )}
                  {(signupCounts[selection.start] ?? 0) > 0 ? (
                    <p className="mt-2 text-center text-[12px] text-cocm-red">
                      {t.deleteCascadeWarn.replace('{n}', String(signupCounts[selection.start]))}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setSelection(null)}
                className="mt-3 w-full text-center text-[13px] font-semibold text-cocm-slate hover:text-cocm-ink"
              >
                {t.clearSelection}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cocm-red">
                {t.editRange}
              </p>
              <h4 className="mt-1 font-serif text-2xl text-cocm-ink">
                {formatDay(selection.start, lang)} – {formatDay(selection.end, lang)}
              </h4>
              <p className="mt-1 text-[12px] text-cocm-slate">
                {lang === 'zh' ? `共 ${selectedCount} 天` : `${selectedCount} days`}
                {rangeSignupTotal > 0
                  ? lang === 'zh'
                    ? ` · ${rangeSignupTotal} 人次已报名`
                    : ` · ${rangeSignupTotal} signups`
                  : ''}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {mealTypes.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    aria-pressed={editor[mt]}
                    onClick={() => toggleMeal(mt)}
                    className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                      editor[mt]
                        ? 'border-cocm-blue bg-cocm-blue text-white shadow-card'
                        : 'border-cocm-ink/15 bg-white text-cocm-slate hover:border-cocm-ink/30'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${editor[mt] ? 'bg-white' : mealDotColor[mt]}`} />
                    {mealLabel(mt)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    saveMealDayRange({
                      start: selection.start,
                      end: selection.end,
                      breakfast: editor.breakfast,
                      lunch: editor.lunch,
                      dinner: editor.dinner,
                    })
                  )
                }
                className="mt-4 h-11 w-full rounded-[12px] bg-cocm-red text-[15px] font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.99] disabled:opacity-60"
              >
                {isPending ? '…' : t.applyToRange}
              </button>

              <div className="mt-2">
                {confirming === 'range' ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      runAction(() =>
                        removeMealDayRange({ start: selection.start, end: selection.end })
                      )
                    }
                    className="h-11 w-full rounded-[12px] bg-cocm-ink text-[15px] font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.99] disabled:opacity-60"
                  >
                    {t.confirmDeleteBtn}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming('range')}
                    className="h-11 w-full rounded-[12px] border-[1.5px] border-cocm-red/40 text-[15px] font-semibold text-cocm-red transition hover:bg-cocm-red/5 active:scale-[0.99]"
                  >
                    {t.deleteRange}
                  </button>
                )}
                {rangeSignupTotal > 0 ? (
                  <p className="mt-2 text-center text-[12px] text-cocm-red">
                    {t.rangeDeleteCascadeWarn.replace('{n}', String(rangeSignupTotal))}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setSelection(null)}
                className="mt-3 w-full text-center text-[13px] font-semibold text-cocm-slate hover:text-cocm-ink"
              >
                {t.clearSelection}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
