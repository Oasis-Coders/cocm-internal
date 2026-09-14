import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { sanitizeRedirectTo } from '@/lib/auth/auth-utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

function fail(url: URL, redirectTo: string) {
  const signInUrl = new URL('/sign-in', url.origin);
  signInUrl.searchParams.set('error', 'callback');
  signInUrl.searchParams.set('redirectTo', redirectTo);
  return NextResponse.redirect(signInUrl);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = sanitizeRedirectTo(url.searchParams.get('redirectTo') ?? '/dashboard');
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (hasSupabaseEnv() && (code || (token_hash && type))) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      if (token_hash && type) {
        // Token-hash flow (email links): self-contained, no PKCE verifier
        // needed, works when clicked on a different device.
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });

        if (error) {
          return fail(url, redirectTo);
        }
      } else if (code) {
        // PKCE flow (OAuth): requires the code-verifier cookie from the same
        // browser that started the flow.
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          return fail(url, redirectTo);
        }
      }
    }
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
