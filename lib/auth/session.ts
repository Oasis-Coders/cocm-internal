import { staffPrivilegedRoles, type AppRole } from '@/lib/app-config';
import { normalizeRole, resolveDisplayName, roleRank } from '@/lib/auth/auth-utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export type SessionInfo = {
  isAuthenticated: boolean;
  role: AppRole;
  email: string;
  displayName: string;
  userId: string | null;
};

type RoleRow = {
  roles: { name: string } | { name: string }[] | null;
};

function pickPrimaryRole(rows: RoleRow[] | null): AppRole {
  const names = (rows ?? [])
    .flatMap((row) => {
      const r = row.roles;
      if (!r) return [];
      return (Array.isArray(r) ? r : [r]).map((x) => x?.name).filter(Boolean) as string[];
    })
    .map((name) => normalizeRole(name));

  if (names.length === 0) {
    // The shared handle_new_user() trigger assigns staff automatically; this
    // fallback only covers a brand-new session racing the trigger.
    return 'staff';
  }

  return names.sort((a, b) => roleRank(b) - roleRank(a))[0];
}

export async function getSession(): Promise<SessionInfo> {
  const anonymous: SessionInfo = {
    isAuthenticated: false,
    role: 'staff',
    email: '',
    displayName: '',
    userId: null,
  };

  if (!hasSupabaseEnv()) {
    return anonymous;
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return anonymous;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return anonymous;
  }

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('roles(name)').eq('user_id', user.id),
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const role = pickPrimaryRole(roleRows as RoleRow[] | null);

  return {
    isAuthenticated: true,
    role,
    email: (profile?.email as string | undefined) ?? user.email ?? '',
    displayName: resolveDisplayName({
      displayName: (profile?.display_name as string | undefined) ?? undefined,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? undefined,
      email: user.email ?? undefined,
    }),
    userId: user.id,
  };
}

export async function hasElevatedAccess() {
  const session = await getSession();
  return staffPrivilegedRoles.includes(session.role);
}
