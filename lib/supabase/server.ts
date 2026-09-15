import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { hasSupabaseEnv } from '@/lib/supabase/env';

export async function createSupabaseServerClient(options?: {
  auth?: { flowType?: 'implicit' | 'pkce' };
  /** When true, auth cookies are set as browser-session cookies (no maxAge),
   *  so the login ends when the browser closes. Default is persistent. */
  sessionOnly?: boolean;
}) {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  const stripPersistent = (opts?: CookieToSet['options']) => {
    if (!options?.sessionOnly || !opts) return opts;
    const rest = { ...(opts as Record<string, unknown>) };
    delete rest.maxAge;
    delete rest.expires;
    return rest as CookieToSet['options'];
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, stripPersistent(options));
            });
          } catch {
            // Server Components can read session cookies but cannot refresh them.
            // Middleware already refreshes Supabase auth cookies before render.
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      ...(options?.auth ? { auth: options.auth } : {}),
    }
  );
}
