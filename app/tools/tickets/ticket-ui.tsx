'use client';

import type { Lang } from '@/lib/i18n/translations';
import type { TicketStatus, TicketKind } from './actions';

export const STATUS_META: Record<TicketStatus, Record<Lang, string> & { cls: string }> = {
  submitted: { zh: '待处理', 'zh-Hant': '待處理', en: 'Submitted', cls: 'bg-[#e8eaf6] text-[#5b5f94]' },
  in_progress: { zh: '处理中', 'zh-Hant': '處理中', en: 'In progress', cls: 'bg-[#fff3d6] text-[#9a6b00]' },
  review: { zh: '待确认', 'zh-Hant': '待確認', en: 'In review', cls: 'bg-[#d9ecff] text-[#0b5cad]' },
  blocked: { zh: '已阻塞', 'zh-Hant': '已阻塞', en: 'Blocked', cls: 'bg-[#ffd9d9] text-[#b3261e]' },
  closed: { zh: '已关闭', 'zh-Hant': '已關閉', en: 'Closed', cls: 'bg-[#e4e4e4] text-[#6b6b6b]' },
};

export const KIND_META: Record<TicketKind, Record<Lang, string> & { cls: string }> = {
  bug: { zh: '缺陷', 'zh-Hant': '缺陷', en: 'Bug', cls: 'bg-[#ffd9d9] text-[#b3261e]' },
  feature: { zh: '需求', 'zh-Hant': '需求', en: 'Feature', cls: 'bg-[#d9ecff] text-[#0b5cad]' },
  other: { zh: '其他', 'zh-Hant': '其他', en: 'Other', cls: 'bg-[#e8eaf6] text-[#5b5f94]' },
};

export function StatusBadge({ status, lang }: { status: TicketStatus; lang: Lang }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
      {m[lang]}
    </span>
  );
}

export function KindBadge({ kind, lang }: { kind: TicketKind; lang: Lang }) {
  const m = KIND_META[kind];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
      {m[lang]}
    </span>
  );
}

/** 三语小字典：工单 UI 共用 */
export const ticketStrings = {
  adminOnly: { zh: '问题申报仅对管理员开放', 'zh-Hant': '問題申報僅對管理員開放', en: 'Issue reports are visible to admins only' },
  loading: { zh: '加载中…', 'zh-Hant': '載入中…', en: 'Loading…' },
  all: { zh: '全部', 'zh-Hant': '全部', en: 'All' },
  newTicket: { zh: '＋ 新建工单', 'zh-Hant': '＋ 新建工單', en: '+ New ticket' },
  noTickets: { zh: '暂无工单', 'zh-Hant': '暫無工單', en: 'No tickets yet' },
  messages: { zh: '条消息', 'zh-Hant': '條消息', en: 'messages' },
  backToList: { zh: '← 返回工单列表', 'zh-Hant': '← 返回工單列表', en: '← Back to tickets' },
} satisfies Record<string, Record<Lang, string>>;
