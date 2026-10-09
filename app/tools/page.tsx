import Link from 'next/link';
import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { isTicketAdmin } from './tickets/actions';
import { resolveLang, type Lang } from '@/lib/i18n/translations';
import { ticketStrings } from './tickets/ticket-ui';

const TITLE: Record<Lang, string> = { zh: '工具', 'zh-Hant': '工具', en: 'Tools' };
const EYEBROW: Record<Lang, string> = {
  zh: '问题申报与小工具',
  'zh-Hant': '問題申報與小工具',
  en: 'Issue reports and utilities',
};
const CARD_TITLE: Record<Lang, string> = { zh: '问题申报', 'zh-Hant': '問題申報', en: 'Issue Reports' };
const CARD_DESC: Record<Lang, string> = {
  zh: '缺陷和需求提报，提交后助手自动跟进处理。',
  'zh-Hant': '缺陷和需求提報，提交後助手自動跟進處理。',
  en: 'File bugs and feature requests; the assistant picks them up automatically.',
};
const OPEN: Record<Lang, string> = { zh: '进入 →', 'zh-Hant': '進入 →', en: 'Open →' };

/** 工具：一页式小工具的入口（目前只有问题申报） */
export default async function ToolsPage() {
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  // 服务端门控：问题申报卡片非管理员在 HTML 里根本看不到
  const showTickets = await isTicketAdmin();

  return (
    <AppShell title={TITLE[lang]} eyebrow={EYEBROW[lang]}>
      <div className="mx-auto grid max-w-[900px] gap-4 sm:grid-cols-3">
        {showTickets && (
          <Link href="/tools/tickets">
            <div className="flex h-full flex-col rounded-[16px] border border-cocm-ink/10 bg-white p-5 transition-shadow hover:shadow-[0_4px_16px_rgba(45,47,146,0.15)]">
              <span className="text-[28px]">🎫</span>
              <p className="mt-3 text-[15px] font-semibold text-cocm-ink">{CARD_TITLE[lang]}</p>
              <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-[#5b5f94]">{CARD_DESC[lang]}</p>
              <span className="mt-3 text-[12px] font-medium text-cocm-red">{OPEN[lang]}</span>
            </div>
          </Link>
        )}
        {!showTickets && (
          <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94] sm:col-span-3">
            {ticketStrings.adminOnly[lang]}
          </div>
        )}
      </div>
    </AppShell>
  );
}
