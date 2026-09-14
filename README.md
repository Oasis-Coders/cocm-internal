# COCM Internal

COCM 内部系统 — 教会内部工作台。首个正式功能将是用餐报名（聚餐发布、一键报名、人数统计）与月底结算。当前为基础脚手架：登录/注册、角色权限、布局、仪表盘、管理后台。

## 技术栈

- Next.js 15 (App Router) + React 19 + Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- 中英双语 UI（默认中文，可切换）

## 与书店系统共享 Supabase

本项目**没有**自己的 Supabase 项目。它与 COCM Bookstore 共用同一个 Supabase 项目：

- 同一个 `auth.users` — **一个账号可以登录书店和内部系统两个客户端**
- 共享 `profiles` / `roles` / `user_roles` 表（由书店侧 migration 创建和维护）
- 本项目的 migration 只添加自己域的表（`meals`、`meal_signups`），绝不改动共享表

## 本地开发

```bash
cp .env.example .env.local
# 填入与书店系统相同的三个 Supabase 环境变量
pnpm install
pnpm dev
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 本地开发 |
| `pnpm build` | 生产构建 |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |

## 页面

- `/` — 按登录状态跳转 `/dashboard` 或 `/sign-in`
- `/sign-in`、`/sign-up` — 邮箱密码登录/注册
- `/dashboard` — 欢迎面板 + 占位统计卡
- `/meals` — 用餐报名（占位，功能待产品确认后开发）
- `/profile` — 显示名称、邮箱/密码修改
- `/admin` — 用户管理（查看成员、super_admin 分配角色）

## 角色

`super_admin` / `admin` / `staff`（与书店一致）。新用户注册后由共享的 `handle_new_user()` 触发器自动建 profile 并分配 `staff`（首个用户为 `super_admin`）。

## 路线图

- [x] 基础脚手架（auth、角色、布局、双语、管理后台）
- [x] `meals` / `meal_signups` 表 + RLS
- [ ] 用餐报名：发布聚餐、报名/带人数、截止锁定、人数统计
- [ ] 月底结算：按 人数 × 单价 汇总、导出
- [ ] 待产品细节确认：餐费模式、带家属规则、发布频率、是否在线收款
