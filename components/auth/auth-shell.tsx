import Image from 'next/image';
import type { ReactNode } from 'react';

import type { Lang } from '@/lib/i18n/translations';

type AuthShellProps = {
  lang: Lang;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function featureList(lang: Lang): string[] {
  return lang === 'zh-Hant'
    ? ['聚餐報名，一鍵參加', '費用結算，清晰透明', '成員管理，權限分明']
    : lang === 'zh'
      ? ['聚餐报名，一键参加', '费用结算，清晰透明', '成员管理，权限分明']
      : ['One-tap meal signups', 'Clear expense settlement', 'Role-based member access'];
}

/**
 * Bookstore-style split-screen auth shell.
 * Left: deep-blue branding panel (desktop only) with blur orbs, logo,
 * serif headline, feature bullets and copyright.
 * Right: paper background form column with mobile branding on top.
 */
export function AuthShell({ lang, title, subtitle, children }: AuthShellProps) {
  const isZh = lang !== 'en';
  const brand =
    lang === 'zh-Hant' ? 'COCM 內部系統' : lang === 'zh' ? 'COCM 内部系统' : 'COCM Internal';

  return (
    <div className="flex min-h-screen w-full">
      {/* Left — branding panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-cocm-blue lg:flex">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-[#3f43a8] opacity-60 blur-[80px]" />
          <div className="absolute -bottom-[15%] -right-[10%] h-[70%] w-[70%] rounded-full bg-cocm-red opacity-30 blur-[100px]" />
          <div className="absolute right-[10%] top-[30%] h-[40%] w-[40%] rounded-full bg-[#5b5f94] opacity-40 blur-[60px]" />
        </div>
        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Image
              src="/cocm-logo.png"
              alt="COCM"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20"
              priority
            />
            <span className="font-serif text-[20px] tracking-tight text-white">{brand}</span>
          </div>

          <div className="space-y-6">
            <h1 className="font-serif text-[42px] leading-[1.15] text-white">
              {lang === 'zh-Hant' ? '把教會' : isZh ? '把教会' : 'Run your'}
              <br />
              <span className="text-[#f4d7c4]">
                {lang === 'zh-Hant' ? '內部事務' : isZh ? '内部事务' : 'ministry ops'}
              </span>
              <br />
              {lang === 'zh-Hant' ? '打理得井井有條' : isZh ? '打理得井井有条' : 'with ease'}
            </h1>
            <p className="max-w-[360px] text-[15px] leading-relaxed text-white/60">
              {lang === 'zh-Hant'
                ? '聚餐報名、費用結算、成員管理，一站式內部協作平台。'
                : isZh
                  ? '聚餐报名、费用结算、成员管理，一站式内部协作平台。'
                  : 'Meal signups, expense settlement, member management — one internal hub.'}
            </p>
            <ul className="space-y-2.5 pt-2">
              {featureList(lang).map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[13px] text-white/70">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-cocm-red"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} {brand}
          </p>
        </div>
      </div>

      {/* Right — form column */}
      <div className="brand-wash-bg flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Image
              src="/cocm-logo.png"
              alt="COCM"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-cocm-blue/10"
              priority
            />
            <span className="font-serif text-[18px] text-cocm-blue">{brand}</span>
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-[28px] tracking-tight text-cocm-ink">{title}</h2>
            {subtitle ? <p className="mt-2 text-[13px] text-cocm-slate">{subtitle}</p> : null}
          </div>

          {children}

          <div className="mt-8 text-center text-[11px] text-cocm-slate/60">
            {lang === 'zh-Hant'
              ? '安全登錄 · 數據加密'
              : isZh
                ? '安全登录 · 数据加密'
                : 'Secure login · Encrypted data'}
          </div>
        </div>
      </div>
    </div>
  );
}
