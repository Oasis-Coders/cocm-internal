'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Lang } from '@/lib/i18n/translations';
import { createTicket, type TicketKind } from '../actions';
import { KIND_META, ticketStrings } from '../ticket-ui';

const KINDS: TicketKind[] = ['bug', 'feature', 'other'];

const STR: Record<string, Record<Lang, string>> = {
  newTitle: { zh: '新建工单', 'zh-Hant': '新建工單', en: 'New ticket' },
  intro: {
    zh: '描述你想改的地方。提交后助手会自动开始处理，并在工单里更新进度。',
    'zh-Hant': '描述你想改的地方。提交後助手會自動開始處理，並在工單裡更新進度。',
    en: 'Describe what you want changed. The assistant will pick it up automatically and post progress here.',
  },
  type: { zh: '类型', 'zh-Hant': '類型', en: 'Type' },
  title: { zh: '标题', 'zh-Hant': '標題', en: 'Title' },
  titlePh: { zh: '一句话概括，比如：用餐报名页加载太慢', 'zh-Hant': '一句話概括', en: 'One-line summary' },
  details: { zh: '详细描述', 'zh-Hant': '詳細描述', en: 'Details' },
  detailsPh: { zh: '哪里不对 / 想要什么效果，越具体越好…', 'zh-Hant': '哪裡不對 / 想要什麼效果，越具體越好…', en: 'What is wrong / what you want…' },
  titleRequired: { zh: '请填写标题', 'zh-Hant': '請填寫標題', en: 'Title is required' },
  submitting: { zh: '提交中…', 'zh-Hant': '提交中…', en: 'Submitting…' },
  submit: { zh: '提交工单', 'zh-Hant': '提交工單', en: 'Submit ticket' },
  submitFailed: { zh: '提交失败', 'zh-Hant': '提交失敗', en: 'Submit failed' },
};

export function TicketNewClient({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [kind, setKind] = useState<TicketKind>('bug');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!title.trim()) { setErr(STR.titleRequired[lang]); return; }
    setBusy(true);
    setErr('');
    try {
      const { ticketId } = await createTicket({ kind, title, description: desc });
      router.push(`/tools/tickets/${ticketId}`);
    } catch (e: any) {
      setErr(e.message || STR.submitFailed[lang]);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link href="/tools/tickets" className="inline-flex items-center text-[13px] text-[#5b5f94] hover:text-cocm-ink">
        {ticketStrings.backToList[lang]}
      </Link>
      <div className="mt-3 rounded-[16px] border border-cocm-ink/10 bg-white p-5">
        <p className="text-[15px] font-semibold text-cocm-ink">{STR.newTitle[lang]}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#5b5f94]">{STR.intro[lang]}</p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-cocm-ink">{STR.type[lang]}</p>
            <div className="flex gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    kind === k
                      ? 'bg-cocm-ink text-white'
                      : 'border border-cocm-ink/10 bg-white text-[#5b5f94] hover:border-cocm-ink/25'
                  }`}
                >
                  {KIND_META[k][lang]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-cocm-ink">{STR.title[lang]}</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={STR.titlePh[lang]}
              className="w-full rounded-[10px] border border-cocm-ink/10 bg-white px-3 py-2 text-[13px] text-cocm-ink outline-none focus:border-cocm-ink/40"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-cocm-ink">{STR.details[lang]}</p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={5}
              placeholder={STR.detailsPh[lang]}
              className="w-full rounded-[10px] border border-cocm-ink/10 bg-white px-3 py-2 text-[13px] text-cocm-ink outline-none focus:border-cocm-ink/40"
            />
          </div>
        </div>

        {err && <p className="mt-3 text-[12px] text-cocm-red">{err}</p>}
        <div className="mt-4 flex justify-end">
          <button
            className="inline-flex h-9 items-center rounded-[10px] bg-cocm-ink px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={submit}
          >
            {busy ? STR.submitting[lang] : STR.submit[lang]}
          </button>
        </div>
      </div>
    </div>
  );
}
