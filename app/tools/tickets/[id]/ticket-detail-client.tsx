'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/translations';
import {
  getTicket, postTicketMessage, closeTicket, reopenTicket,
  type TicketMessageRow, type TicketRow,
} from '../actions';
import { StatusBadge, KindBadge, ticketStrings } from '../ticket-ui';

const STR: Record<string, Record<Lang, string>> = {
  send: { zh: '发送', 'zh-Hant': '發送', en: 'Send' },
  sending: { zh: '发送中…', 'zh-Hant': '發送中…', en: 'Sending…' },
  sendFailed: { zh: '发送失败', 'zh-Hant': '發送失敗', en: 'Send failed' },
  notePh: { zh: '补充说明…', 'zh-Hant': '補充說明…', en: 'Add a note…' },
  refresh: { zh: '刷新', 'zh-Hant': '重新整理', en: 'Refresh' },
  closeTicket: { zh: '确认修复，关闭工单', 'zh-Hant': '確認修復，關閉工單', en: 'Confirm fix & close' },
  closeHint: {
    zh: '请先在上面的预览链接里验收，没问题再关闭；关闭后改动会在几分钟后自动合并上线。',
    'zh-Hant': '請先在上面的預覽連結裡驗收，沒問題再關閉；關閉後改動會在幾分鐘後自動合併上線。',
    en: 'Please verify on the preview link first; closing merges the change to production in a few minutes.',
  },
  reopen: { zh: '重新打开', 'zh-Hant': '重新打開', en: 'Reopen' },
  blockedHint: {
    zh: '此工单等待 Luke 拍板，请在下方留言或直接找他。',
    'zh-Hant': '此工單等待 Luke 拍板，請在下方留言或直接找他。',
    en: "This ticket is waiting on Luke's decision.",
  },
  closedHint: {
    zh: '工单已关闭，改动将在几分钟后自动合并上线。如有问题可重新打开。',
    'zh-Hant': '工單已關閉，改動將在幾分鐘後自動合併上線。如有問題可重新打開。',
    en: 'Ticket closed. Changes will go live in a few minutes. Reopen if needed.',
  },
  previewLink: { zh: '预览链接（在这个版本上验收）', 'zh-Hant': '預覽連結（在這個版本上驗收）', en: 'Preview link' },
};

function fmtTime(iso: string, lang: Lang) {
  const d = new Date(iso);
  const locale = lang === 'en' ? 'en-GB' : lang === 'zh-Hant' ? 'zh-Hant' : 'zh-CN';
  return d.toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ m, lang }: { m: TicketMessageRow; lang: Lang }) {
  const isAgent = m.author_type === 'agent';
  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] ${isAgent ? '' : 'flex flex-col items-end'}`}>
        <p className="mb-1 text-[11px] text-[#5b5f94]">
          {isAgent ? `🐾 ${m.author_name || 'Taffy'}` : m.author_name} · {fmtTime(m.created_at, lang)}
        </p>
        <div
          className={`rounded-[14px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
            isAgent ? 'bg-white text-cocm-ink shadow-[0_1px_6px_rgba(45,47,146,0.08)]' : 'bg-cocm-ink text-white'
          }`}
        >
          {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
        </div>
      </div>
    </div>
  );
}

export function TicketDetailClient({ ticketId, lang }: { ticketId: string; lang: Lang }) {
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const r = await getTicket(ticketId);
      if (r) {
        setTicket(r.ticket);
        setMessages(r.messages);
      }
    } catch {
      /* keep previous state */
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [ticketId]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setErr('');
    try {
      await postTicketMessage(ticketId, body);
      setBody('');
      await load();
    } catch (e: any) {
      setErr(e.message || STR.sendFailed[lang]);
    } finally {
      setSending(false);
    }
  };

  const doClose = async () => {
    setActing(true);
    try { await closeTicket(ticketId); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setActing(false); }
  };
  const doReopen = async () => {
    setActing(true);
    try { await reopenTicket(ticketId); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setActing(false); }
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="flex items-center justify-between">
        <Link href="/tools/tickets" className="inline-flex items-center text-[13px] text-[#5b5f94] hover:text-cocm-ink">
          {ticketStrings.backToList[lang]}
        </Link>
        <button
          onClick={load}
          className="rounded-[10px] border border-cocm-ink/10 bg-white px-3 py-1.5 text-[12px] font-medium text-[#5b5f94] hover:border-cocm-ink/25"
        >
          {STR.refresh[lang]}
        </button>
      </div>

      {loading || !ticket ? (
        <div className="mt-3 rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.loading[lang]}
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-[16px] border border-cocm-ink/10 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-bold text-cocm-red">#{ticket.number}</span>
              <KindBadge kind={ticket.kind} lang={lang} />
              <StatusBadge status={ticket.status} lang={lang} />
              <span className="ml-auto text-[11px] text-[#5b5f94]">
                {ticket.creator_name || ''} · {fmtTime(ticket.created_at, lang)}
              </span>
            </div>
            <p className="mt-2 text-[16px] font-semibold text-cocm-ink">{ticket.title}</p>

            {ticket.preview_url && (
              <a
                href={ticket.preview_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block rounded-[10px] border border-cocm-ink/15 bg-[#f4f2fa] px-3.5 py-2.5 text-[13px] text-cocm-ink hover:border-cocm-ink/40"
              >
                <span className="font-semibold">🔍 {STR.previewLink[lang]}</span>
                <span className="mt-0.5 block break-all text-[12px] text-[#5b5f94] underline">{ticket.preview_url}</span>
              </a>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {ticket.status === 'review' && (
                <>
                  <button
                    className="inline-flex h-8 items-center rounded-[10px] bg-cocm-ink px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    disabled={acting}
                    onClick={doClose}
                  >
                    {STR.closeTicket[lang]}
                  </button>
                  <span className="text-[11px] text-[#5b5f94]">{STR.closeHint[lang]}</span>
                </>
              )}
              {ticket.status === 'closed' && (
                <button
                  className="inline-flex h-8 items-center rounded-[10px] border border-cocm-ink/15 bg-white px-4 text-[13px] font-medium text-cocm-ink hover:border-cocm-ink/40 disabled:opacity-50"
                  disabled={acting}
                  onClick={doReopen}
                >
                  {STR.reopen[lang]}
                </button>
              )}
              {ticket.status === 'blocked' && (
                <p className="text-[12px] leading-relaxed text-[#b3261e]">{STR.blockedHint[lang]}</p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} lang={lang} />
            ))}
          </div>

          {ticket.status !== 'closed' ? (
            <div className="mt-4 rounded-[16px] border border-cocm-ink/10 bg-white p-4">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder={STR.notePh[lang]}
                className="w-full rounded-[10px] border border-cocm-ink/10 bg-white px-3 py-2 text-[13px] text-cocm-ink outline-none focus:border-cocm-ink/40"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="ml-auto inline-flex h-8 items-center rounded-[10px] bg-cocm-ink px-4 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  disabled={sending}
                  onClick={send}
                >
                  {sending ? STR.sending[lang] : STR.send[lang]}
                </button>
              </div>
              {err && <p className="mt-2 text-[12px] text-cocm-red">{err}</p>}
            </div>
          ) : (
            <p className="mt-4 text-center text-[12px] text-[#5b5f94]">{STR.closedHint[lang]}</p>
          )}
        </>
      )}
    </div>
  );
}
