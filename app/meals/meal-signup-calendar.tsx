'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cancelMealSignup, signupMeal } from '@/app/meals/actions';
import {
  formatMoney,
  isMealAvailable,
  mealTypes,
  priceForIdentity,
  type DinerIdentity,
  type MealDay,
  type MealDiner,
  type MealSignup,
  type MealType,
} from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';

type MealsT = (typeof translations)[Lang]['meals'];

type Props = {
  days: MealDay[];
  diners: MealDiner[];
  signups: MealSignup[];
  myUserId: string;
  prices: { price_staff: number; price_other: number };
  t: MealsT;
  lang: Lang;
};

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

const MY_DINER_KEY = 'cocm_my_diner';

export function MealSignupCalendar({ days, diners, signups, myUserId, prices, t, lang }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(null);

  // Booking form state.
  const [dinerId, setDinerId] = useState('');
  const [headcount, setHeadcount] = useState(1);
  const [forOthers, setForOthers] = useState(false);
  const [allergenOk, setAllergenOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myDinerId, setMyDinerId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setMyDinerId(localStorage.getItem(MY_DINER_KEY));
    } catch {
      setMyDinerId(null);
    }
  }, []);

  // Preselect remembered name when the diner list loads.
  useEffect(() => {
    if (!dinerId && myDinerId && diners.some((d) => d.id === myDinerId)) {
      setDinerId(myDinerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDinerId, diners]);

  const today = useMemo(todayIso, []);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.meal_date, d])), [days]);
  const signupsByDay = useMemo(() => {
    const map = new Map<string, MealSignup[]>();
    for (const s of signups) {
      const list = map.get(s.meal_date) ?? [];
      list.push(s);
      map.set(s.meal_date, list);
    }
    return map;
  }, [signups]);
  const headcountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const [date, list] of signupsByDay) {
      map.set(date, list.reduce((sum, s) => sum + (Number(s.headcount) || 1), 0));
    }
    return map;
  }, [signupsByDay]);

  const cells = useMemo(() => {
    const firstDow = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7;
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

  const identityLabel = (identity: DinerIdentity | string | null): string => {
    switch (identity) {
      case 'staff': return t.identityStaff;
      case 'staff_family': return t.identityStaffFamily;
      case 'friend': return t.identityFriend;
      case 'camp_mate': return t.identityCampMate;
      default: return t.identityOther;
    }
  };
  const mealLabel = (type: MealType) =>
    type === 'breakfast' ? t.breakfast : type === 'lunch' ? t.lunch : t.dinner;

  const goMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  const selectedDay = selected ? dayMap.get(selected) : undefined;
  const selectedSignups = selected ? signupsByDay.get(selected) ?? [] : [];
  const selectedDiner = diners.find((d) => d.id === dinerId);
  const allergenRequired = forOthers || headcount > 1;
  const unitPrice = selectedDiner
    ? priceForIdentity(
        { ...prices, breakfast_price: 0, lunch_price: 0, dinner_price: 0, currency: 'GBP', transfer_info: '' },
        selectedDiner.identity
      )
    : 0;

  const onPickDiner = (id: string) => {
    setDinerId(id);
    setError(null);
    // If they pick a different name than their remembered self, it's for others.
    if (myDinerId && id && id !== myDinerId) {
      setForOthers(true);
    } else if (!myDinerId) {
      setForOthers(false);
    }
  };

  const errorText = (code: string | null): string | null => {
    if (!code) return null;
    switch (code) {
      case 'allergen-required': return t.allergenRequired;
      case 'already-signed-up': return t.alreadySignedUp;
      case 'not-available': return t.notAvailable;
      case 'invalid-diner': return t.invalidDiner;
      default: return t.actionFailed;
    }
  };

  const book = (mealType: MealType) => {
    if (!dinerId) {
      setError(t.pickNameFirst);
      return;
    }
    if (allergenRequired && !allergenOk) {
      setError(t.allergenRequired);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await signupMeal({
        dinerId,
        mealDate: selected!,
        mealType,
        headcount,
        allergenConfirmed: allergenOk,
      });
      if (!res.ok) {
        setError(errorText(res.error ?? null));
        return;
      }
      // Remember self when booking as self.
      if (!forOthers) {
        setMyDinerId(dinerId);
        try {
          localStorage.setItem(MY_DINER_KEY, dinerId);
        } catch { /* ignore */ }
      }
      router.refresh();
    });
  };

  const cancel = (signupId: string) => {
    startTransition(async () => {
      const res = await cancelMealSignup(signupId);
      if (!res.ok) setError(t.actionFailed);
      else router.refresh();
    });
  };

  const navBtn =
    'rounded-[10px] border border-cocm-ink/15 px-3 py-1.5 text-sm font-semibold text-cocm-ink transition hover:border-cocm-ink/30 hover:bg-cocm-ink/[0.03] active:scale-[0.97]';

  return (
    <div className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-cocm-ink">{t.calendarTitle}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{t.calendarHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goMonth(-1)} className={navBtn} aria-label="Previous month">‹</button>
          <span className="min-w-[120px] text-center font-serif text-lg text-cocm-ink">
            {formatMonth(viewYear, viewMonth, lang)}
          </span>
          <button type="button" onClick={() => goMonth(1)} className={navBtn} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Calendar */}
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-cocm-slate/70">
            {weekdays.map((w) => (
              <div key={w} className="py-1.5">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const day = dayMap.get(date);
              const count = headcountByDay.get(date) ?? 0;
              const isPast = date < today;
              const isToday = date === today;
              const isSel = date === selected;
              const d = Number(date.slice(8, 10));
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!day || isPast}
                  onClick={() => setSelected(isSel ? null : date)}
                  className={`relative flex min-h-[64px] flex-col items-center justify-start gap-1 rounded-[12px] border px-1 pb-1.5 pt-2 text-sm transition md:min-h-[76px] ${
                    isSel
                      ? 'border-cocm-blue bg-cocm-blue text-white shadow-card'
                      : isPast || !day
                        ? 'border-cocm-ink/[0.06] bg-cocm-ink/[0.015] text-cocm-slate/35'
                        : 'border-cocm-ink/10 bg-white text-cocm-ink hover:border-cocm-blue/50 hover:bg-cocm-blue/[0.04]'
                  } ${!day || isPast ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`font-semibold leading-none ${isToday && !isSel ? 'text-cocm-red' : ''}`}>
                    {d}
                    {isToday && !isSel ? <span className="text-cocm-red"> •</span> : null}
                  </span>
                  {day?.is_camp_day ? (
                    <span className={`rounded px-1 text-[10px] font-bold leading-tight ${isSel ? 'bg-white/25 text-white' : 'bg-cocm-red/10 text-cocm-red'}`}>
                      {lang === 'zh' ? '营会' : 'CAMP'}
                    </span>
                  ) : null}
                  {day ? (
                    <span className="flex items-center gap-1">
                      {mealTypes.filter((mt) => isMealAvailable(day, mt)).map((mt) => (
                        <span key={mt} title={mealLabel(mt)} className={`h-1.5 w-1.5 rounded-full ${mealDotColor[mt]}`} />
                      ))}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-0">·</span>
                  )}
                  {count > 0 ? (
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight ${isSel ? 'bg-white/25 text-white' : 'bg-cocm-ink/[0.06] text-cocm-slate'}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
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
              <span className="rounded bg-cocm-red/10 px-1 text-[10px] font-bold text-cocm-red">
                {lang === 'zh' ? '营会' : 'CAMP'}
              </span>
              {t.campDay}
            </span>
          </div>
        </div>

        {/* Booking panel */}
        <div className="scroll-mt-24 rounded-[16px] border border-cocm-ink/10 bg-cocm-blue/[0.04] p-4 md:p-5">
          {!selected || !selectedDay ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cocm-blue/10 text-xl text-cocm-blue">📅</div>
              <p className="mt-3 text-sm text-cocm-slate">{t.selectDayFirst}</p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cocm-red">{t.bookTitle}</p>
              <h4 className="mt-1 flex items-center gap-2 font-serif text-2xl text-cocm-ink">
                {formatDay(selected, lang)}
                {selectedDay.is_camp_day ? (
                  <span className="rounded bg-cocm-red/10 px-1.5 py-0.5 text-xs font-bold text-cocm-red">
                    {lang === 'zh' ? '营会' : 'CAMP'}
                  </span>
                ) : null}
              </h4>
              {selectedDay.note ? (
                <p className="mt-1 text-[13px] text-cocm-slate">{selectedDay.note}</p>
              ) : null}

              {/* Who + headcount */}
              <label className="mt-4 block text-[13px] font-semibold text-cocm-ink">
                {t.bookFor}
                <select
                  value={dinerId}
                  onChange={(e) => onPickDiner(e.target.value)}
                  className="mt-2 h-11 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3 text-[15px] font-normal text-cocm-ink outline-none transition focus:border-cocm-blue focus:ring-2 focus:ring-cocm-blue/20"
                >
                  <option value="">{t.pickName}</option>
                  {diners.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {identityLabel(d.identity)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-cocm-ink">{t.headcount}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHeadcount((h) => Math.max(1, h - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-cocm-ink/15 bg-white text-lg font-semibold text-cocm-ink transition active:scale-95"
                    aria-label="decrease"
                  >−</button>
                  <span className="min-w-[2ch] text-center text-lg font-bold text-cocm-ink">{headcount}</span>
                  <button
                    type="button"
                    onClick={() => setHeadcount((h) => Math.min(20, h + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-cocm-ink/15 bg-white text-lg font-semibold text-cocm-ink transition active:scale-95"
                    aria-label="increase"
                  >+</button>
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-cocm-ink">
                <input
                  type="checkbox"
                  checked={forOthers}
                  onChange={(e) => setForOthers(e.target.checked)}
                  className="h-4 w-4 rounded accent-cocm-blue"
                />
                {t.bookForOthers}
              </label>

              <label className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 text-sm transition ${allergenRequired ? 'border-amber-500/40 bg-amber-50' : 'border-cocm-ink/10 bg-white'}`}>
                <input
                  type="checkbox"
                  checked={allergenOk}
                  onChange={(e) => setAllergenOk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-cocm-blue"
                />
                <span className="text-cocm-ink">
                  {t.allergenConfirm}
                  {allergenRequired ? <span className="text-cocm-red"> *</span> : null}
                </span>
              </label>
              {selectedDiner?.allergens ? (
                <p className="mt-2 rounded-[10px] bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-800">
                  ⚠ {t.allergenOnFile}: {selectedDiner.allergens}
                </p>
              ) : null}

              {error ? (
                <p className="mt-2 text-sm font-semibold text-cocm-red">{error}</p>
              ) : null}

              {/* Meals */}
              <div className="mt-4 space-y-3">
                {mealTypes.filter((mt) => isMealAvailable(selectedDay, mt)).map((mt) => {
                  const list = selectedSignups.filter((s) => s.meal_type === mt);
                  const alreadyBooked = selectedDiner && list.some((s) => s.diner_id === selectedDiner.id);
                  return (
                    <div key={mt} className="rounded-[12px] border border-cocm-ink/10 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 font-semibold text-cocm-ink">
                          <span className={`h-2 w-2 rounded-full ${mealDotColor[mt]}`} />
                          {mealLabel(mt)}
                          <span className="text-xs font-normal text-cocm-slate">
                            {selectedDiner ? `${formatMoney(unitPrice, 'GBP')}${t.perPersonSuffix}` : ''}
                          </span>
                        </p>
                        <button
                          type="button"
                          disabled={isPending || !dinerId || !!alreadyBooked}
                          onClick={() => book(mt)}
                          title={alreadyBooked ? t.alreadySignedUp : undefined}
                          className="rounded-[10px] bg-cocm-red px-4 py-2 text-sm font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98] disabled:opacity-40"
                        >
                          {isPending ? '…' : alreadyBooked ? t.signedUp : t.bookMeal}
                        </button>
                      </div>
                      {list.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {list.map((s) => {
                            const isMine = s.booked_by === myUserId || s.user_id === myUserId;
                            return (
                              <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className="truncate font-semibold text-cocm-ink">
                                    {s.display_name ?? '—'}
                                  </span>
                                  {(Number(s.headcount) || 1) > 1 ? (
                                    <span className="text-cocm-slate">×{s.headcount}</span>
                                  ) : null}
                                  <span className="rounded-full bg-cocm-ink/[0.06] px-1.5 py-px text-[11px] text-cocm-slate">
                                    {identityLabel(s.identity)}
                                  </span>
                                </span>
                                {isMine ? (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => cancel(s.id)}
                                    className="shrink-0 text-xs font-semibold text-cocm-slate underline-offset-2 hover:text-cocm-red hover:underline disabled:opacity-50"
                                  >
                                    {t.cancelBooking}
                                  </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[13px] text-cocm-slate">{t.noSignupsYet}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
