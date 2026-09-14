import { cookies } from 'next/headers';

import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { SidebarPanel } from '@/components/layout/sidebar-panel';
import { localizeNavItem, navItems, type Lang } from '@/lib/app-config';
import { getSession } from '@/lib/auth/session';
import { translations } from '@/lib/i18n/translations';

type AppShellProps = {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
};

async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get('lang')?.value === 'en' ? 'en' : 'zh';
}

export async function AppShell({ title, eyebrow, children }: AppShellProps) {
  const session = await getSession();
  const lang = await getLang();
  const t = translations[lang];

  const filteredNav = navItems
    .filter(
      (item) => session.isAuthenticated && (!item.roles || item.roles.includes(session.role))
    )
    .map((item) => localizeNavItem(item, lang));

  const roleLabel =
    session.role === 'super_admin'
      ? lang === 'zh'
        ? '超级管理员'
        : 'Super Admin'
      : session.role === 'admin'
        ? lang === 'zh'
          ? '管理员'
          : 'Admin'
        : session.role === 'user'
          ? lang === 'zh'
            ? '用户'
            : 'User'
          : lang === 'zh'
            ? '同工'
            : 'Staff';

  const displayName = session.displayName || '';
  const avatarInitial =
    displayName.trim().charAt(0).toUpperCase() ||
    session.email.trim().charAt(0).toUpperCase() ||
    'C';

  return (
    <div className="min-h-screen bg-cocm-paper text-cocm-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[10px] focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-cocm-ink focus:shadow-lg"
      >
        {lang === 'zh' ? '跳到主内容' : 'Skip to main content'}
      </a>
      <div className="mx-auto flex max-w-[1600px] lg:gap-6 lg:px-6 lg:py-4">
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
          <div className="sticky top-0 z-10 -mt-px border-b border-cocm-ink/5 bg-cocm-paper/80 backdrop-blur-xl lg:rounded-t-[20px] lg:border lg:border-cocm-ink/5">
            <div className="flex items-center justify-between py-4 pl-16 pr-4 lg:px-8 lg:py-6 lg:pl-8">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cocm-red">
                  {eyebrow}
                </p>
                <h1 className="font-serif text-[24px] leading-none tracking-tight text-cocm-ink lg:text-[28px]">
                  {title}
                </h1>
              </div>
            </div>
          </div>
          <div className="px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
