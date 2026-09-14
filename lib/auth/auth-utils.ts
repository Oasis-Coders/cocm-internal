import type { AppRole } from '@/lib/app-config';

const defaultRole: AppRole = 'staff';

export function normalizeRole(value: string | undefined): AppRole {
  if (value === 'super_admin' || value === 'admin' || value === 'staff') {
    return value;
  }

  return defaultRole;
}

export function resolveDisplayName(input: {
  displayName?: string;
  fullName?: string;
  email?: string;
}): string {
  return input.displayName ?? input.fullName ?? input.email?.split('@')[0] ?? 'COCM user';
}

export function sanitizeRedirectTo(value: string | undefined, fallback = '/dashboard'): string {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}

export function buildSignUpMetadata(displayName: string) {
  return {
    display_name: displayName.trim() || undefined,
  };
}

export function roleRank(role: AppRole): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    case 'staff':
      return 1;
  }
}
