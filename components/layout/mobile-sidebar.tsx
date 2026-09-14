'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      {/* Mobile hamburger — only visible below lg */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-controls="mobile-drawer"
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-[12px] bg-cocm-ink text-white shadow-lg transition hover:bg-cocm-ink-light lg:hidden"
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', isOpen ? 'visible' : 'invisible')}>
        <button
          type="button"
          aria-label="Close navigation"
          aria-hidden={!isOpen}
          tabIndex={isOpen ? 0 : -1}
          onClick={close}
          className={cn(
            'absolute inset-0 cursor-default bg-cocm-ink/40 backdrop-blur-sm transition-opacity',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          id="mobile-drawer"
          className={cn(
            'absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-cocm-ink overscroll-contain transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {children}
        </div>
      </div>

      {/* Desktop floating sidebar — only visible at lg+ */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[272px] shrink-0 lg:block">
        {children}
      </aside>
    </>
  );
}
