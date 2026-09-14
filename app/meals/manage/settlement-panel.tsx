'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

import { formatMoney } from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';
import {
  recordMealPayment,
  adjustMealBalance,
  clearMealBalance,
  removeMealPayment,
  type MealPayment,
} from '@/app/meals/manage/actions';

type MealsT = (typeof translations)[Lang]['meals'];
type CommonT = (typeof translations)[Lang]['common'];

export type SettlementRow = {
  userId: string;
  name: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  owed: number;
  paid: number;
  adjusted: number;
  outstanding: number;
};

type Props = {
  rows: SettlementRow[];
  paymentsByUser: Record<string, MealPayment[]>;
  currency: string;
  /** 'YYYY-MM' settlement period. */
  period: string;
  t: MealsT;
  tc: CommonT;
  lang: Lang;
};

type DialogState = { mode: 'payment' | 'adjust'; row: SettlementRow } | null;

const inputClass =
  'rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3 py-2 text-sm text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-red focus:ring-2 focus:ring-cocm-red/20';

const btnPrimary =
  'rounded-[10px] bg-cocm-red px-3 py-1.5 text-xs font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98] disabled:opacity-50';
const btnGhost =
  'rounded-[10px] border border-cocm-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-cocm-ink transition-all hover:border-cocm-ink/30 active:scale-[0.98] disabled:opacity-50';

function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return lang === 'zh' ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SettlementPanel({ rows, paymentsByUser, currency, period, t, tc, lang }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<SettlementRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totals = rows.reduce(
    (acc, r) => ({
      owed: acc.owed + r.owed,
      paid: acc.paid + r.paid,
      adjusted: acc.adjusted + r.adjusted,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { owed: 0, paid: 0, adjusted: 0, outstanding: 0 }
  );

  function openDialog(mode: 'payment' | 'adjust', row: SettlementRow) {
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
      userId: dialog.row.userId,
      period,
      kind: dialog.mode as 'payment' | 'adjustment',
      amount: Math.round(value * 100) / 100,
      note: note.trim() ? note.trim() : null,
    };
    const result =
      dialog.mode === 'payment' ? await recordMealPayment(payload) : await adjustMealBalance(payload);
    setBusy(false);
    if (!result.ok) {
      setError(t.actionFailed);
      return;
    }
    setDialog(null);
    router.refresh();
  }

  async function submitClear(row: SettlementRow) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await clearMealBalance({ userId: row.userId, period, note: t.settledNote });
    setBusy(false);
    setConfirmClear(null);
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
    const result = await removeMealPayment({ paymentId, period });
    setBusy(false);
    setConfirmDelete(null);
    if (!result.ok) {
      setNotice(t.actionFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {notice ? (
        <p className="mb-3 rounded-xl border border-amber-600/20 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {notice}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-cocm-ink/10 text-xs uppercase tracking-[0.15em] text-cocm-slate">
              <th className="px-4 py-3 font-semibold">{t.name}</th>
              <th className="px-4 py-3 font-semibold">{t.breakfast}</th>
              <th className="px-4 py-3 font-semibold">{t.lunch}</th>
              <th className="px-4 py-3 font-semibold">{t.dinner}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.owed}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.paid}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.adjustments}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.outstanding}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.recordPayment}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const history = paymentsByUser[row.userId] ?? [];
              const isOpen = !!expanded[row.userId];
              const settled = row.outstanding <= 0.005;
              return (
                <Fragment key={row.userId}>
                  <tr
                    className="border-b border-cocm-ink/5 transition-colors last:border-0 hover:bg-cocm-ink/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [row.userId]: !p[row.userId] }))}
                        className="text-left font-semibold text-cocm-ink hover:text-cocm-red"
                        title={t.paymentHistory}
                      >
                        {row.name}
                        <span className="ml-1.5 text-xs font-normal text-cocm-slate">
                          {history.length > 0 ? `(${history.length})` : ''} {isOpen ? '▾' : '▸'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-cocm-slate">{row.breakfast}</td>
                    <td className="px-4 py-3 text-cocm-slate">{row.lunch}</td>
                    <td className="px-4 py-3 text-cocm-slate">{row.dinner}</td>
                    <td className="px-4 py-3 text-right text-cocm-slate">
                      {formatMoney(row.owed, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-cocm-slate">
                      {formatMoney(row.paid, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-cocm-slate">
                      {row.adjusted === 0
                        ? '—'
                        : `${row.adjusted > 0 ? '−' : '+'}${formatMoney(Math.abs(row.adjusted), currency)}`}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        settled ? 'text-green-700' : 'text-cocm-red'
                      }`}
                    >
                      {settled ? t.clearBalance : formatMoney(row.outstanding, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={btnPrimary} onClick={() => openDialog('payment', row)}>
                          {t.recordPayment}
                        </button>
                        <button type="button" className={btnGhost} onClick={() => openDialog('adjust', row)}>
                          {t.adjustBalance}
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          disabled={settled}
                          onClick={() => setConfirmClear(row)}
                        >
                          {t.clearBalance}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-cocm-ink/5 bg-cocm-ink/[0.02]">
                      <td colSpan={9} className="px-6 py-3">
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
                                <span className="text-cocm-slate">{formatDateTime(p.created_at, lang)}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    p.kind === 'payment'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {p.kind === 'payment' ? t.kindPayment : t.kindAdjustment}
                                </span>
                                <span className="font-semibold text-cocm-ink">
                                  {p.amount < 0 ? '+' : '−'}
                                  {formatMoney(Math.abs(p.amount), currency)}
                                </span>
                                {p.note ? <span className="text-cocm-slate">{p.note}</span> : null}
                                {confirmDelete === p.id ? (
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <span className="text-cocm-slate">{t.confirmDeleteEntry}</span>
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
              <td className="px-4 py-3 text-cocm-ink" colSpan={4}>
                {tc.total}
              </td>
              <td className="px-4 py-3 text-right text-cocm-ink">{formatMoney(totals.owed, currency)}</td>
              <td className="px-4 py-3 text-right text-cocm-ink">{formatMoney(totals.paid, currency)}</td>
              <td className="px-4 py-3 text-right text-cocm-ink">
                {totals.adjusted === 0
                  ? '—'
                  : `${totals.adjusted > 0 ? '−' : '+'}${formatMoney(Math.abs(totals.adjusted), currency)}`}
              </td>
              <td className="px-4 py-3 text-right font-serif text-base text-cocm-ink">
                {formatMoney(totals.outstanding, currency)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {confirmClear ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cocm-red/20 bg-cocm-red/[0.04] px-4 py-3 text-sm">
          <span className="font-semibold text-cocm-ink">
            {t.confirmClear
              .replace('{name}', confirmClear.name)
              .replace('{amount}', formatMoney(confirmClear.outstanding, currency))}
          </span>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => submitClear(confirmClear)}>
            {t.clearBalance}
          </button>
          <button type="button" className={btnGhost} onClick={() => setConfirmClear(null)}>
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
              {t.outstanding}: {formatMoney(dialog.row.outstanding, currency)}
            </p>
            {dialog.mode === 'adjust' ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                {t.adjustHint}
              </p>
            ) : null}
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-semibold text-cocm-ink">
                {t.paymentAmount} ({currency})
              </span>
              <input
                type="number"
                min={dialog.mode === 'payment' ? '0.01' : undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className={inputClass}
              />
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
              <button type="button" className={btnGhost} disabled={busy} onClick={() => setDialog(null)}>
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
