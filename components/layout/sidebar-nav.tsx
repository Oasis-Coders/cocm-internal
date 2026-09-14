'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { LocalizedNavItem } from '@/lib/app-config';
import { cn } from '@/lib/utils';

const SIDEBAR_SCROLL_KEY = 'cocm-sidebar-nav-scroll';

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: LocalizedNavItem[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Clear pending state when pathname changes (navigation completed)
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const savedScrollTop = window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY);

    if (savedScrollTop) {
      nav.scrollTop = Number(savedScrollTop);
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      onScroll={(event) => {
        window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop));
      }}
      className="flex flex-col gap-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
    >
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        const isPending = pendingHref === item.href && !isActive;
        const isHighlighted = isActive || isPending;

        return (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            onClick={() => {
              if (!isActive) {
                setPendingHref(item.href);
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[13.5px] font-medium transition-all duration-200',
              isHighlighted
                ? 'bg-white font-semibold text-cocm-ink shadow-[0_2px_12px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
            )}
          >
            <span
              className={cn(
                'h-[6px] w-[6px] shrink-0 rounded-full transition-all duration-200',
                isHighlighted
                  ? 'bg-cocm-red shadow-[0_0_8px_rgba(229,68,76,0.5)]'
                  : 'bg-white/30 group-hover:scale-110 group-hover:bg-white/60'
              )}
            />
            <span className="flex-1 tracking-[-0.01em]">{item.label}</span>
            {isPending && !isActive ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cocm-red/70" />
            ) : null}
            {isActive ? <span className="h-1 w-1 animate-pulse rounded-full bg-cocm-red" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
