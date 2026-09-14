'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { translations, type Lang } from '@/lib/i18n/translations';

const VALID_TYPES: EmailOtpType[] = [
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'email',
];

function readLang(): Lang {
  if (typeof document === 'undefined') {
    return 'zh';
  }
  return document.cookie.split(';').some((c) => c.trim() === 'lang=en') ? 'en' : 'zh';
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const t = translations[readLang()].auth;

  useEffect(() => {
    let done = false;
    const succeed = () => {
      if (!done) {
        done = true;
        // Clean the token out of the URL, then land on the new-password form.
        window.history.replaceState({}, document.title, '/auth/confirm');
        router.replace('/reset-password');
      }
    };
    const fail = () => {
      if (!done) {
        done = true;
        setFailed(true);
      }
    };

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      fail();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash') ?? params.get('token');
    const type = params.get('type') as EmailOtpType | null;

    // Case 1: token hash in the query string (?token_hash=&type=).
    // Self-contained: no PKCE verifier needed, works across devices.
    if (token_hash && type && VALID_TYPES.includes(type)) {
      supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
        if (error) {
          fail();
        } else {
          succeed();
        }
      });
      return;
    }

    // Case 2: session tokens in the URL fragment (#access_token=...).
    // The browser client auto-detects them (detectSessionInUrl).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        succeed();
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        succeed();
      }
    });
    const timer = setTimeout(fail, 8000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#e4e5fb_0%,_#faf7f0_45%,_#f5efdc_100%)] px-4">
      <div className="w-full max-w-md rounded-panel bg-white p-8 text-center shadow-panel">
        {failed ? (
          <>
            <h1 className="font-serif text-2xl text-cocm-ink">{t.resetLinkInvalid}</h1>
            <p className="mt-6 text-sm text-cocm-slate">
              <Link
                href="/forgot-password"
                className="font-semibold text-cocm-red underline underline-offset-2"
              >
                {t.requestNewLink}
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-cocm-ink">{t.verifyingLink ?? '…'}</h1>
            <p className="mt-3 text-sm text-cocm-slate">{t.verifyingLinkDesc ?? ''}</p>
          </>
        )}
      </div>
    </main>
  );
}
