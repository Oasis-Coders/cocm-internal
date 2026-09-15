import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

const protectedPrefixes = ['/dashboard', '/meals', '/profile', '/admin'];

const staffOnlyPrefixes = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(signInUrl);
  }

  const response = NextResponse.next({
    request,
  });

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  // "Remember me" choice from sign-in: '0' means session-only cookies.
  const rememberChoice = request.cookies.get('cocm_remember')?.value;
  const sessionOnly = rememberChoice === '0';

  const stripPersistent = (opts?: CookieToSet['options']) => {
    if (!sessionOnly || !opts) return opts;
    const rest = { ...(opts as Record<string, unknown>) };
    delete rest.maxAge;
    delete rest.expires;
    return rest as CookieToSet['options'];
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, stripPersistent(options));
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(signInUrl);
  }

  const needsStaff = staffOnlyPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (needsStaff) {
    const { data, error } = await supabase.rpc('has_any_role', {
      role_names: ['staff', 'admin', 'super_admin', 'user'],
    });

    if (error || !data) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/meals/:path*', '/profile/:path*', '/admin/:path*'],
};
