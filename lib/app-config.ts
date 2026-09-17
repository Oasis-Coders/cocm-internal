import type { Lang } from './i18n/translations';
export type { Lang };

export type AppRole = 'super_admin' | 'admin' | 'staff' | 'user';
export const appRoles: AppRole[] = ['super_admin', 'admin', 'staff', 'user'];
// 'user' currently has the same access as 'staff'; the two may diverge later.
export const staffPrivilegedRoles: AppRole[] = ['super_admin', 'admin', 'staff', 'user'];
export const adminPrivilegedRoles: AppRole[] = ['super_admin', 'admin'];

export type NavItem = {
  href: string;
  label: Record<Lang, string>;
  description: Record<Lang, string>;
  roles?: AppRole[];
};

export type LocalizedNavItem = {
  href: string;
  label: string;
  description: string;
};

export const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: { zh: '总览', 'zh-Hant': '總覽', en: 'Dashboard' },
    description: { zh: '总览', 'zh-Hant': '總覽', en: 'Operational overview' },
  },
  {
    href: '/meals',
    label: { zh: '用餐报名', 'zh-Hant': '用餐報名', en: 'Meals' },
    description: {
      zh: '聚餐报名与统计',
      'zh-Hant': '聚餐報名與統計',
      en: 'Meal signups and headcounts',
    },
  },
  {
    href: '/profile',
    label: { zh: '个人资料', 'zh-Hant': '個人資料', en: 'Profile' },
    description: { zh: '账号信息', 'zh-Hant': '賬號信息', en: 'Account details' },
  },
  {
    href: '/admin',
    label: { zh: '管理', 'zh-Hant': '管理', en: 'Admin' },
    description: { zh: '用户与权限', 'zh-Hant': '用戶與權限', en: 'Users and roles' },
    roles: staffPrivilegedRoles,
  },
];

export function localizeNavItem(
  item: Pick<NavItem, 'href' | 'label' | 'description'>,
  lang: Lang
): LocalizedNavItem {
  return {
    href: item.href,
    label: item.label[lang],
    description: item.description[lang],
  };
}
