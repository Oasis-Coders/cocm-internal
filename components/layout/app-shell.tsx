import Image from 'next/image';
import { cookies } from 'next/headers';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { localizeNavItem, navItems, type Lang } from '@/lib/app-config';
import { getSession } from '@/lib/auth/session';

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
        : lang === 'zh'
          ? '同工'
          : 'Staff';

  return (
    <div className="min-h-screen bg-cocm-paper text-cocm-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 lg:flex-row lg:px-8">
        <MobileSidebar>
          <div className="rounded-panel bg-cocm-ink p-5 text-white shadow-card">
            <div className="flex items-center gap-3">
              <Image
                src="/cocm-logo.png"
                alt="COCM"
                width={44}
                height={44}
                className="h-11 w-11 rounded-full bg-white object-cover"
                priority
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cocm-sky">
                  COCM
                </p>
                <h1 className="mt-1 font-serif text-2xl tracking-tight">
                  {lang === 'zh' ? '内部系统' : 'Internal'}
                </h1>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-card border border-cocm-ink/10 bg-white p-4 shadow-card">
            <p className="text-sm font-semibold text-cocm-ink">{session.displayName}</p>
            <p className="text-sm text-cocm-slate">{session.email}</p>
            <p className="mt-2 inline-flex rounded-[10px] bg-cocm-sand px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cocm-ink">
              {roleLabel}
            </p>
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <SidebarNav items={filteredNav} />

            {session.isAuthenticated && (
              <div className="mt-4 border-t border-cocm-ink/10 pt-4">
                <SignOutButton />
              </div>
            )}
          </div>
        </MobileSidebar>

        <main className="flex-1">
          <header className="border-cocm-ink/8 rounded-panel border bg-white p-6 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cocm-slate">
              {eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-cocm-ink">{title}</h2>
          </header>

          <section className="mt-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
