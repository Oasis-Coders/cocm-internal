import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { appRoles, type AppRole } from '@/lib/app-config';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { translations, type Lang } from '@/lib/i18n/translations';

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type UserRoleRow = {
  user_id: string;
  roles: { name: string }[] | { name: string } | null;
};

async function grantRole(formData: FormData) {
  'use server';

  const session = await getSession();
  if (!session.isAuthenticated || session.role !== 'super_admin') {
    redirect('/admin/users');
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/admin/users');

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as AppRole;

  if (!userId || !appRoles.includes(role)) redirect('/admin/users');

  const { data: roleRow } = await supabase.from('roles').select('id').eq('name', role).single();

  if (roleRow) {
    await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id,role_id' });
  }

  revalidatePath('/admin/users');
}

async function revokeRole(formData: FormData) {
  'use server';

  const session = await getSession();
  if (!session.isAuthenticated || session.role !== 'super_admin') {
    redirect('/admin/users');
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/admin/users');

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as AppRole;

  if (!userId || !appRoles.includes(role)) redirect('/admin/users');

  const { data: roleRow } = await supabase.from('roles').select('id').eq('name', role).single();

  if (roleRow) {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleRow.id);
  }

  revalidatePath('/admin/users');
}

function roleLabel(role: string, lang: Lang): string {
  if (lang === 'en') return role.replace('_', ' ');
  switch (role) {
    case 'super_admin':
      return '超级管理员';
    case 'admin':
      return '管理员';
    case 'staff':
      return '同工';
    default:
      return role;
  }
}

export default async function AdminUsersPage() {
  const session = await getSession();
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].admin;

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppShell title={t.users} eyebrow={t.eyebrow}>
        <EmptyState title={t.users} description={translations[lang].auth.supabaseUnavailable} />
      </AppShell>
    );
  }

  const [{ data: profiles }, { data: userRoles }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email').order('display_name'),
    supabase.from('user_roles').select('user_id, roles(name)'),
  ]);

  const roleRows = (userRoles ?? []) as unknown as UserRoleRow[];
  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows) {
    const roleEntries = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    for (const entry of roleEntries) {
      if (!entry?.name) continue;
      const list = rolesByUser.get(row.user_id) ?? [];
      list.push(entry.name);
      rolesByUser.set(row.user_id, list);
    }
  }

  const canManage = session.role === 'super_admin';
  const profileRows = (profiles ?? []) as ProfileRow[];

  return (
    <AppShell title={t.users} eyebrow={t.eyebrow}>
      {!canManage ? (
        <p className="mb-4 rounded-xl border border-cocm-ink/10 bg-white px-4 py-3 text-sm text-cocm-slate shadow-card">
          {t.onlySuperAdmin}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-cocm-ink/10 bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-cocm-ink/10 text-xs uppercase tracking-[0.15em] text-cocm-slate">
              <th className="px-5 py-4 font-semibold">{t.displayName}</th>
              <th className="px-5 py-4 font-semibold">{t.email}</th>
              <th className="px-5 py-4 font-semibold">{t.roles}</th>
              {canManage ? <th className="px-5 py-4 font-semibold">{t.grant}</th> : null}
            </tr>
          </thead>
          <tbody>
            {profileRows.map((profile) => {
              const roles = rolesByUser.get(profile.id) ?? [];
              return (
                <tr key={profile.id} className="border-b border-cocm-ink/5 last:border-0">
                  <td className="px-5 py-4 font-semibold text-cocm-ink">
                    {profile.display_name ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-cocm-slate">{profile.email ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {roles.length === 0 ? (
                        <span className="text-cocm-slate">—</span>
                      ) : (
                        roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center gap-1 rounded-full bg-cocm-ink-pale px-3 py-1 text-xs font-semibold text-cocm-ink"
                          >
                            {roleLabel(role, lang)}
                            {canManage ? (
                              <form action={revokeRole}>
                                <input type="hidden" name="userId" value={profile.id} />
                                <input type="hidden" name="role" value={role} />
                                <button
                                  type="submit"
                                  title={t.revoke}
                                  aria-label={`${t.revoke} ${roleLabel(role, lang)}`}
                                  className="ml-1 font-bold text-cocm-red hover:text-cocm-red-dark"
                                >
                                  ×
                                </button>
                              </form>
                            ) : null}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  {canManage ? (
                    <td className="px-5 py-4">
                      <form action={grantRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={profile.id} />
                        <select
                          name="role"
                          defaultValue=""
                          required
                          className="rounded-lg border border-cocm-ink/15 bg-white px-2 py-1.5 text-sm text-cocm-ink"
                          aria-label={t.grant}
                        >
                          <option value="" disabled>
                            {t.grant}…
                          </option>
                          {appRoles
                            .filter((r) => !roles.includes(r))
                            .map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r, lang)}
                              </option>
                            ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-cocm-red px-3 py-1.5 text-sm font-semibold text-white hover:bg-cocm-red-dark"
                        >
                          {t.grant}
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
