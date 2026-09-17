import { cookies } from 'next/headers';

import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { SidebarPanel } from '@/components/layout/sidebar-panel';
import { localizeNavItem, navItems, type Lang } from '@/lib/app-config';
import { getSession } from '@/lib/auth/session';
import { resolveLang, translations } from '@/lib/i18n/translations';

type AppShellProps = {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
};

async function getLang(): Promise<Lang> {
  const store = await cookies();
  return resolveLang(store.get('lang')?.value);
}

export async function AppShell({ title, eyebrow, children }: AppShellProps) {
  const session = await getSession();
  const lang = await getLang();
  const t = translations[lang];

  const filteredNav = navItems
    .filter((item) => session.isAuthenticated && (!item.roles || item.roles.includes(session.role)))
    .map((item) => localizeNavItem(item, lang));

  const roleLabel =
    session.role === 'super_admin'
      ? lang === 'zh-Hant'
        ? '超級管理員'
        : lang === 'zh'
          ? '超级管理员'
          : 'Super Admin'
      : session.role === 'admin'
        ? lang === 'zh-Hant'
          ? '管理員'
          : lang === 'zh'
            ? '管理员'
            : 'Admin'
        : session.role === 'user'
          ? lang === 'zh-Hant'
            ? '用戶'
            : lang === 'zh'
              ? '用户'
              : 'User'
          : lang !== 'en'
            ? '同工'
            : 'Staff';

  const displayName = session.displayName || '';
  const avatarInitial =
    displayName.trim().charAt(0).toUpperCase() ||
    session.email.trim().charAt(0).toUpperCase() ||
    'C';

  return (
    <div className="brand-wash-bg min-h-screen text-cocm-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[10px] focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-cocm-ink focus:shadow-lg"
      >
        {lang === 'zh-Hant' ? '跳到主內容' : lang === 'zh' ? '跳到主内容' : 'Skip to main content'}
      </a>
      <div className="mx-auto flex w-full max-w-[1320px] lg:gap-6 lg:px-6 lg:py-6">
        <MobileSidebar>
          <SidebarPanel
            items={filteredNav}
            displayName={displayName}
            email={session.email}
            roleLabel={roleLabel}
            avatarInitial={avatarInitial}
            signOutLabel={t.common.signOut}
            lang={lang}
          />
        </MobileSidebar>

        <main id="main-content" className="min-w-0 flex-1">
          <div className="sticky top-0 z-10 border-b border-cocm-ink/5 bg-white/70 backdrop-blur-xl lg:top-6 lg:rounded-[20px] lg:border lg:border-white/60 lg:shadow-[0_10px_36px_rgba(31,33,71,0.08)]">
            <div className="flex items-center justify-between py-4 pl-16 pr-4 lg:px-8 lg:py-5 lg:pl-8">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cocm-red">
                  <span
                    className="h-[3px] w-6 rounded-full bg-gradient-to-r from-cocm-red to-cocm-red/10"
                    aria-hidden="true"
                  />
                  {eyebrow}
                </p>
                <h1 className="font-serif text-[26px] leading-none tracking-tight text-cocm-ink lg:text-[32px]">
                  {title}
                </h1>
              </div>
            </div>
          </div>
          <div className="px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1024px]">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
