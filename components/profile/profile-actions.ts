'use server';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ProfileActionResult = { ok: boolean; error?: string };

/** Update the current user's display name. Returns JSON (no redirect) for use in dialogs. */
export async function updateDisplayNameAction(name: string): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }

  const displayName = name.trim();
  if (!displayName) return { ok: false, error: 'missing-fields' };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'unavailable' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== session.userId) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id);
  if (error) return { ok: false, error: 'error' };

  await supabase.auth.updateUser({ data: { display_name: displayName } });
  return { ok: true };
}

/** Update the current user's password. Returns JSON (no redirect) for use in dialogs. */
export async function updatePasswordAction(password: string): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }
  if (password.length < 6) return { ok: false, error: 'too-short' };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'unavailable' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== session.userId) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: 'error' };
  return { ok: true };
}
