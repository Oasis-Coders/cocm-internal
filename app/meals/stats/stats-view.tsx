'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatMoney, type DinerIdentity } from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';
import {
  adjustDinerBalance,
  confirmDinerPaid,
  recordDinerPayment,
  removeDinerPayment,
  type DinerPayment,
} from '@/app/meals/stats/actions';

type MealsT = (typeof translations)[Lang]['meals'];
type CommonT = (typeof translations)[Lang]['common'];

export type DaySignup = {
  meal: string;
  name: string;
  identity: DinerIdentity | null;
  headcount: number;
  price: number;
  bookedBy: string;
};

export type DayStat = {
  date: string;
  isCamp: boolean;
  note: string | null;
  counts: { breakfast: number; lunch: number; dinner: number };
  total: number;
  signups: DaySignup[];
};

export type DinerStat = {
  dinerId: string;
  name: string;
  identity: DinerIdentity | null;
  meals: number;
  owed: number;
  paid: number;
  adjusted: number;
  outstanding: number;
};

type Props = {
  days: DayStat[];
  diners: DinerStat[];
  paymentsByDiner: Record<string, DinerPayment[]>;
  period: string;
  t: MealsT;
  tc: CommonT;
  lang: Lang;
};

type DialogState = { mode: 'payment' | 'adjust'; row: DinerStat } | null;

const inputClass =
  'rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3 py-2 text-sm text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-red focus:ring-2 focus:ring-cocm-red/20';
const btnPrimary =
  'rounded-[10px] bg-cocm-red px-3 py-1.5 text-xs font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98] disabled:opacity-50';
const btnGhost =
  'rounded-[10px] border border-cocm-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-cocm-ink transition-all hover:border-cocm-ink/30 active:scale-[0.98] disabled:opacity-50';

const CURRENCY = 'GBP';

function formatDay(dateStr: string, lang: Lang) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  if (lang !== 'en') {
    const wds = ['日', '一', '二', '三', '四', '五', '六'];
    return `${m}月${d}日 周${wds[wd]}`;
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
  return `${wds[wd]}, ${months[m - 1]} ${d}`;
}

function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatsView({ days, diners, paymentsByDiner, period, t, tc, lang }: Props) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<DinerStat | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const identityLabel = (identity: DinerIdentity | null): string => {
    switch (identity) {
      case 'staff':
        return t.identityStaff;
      case 'staff_family':
        return t.identityStaffFamily;
      case 'volunteer':
        return t.identityVolunteer;
      case 'friend':
        return t.identityFriend;
      case 'camp_mate':
        return t.identityCampMate;
      default:
        return t.identityOther;
    }
  };
  const mealLabel = (meal: string) =>
    meal === 'breakfast' ? t.breakfast : meal === 'lunch' ? t.lunch : t.dinner;

  const totals = diners.reduce(
    (acc, r) => ({
      owed: acc.owed + r.owed,
      paid: acc.paid + r.paid,
      adjusted: acc.adjusted + r.adjusted,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { owed: 0, paid: 0, adjusted: 0, outstanding: 0 }
  );

  function openDialog(mode: 'payment' | 'adjust', row: DinerStat) {
    setDialog({ mode, row });
    setAmount('');
    setNote('');
    setError(null);
    setNotice(null);
  }

  async function submitDialog() {
    if (!dialog || busy) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 100000) {
      setError(t.invalidAmount);
      return;
    }
    if (dialog.mode === 'payment' && value <= 0) {
      setError(t.invalidAmount);
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      dinerId: dialog.row.dinerId,
      period,
      amount: Math.round(value * 100) / 100,
      note: note.trim() ? note.trim() : null,
    };
    const result =
      dialog.mode === 'payment'
        ? await recordDinerPayment(payload)
        : await adjustDinerBalance(payload);
    setBusy(false);
    if (!result.ok) {
      setError(t.actionFailed);
      return;
    }
    setDialog(null);
    router.refresh();
  }

  async function submitConfirmPaid(row: DinerStat) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await confirmDinerPaid({ dinerId: row.dinerId, period, note: t.settledNote });
    setBusy(false);
    setConfirmPaid(null);
    if (!result.ok) {
      setNotice(t.actionFailed);
      return;
    }
    if (!result.settled) {
      setNotice(t.alreadySettled);
      return;
    }
    router.refresh();
  }

  async function submitDelete(paymentId: string) {
    if (busy) return;
    setBusy(true);
    const result = await removeDinerPayment({ paymentId, period });
    setBusy(false);
    setConfirmDelete(null);
    if (!result.ok) {
      setNotice(t.actionFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-xl border border-amber-600/20 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {notice}
        </p>
      ) : null}

      {/* Daily headcount */}
      <section className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
        <h3 className="font-serif text-xl text-cocm-ink">{t.dayHeadcount}</h3>
        <p className="mt-1 text-sm text-cocm-slate">{t.clickDayHint}</p>
        {days.length === 0 ? (
          <p className="mt-3 text-sm text-cocm-slate">{t.noSignups}</p>
        ) : (
          <ul className="mt-4 divide-y divide-cocm-ink/[0.06]">
            {days.map((day) => {
              const open = openDay === day.date;
              return (
                <li key={day.date}>
                  <button
                    type="button"
                    onClick={() => setOpenDay(open ? null : day.date)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-cocm-ink/[0.02]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-cocm-ink">
                        {formatDay(day.date, lang)}
                      </span>
                      {day.isCamp ? (
                        <span className="rounded bg-cocm-red/10 px-1.5 py-0.5 text-[11px] font-bold text-cocm-red">
                          {lang === 'zh-Hant' ? '營會' : lang !== 'en' ? '营会' : 'CAMP'}
                        </span>
                      ) : null}
                      {day.note ? (
                        <span className="truncate text-xs text-cocm-slate">{day.note}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm text-cocm-slate">
                      {day.counts.breakfast > 0 ? (
                        <span>
                          {t.breakfast} {day.counts.breakfast}
                        </span>
                      ) : null}
                      {day.counts.lunch > 0 ? (
                        <span>
                          {t.lunch} {day.counts.lunch}
                        </span>
                      ) : null}
                      {day.counts.dinner > 0 ? (
                        <span>
                          {t.dinner} {day.counts.dinner}
                        </span>
                      ) : null}
                      <span className="min-w-[3ch] text-right font-bold text-cocm-ink">
                        {day.total}
                      </span>
                      <span className="text-cocm-slate/60">{open ? '▾' : '▸'}</span>
                    </span>
                  </button>
                  {open ? (
                    day.signups.length === 0 ? (
                      <p className="pb-3 pl-1 text-sm text-cocm-slate">{t.noSignups}</p>
                    ) : (
                      <div className="overflow-x-auto pb-3">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-cocm-ink/10 text-xs uppercase tracking-[0.12em] text-cocm-slate">
                              <th className="px-3 py-2 font-semibold">{t.name}</th>
                              <th className="px-3 py-2 font-semibold">{t.dinerIdentity}</th>
                              <th className="px-3 py-2 font-semibold">
                                {t.breakfast}/{t.lunch}/{t.dinner}
                              </th>
                              <th className="px-3 py-2 text-right font-semibold">{t.count}</th>
                              <th className="px-3 py-2 text-right font-semibold">{t.amount}</th>
                              <th className="px-3 py-2 text-right font-semibold">{t.bookedBy}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.signups.map((s, i) => (
                              <tr
                                key={`${s.meal}-${s.name}-${i}`}
                                className="border-b border-cocm-ink/5 last:border-0"
                              >
                                <td className="px-3 py-2 font-semibold text-cocm-ink">{s.name}</td>
                                <td className="px-3 py-2">
                                  <span className="rounded-full bg-cocm-ink/[0.06] px-2 py-0.5 text-xs text-cocm-slate">
                                    {identityLabel(s.identity)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-cocm-slate">{mealLabel(s.meal)}</td>
                                <td className="px-3 py-2 text-right text-cocm-slate">
                                  {s.headcount}
                                </td>
                                <td className="px-3 py-2 text-right text-cocm-slate">
                                  {formatMoney(s.price, CURRENCY)}
                                </td>
                                <td className="px-3 py-2 text-right text-cocm-slate">
                                  {s.bookedBy}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Monthly per-diner costs */}
      <section className="rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
        <h3 className="font-serif text-xl text-cocm-ink">{t.monthlyCosts}</h3>
        <p className="mt-1 text-sm text-cocm-slate">{t.monthlyCostsDesc}</p>
        {diners.length === 0 ? (
          <p className="mt-3 text-sm text-cocm-slate">{t.noSignups}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-cocm-ink/10 text-xs uppercase tracking-[0.15em] text-cocm-slate">
                  <th className="px-4 py-3 font-semibold">{t.name}</th>
                  <th className="px-4 py-3 font-semibold">{t.dinerIdentity}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.mealCount}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.owed}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.paid}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.adjustments}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.outstanding}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t.confirmPayment}</th>
                </tr>
              </thead>
              <tbody>
                {diners.map((row) => {
                  const history = paymentsByDiner[row.dinerId] ?? [];
                  const isOpen = !!expanded[row.dinerId];
                  const settled = row.outstanding <= 0.005;
                  return (
                    <Fragment key={row.dinerId}>
                      <tr className="border-b border-cocm-ink/5 transition-colors last:border-0 hover:bg-cocm-ink/[0.02]">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((p) => ({ ...p, [row.dinerId]: !p[row.dinerId] }))
                            }
                            className="text-left font-semibold text-cocm-ink hover:text-cocm-red"
                            title={t.paymentHistory}
                          >
                            {row.name}
                            <span className="ml-1.5 text-xs font-normal text-cocm-slate">
                              {history.length > 0 ? `(${history.length})` : ''} {isOpen ? '▾' : '▸'}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-cocm-ink/[0.06] px-2 py-0.5 text-xs text-cocm-slate">
                            {identityLabel(row.identity)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-cocm-slate">{row.meals}</td>
                        <td className="px-4 py-3 text-right text-cocm-slate">
                          {row.identity === 'volunteer' && row.owed === 0 ? (
                            <span className="font-semibold text-green-700">{t.volunteerFree}</span>
                          ) : (
                            formatMoney(row.owed, CURRENCY)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-cocm-slate">
                          {formatMoney(row.paid, CURRENCY)}
                        </td>
                        <td className="px-4 py-3 text-right text-cocm-slate">
                          {row.adjusted === 0 ? (
                            '—'
                          ) : (
                            <span
                              className={
                                row.adjusted > 0
                                  ? 'font-semibold text-green-700'
                                  : 'font-semibold text-cocm-red'
                              }
                            >
                              {row.adjusted > 0 ? t.adjustWaiver : t.adjustCharge}{' '}
                              {formatMoney(Math.abs(row.adjusted), CURRENCY)}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${settled ? 'text-green-700' : 'text-cocm-red'}`}
                        >
                          {settled ? t.settledNote : formatMoney(row.outstanding, CURRENCY)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              className={btnPrimary}
                              onClick={() => openDialog('payment', row)}
                            >
                              {t.recordPayment}
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openDialog('adjust', row)}
                            >
                              {t.adjustBalance}
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              disabled={settled}
                              onClick={() => setConfirmPaid(row)}
                            >
                              {t.confirmPayment}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-cocm-ink/5 bg-cocm-ink/[0.02]">
                          <td colSpan={8} className="px-6 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-cocm-slate">
                              {t.paymentHistory}
                            </p>
                            {history.length === 0 ? (
                              <p className="text-sm text-cocm-slate">{t.noPayments}</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {history.map((p) => (
                                  <li
                                    key={p.id}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                                  >
                                    <span className="text-cocm-slate">
                                      {formatDateTime(p.created_at, lang)}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.kind === 'payment' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                                    >
                                      {p.kind === 'payment' ? t.kindPayment : t.kindAdjustment}
                                    </span>
                                    <span
                                      className={`font-semibold ${p.kind === 'adjustment' && p.amount < 0 ? 'text-cocm-red' : p.kind === 'adjustment' ? 'text-green-700' : 'text-cocm-ink'}`}
                                    >
                                      {p.kind === 'adjustment'
                                        ? `${p.amount < 0 ? t.adjustCharge : t.adjustWaiver} ${formatMoney(Math.abs(p.amount), CURRENCY)}`
                                        : formatMoney(p.amount, CURRENCY)}
                                    </span>
                                    {p.note ? (
                                      <span className="text-cocm-slate">{p.note}</span>
                                    ) : null}
                                    {confirmDelete === p.id ? (
                                      <span className="flex items-center gap-1.5 text-xs">
                                        <span className="text-cocm-slate">
                                          {t.confirmDeleteEntry}
                                        </span>
                                        <button
                                          type="button"
                                          className={btnPrimary}
                                          disabled={busy}
                                          onClick={() => submitDelete(p.id)}
                                        >
                                          {t.deleteEntry}
                                        </button>
                                        <button
                                          type="button"
                                          className={btnGhost}
                                          onClick={() => setConfirmDelete(null)}
                                        >
                                          {t.clearSelection}
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="text-xs font-semibold text-cocm-slate underline-offset-2 hover:text-cocm-red hover:underline"
                                        onClick={() => setConfirmDelete(p.id)}
                                      >
                                        {t.deleteEntry}
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr className="bg-cocm-ink/[0.03] font-semibold">
                  <td className="px-4 py-3 text-cocm-ink" colSpan={3}>
                    {tc.total}
                  </td>
                  <td className="px-4 py-3 text-right text-cocm-ink">
                    {formatMoney(totals.owed, CURRENCY)}
                  </td>
                  <td className="px-4 py-3 text-right text-cocm-ink">
                    {formatMoney(totals.paid, CURRENCY)}
                  </td>
                  <td className="px-4 py-3 text-right text-cocm-ink">
                    {totals.adjusted === 0 ? (
                      '—'
                    ) : (
                      <span className={totals.adjusted > 0 ? 'text-green-700' : 'text-cocm-red'}>
                        {totals.adjusted > 0 ? t.adjustWaiver : t.adjustCharge}{' '}
                        {formatMoney(Math.abs(totals.adjusted), CURRENCY)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-serif text-base text-cocm-ink">
                    {formatMoney(totals.outstanding, CURRENCY)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmPaid ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cocm-red/20 bg-cocm-red/[0.04] px-4 py-3 text-sm">
          <span className="font-semibold text-cocm-ink">
            {t.confirmPaymentDesc
              .replace('{name}', confirmPaid.name)
              .replace('{amount}', formatMoney(confirmPaid.outstanding, CURRENCY))
              .replace('{period}', period)}
          </span>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={() => submitConfirmPaid(confirmPaid)}
          >
            {t.confirmPayment}
          </button>
          <button type="button" className={btnGhost} onClick={() => setConfirmPaid(null)}>
            {t.clearSelection}
          </button>
        </div>
      ) : null}

      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cocm-ink/40 p-4 backdrop-blur-[2px]"
          onClick={() => !busy && setDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-serif text-lg text-cocm-ink">
              {dialog.mode === 'payment' ? t.recordPayment : t.adjustBalance} · {dialog.row.name}
            </h4>
            <p className="mt-1 text-sm text-cocm-slate">
              {t.outstanding}: {formatMoney(dialog.row.outstanding, CURRENCY)}
            </p>
            {dialog.mode === 'adjust' ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                {t.adjustHint}
              </p>
            ) : null}
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-semibold text-cocm-ink">{t.paymentAmount} (£)</span>
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-cocm-slate"
                >
                  £
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className={`${inputClass} pl-8`}
                />
              </span>
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-semibold text-cocm-ink">{t.paymentNote}</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.paymentNotePlaceholder}
                maxLength={200}
                className={inputClass}
              />
            </label>
            {error ? <p className="mt-2 text-sm text-cocm-red">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                {t.clearSelection}
              </button>
              <button type="button" className={btnPrimary} disabled={busy} onClick={submitDialog}>
                {dialog.mode === 'payment' ? t.recordPayment : t.adjustBalance}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
