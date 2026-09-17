import Image from 'next/image';

import { signOut } from '@/app/auth/sign-out-action';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { LanguageSwitcherDark } from '@/components/layout/language-switcher';
import { ProfileDialog } from '@/components/profile/profile-dialog';
import type { LocalizedNavItem, Lang } from '@/lib/app-config';
import { cn } from '@/lib/utils';

type SidebarPanelProps = {
  items: LocalizedNavItem[];
  displayName: string;
  email: string;
  roleLabel: string;
  avatarInitial: string;
  signOutLabel: string;
  lang: Lang;
  className?: string;
};

export function SidebarPanel({
  items,
  displayName,
  email,
  roleLabel,
  avatarInitial,
  signOutLabel,
  lang,
  className,
}: SidebarPanelProps) {
  const isZh = lang !== 'en';

  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#363a9e_0%,#2d2f92_42%,#22235c_100%)] text-white shadow-[0_20px_60px_rgba(45,47,146,0.25)] lg:rounded-[24px]',
        className
      )}
    >
      {/* Header with gradient orbs */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-cocm-red/20 blur-[20px]" />
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-[#3f43a8] blur-[16px]" />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-br from-cocm-red/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="relative px-5 py-6">
          <div className="flex items-center gap-3">
            <Image
              src="/cocm-logo.png"
              alt="COCM"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full bg-white object-cover ring-1 ring-white/20"
              priority
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-tight tracking-tight">
                {lang === 'zh-Hant' ? '內部系統' : isZh ? '内部系统' : 'COCM Internal'}
              </p>
              <span className="text-[11px] font-medium tracking-wide opacity-60">
                {lang === 'zh-Hant' ? 'COCM 內部' : isZh ? 'COCM 内部' : 'Internal System'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav items={items} />
      </div>

      {/* Footer: profile dialog + sign out + language */}
      <div className="space-y-2 border-t border-white/[0.08] px-3 py-3 backdrop-blur-sm">
        <ProfileDialog
          displayName={displayName}
          email={email}
          roleLabel={roleLabel}
          avatarInitial={avatarInitial}
        />
        <form action={signOut}>
          <button
            type="submit"
            className="group flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-[12px] font-medium text-white/60 transition-[background-color,color] hover:bg-white/10 hover:text-white"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path
                d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M11 11l3-3-3-3M13 8H6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {signOutLabel}
          </button>
        </form>
        <div className="px-0 pt-1">
          <LanguageSwitcherDark lang={lang} />
        </div>
      </div>
    </div>
  );
}
