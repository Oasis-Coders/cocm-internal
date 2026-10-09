'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrlRef = useRef<string>('');

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  const start = useCallback(() => {
    clearTimers();
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
      setProgress(15);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 88) return p;
          const inc = p < 40 ? 12 : p < 70 ? 6 : 2;
          return Math.min(88, p + inc + Math.random() * 3);
        });
      }, 180);
    }, 80);
  }, [clearTimers]);

  const complete = useCallback(() => {
    clearTimers();
    if (!visible && !showTimerRef.current) {
      setProgress(0);
      return;
    }
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }, [clearTimers, visible]);

  // Complete when route changes (pathname or query)
  useEffect(() => {
    const current = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
    if (prevUrlRef.current && prevUrlRef.current !== current) {
      complete();
    }
    prevUrlRef.current = current;
  }, [pathname, complete]);

  // Also watch for URL changes via interval (catches searchParams changes)
  useEffect(() => {
    const check = () => {
      const current = window.location.pathname + window.location.search;
      if (prevUrlRef.current && prevUrlRef.current !== current) {
        complete();
        prevUrlRef.current = current;
      }
    };
    const id = setInterval(check, 100);
    return () => clearInterval(id);
  }, [complete]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {}
      start();
    };
    const handleSubmit = () => start();

    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    window.addEventListener('popstate', start);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('submit', handleSubmit);
      window.removeEventListener('popstate', start);
    };
  }, [start]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => complete(), 4000);
    return () => clearTimeout(t);
  }, [visible, complete]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!visible && progress === 0) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-cocm-red transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
