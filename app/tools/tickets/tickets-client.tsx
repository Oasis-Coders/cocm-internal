'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/translations';
import { listTickets, type TicketRow, type TicketStatus } from './actions';
import { StatusBadge, KindBadge, STATUS_META, ticketStrings } from './ticket-ui';

const FILTERS: Array<'all' | TicketStatus> = ['all', 'submitted', 'in_progress', 'review', 'blocked', 'closed'];

function timeAgo(iso: string, lang: Lang) {
  const d = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - d) / 60000));
  if (mins < 1) return lang === 'en' ? 'just now' : lang === 'zh-Hant' ? '剛剛' : '刚刚';
  if (mins < 60) return lang === 'en' ? `${mins}m ago` : `${mins} 分钟前`;
  const h = Math.floor(mins / 60);
  if (h < 24) return lang === 'en' ? `${h}h ago` : `${h} 小时前`;
  const days = Math.floor(h / 24);
  return lang === 'en' ? `${days}d ago` : `${days} 天前`;
}

export function TicketsClient({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listTickets(filter)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === f
                  ? 'bg-cocm-ink text-white'
                  : 'border border-cocm-ink/10 bg-white text-[#5b5f94] hover:border-cocm-ink/25'
              }`}
            >
              {f === 'all' ? ticketStrings.all[lang] : STATUS_META[f][lang]}
            </button>
          ))}
        </div>
        <Link
          href="/tools/tickets/new"
          className="ml-auto inline-flex h-9 items-center rounded-[10px] bg-cocm-ink px-4 text-[13px] font-medium text-white hover:opacity-90"
        >
          {ticketStrings.newTicket[lang]}
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.loading[lang]}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.noTickets[lang]}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/tools/tickets/${r.id}`}>
              <div className="flex items-center gap-3 rounded-[16px] border border-cocm-ink/10 bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(45,47,146,0.15)]">
                <span className="shrink-0 font-mono text-[13px] font-bold text-cocm-red">#{r.number}</span>
                <KindBadge kind={r.kind} lang={lang} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-cocm-ink">{r.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#5b5f94]">
                    {r.creator_name || ''} · {timeAgo(r.updated_at, lang)} · {r.message_count}{' '}
                    {ticketStrings.messages[lang]}
                  </p>
                </div>
                <StatusBadge status={r.status} lang={lang} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
