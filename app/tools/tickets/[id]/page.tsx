import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { TicketDetailClient } from './ticket-detail-client';
import { isTicketAdmin } from '../actions';
import { resolveLang, type Lang } from '@/lib/i18n/translations';
import { ticketStrings } from '../ticket-ui';

const TITLE: Record<Lang, string> = { zh: '工单详情', 'zh-Hant': '工單詳情', en: 'Ticket detail' };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await isTicketAdmin();
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  return (
    <AppShell title={TITLE[lang]} eyebrow="Tickets">
      {ok ? (
        <TicketDetailClient ticketId={id} lang={lang} />
      ) : (
        <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.adminOnly[lang]}
        </div>
      )}
    </AppShell>
  );
}
