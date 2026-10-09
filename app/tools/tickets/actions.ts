'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { adminPrivilegedRoles } from '@/lib/app-config';

// 问题申报（ticket，内部系统）：super_admin / admin 可见可操作。工单状态由 agent 跟进：
// submitted → in_progress → review → closed（用户确认），危险操作 agent 会设为 blocked 等 Luke 拍板。
// 需要改代码的工单在独立分支（branch）实现，用户在 preview_url 验收，
// 确认关闭后 watcher 把分支合并到 main（branch_merged=true）。
// 本应用只读写 app='internal' 的工单（与书库 app='bookstore' 隔离）。

export type TicketStatus = 'submitted' | 'in_progress' | 'review' | 'blocked' | 'closed';
export type TicketKind = 'bug' | 'feature' | 'other';

export type TicketRow = {
  id: string;
  number: number;
  title: string;
  kind: TicketKind;
  description: string;
  status: TicketStatus;
  created_by: string;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  branch: string | null;
  preview_url: string | null;
  branch_merged: boolean;
};

export type TicketMessageRow = {
  id: string;
  ticket_id: string;
  author_type: 'user' | 'agent';
  author_name: string;
  body: string;
  image_urls: string[];
  created_at: string;
};

async function assertTicketAdmin() {
  const session = await getSession();
  if (!session.isAuthenticated) throw new Error('请先登录');
  if (!adminPrivilegedRoles.includes(session.role)) throw new Error('需要管理员权限');
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error('数据库未连接');
  return { supabase, session };
}

/** 服务端页面门控用：当前用户是否为 admin / super_admin（不抛异常） */
export async function isTicketAdmin(): Promise<boolean> {
  try {
    await assertTicketAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function listTickets(status: string): Promise<TicketRow[]> {
  const { supabase } = await assertTicketAdmin();
  let q = supabase
    .from('tickets')
    .select('*')
    .eq('app', 'internal')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by))];
  let nameMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds);
    for (const p of (profs || []) as any[]) nameMap[p.id] = p.display_name || '';
  }
  const counts = await Promise.all(
    rows.map((r) =>
      supabase.from('ticket_messages').select('id', { count: 'exact', head: true }).eq('ticket_id', r.id)
    )
  );
  return rows.map((r, i) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    kind: r.kind,
    description: r.description,
    status: r.status,
    created_by: r.created_by,
    creator_name: nameMap[r.created_by] || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: counts[i].count || 0,
    branch: r.branch || null,
    preview_url: r.preview_url || null,
    branch_merged: !!r.branch_merged,
  }));
}

export async function getTicket(id: string): Promise<{ ticket: TicketRow; messages: TicketMessageRow[] } | null> {
  const { supabase } = await assertTicketAdmin();
  const { data: t, error } = await supabase.from('tickets').select('*').eq('id', id).eq('app', 'internal').single();
  if (error || !t) return null;
  const { data: msgs } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });
  let creator_name: string | null = null;
  const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', t.created_by).single();
  if (prof) creator_name = (prof as any).display_name || null;
  const { count } = await supabase.from('ticket_messages').select('id', { count: 'exact', head: true }).eq('ticket_id', id);
  return {
    ticket: {
      id: t.id, number: t.number, title: t.title, kind: t.kind, description: t.description,
      status: t.status, created_by: t.created_by, creator_name, created_at: t.created_at,
      updated_at: t.updated_at, message_count: count || 0,
      branch: t.branch || null, preview_url: t.preview_url || null, branch_merged: !!t.branch_merged,
    },
    messages: ((msgs || []) as any[]).map((m) => ({
      id: m.id, ticket_id: m.ticket_id, author_type: m.author_type, author_name: m.author_name,
      body: m.body, image_urls: m.image_urls || [], created_at: m.created_at,
    })),
  };
}

export async function createTicket(input: { kind: TicketKind; title: string; description: string }) {
  const { supabase, session } = await assertTicketAdmin();
  const title = input.title.trim();
  if (!title) throw new Error('请填写标题');
  const { data: t, error } = await supabase
    .from('tickets')
    .insert({ title, kind: input.kind, description: input.description.trim(), created_by: session.userId, app: 'internal' })
    .select('id')
    .single();
  if (error || !t) throw new Error(error?.message || '创建失败');
  const { data: m } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: t.id, author_type: 'user', author_id: session.userId,
      author_name: session.displayName || session.email || '管理员', body: input.description.trim(),
    })
    .select('id')
    .single();
  revalidatePath('/tools/tickets');
  return { ticketId: t.id as string, messageId: (m as any)?.id as string | undefined };
}

export async function postTicketMessage(ticketId: string, body: string) {
  const { supabase, session } = await assertTicketAdmin();
  const { data: t } = await supabase.from('tickets').select('id,status').eq('id', ticketId).eq('app', 'internal').single();
  if (!t) throw new Error('工单不存在');
  if ((t as any).status === 'closed') throw new Error('工单已关闭，请先重新打开');
  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticketId, author_type: 'user', author_id: session.userId,
    author_name: session.displayName || session.email || '管理员', body: body.trim(), image_urls: [],
  });
  if (error) throw new Error(error.message);
  await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
  revalidatePath(`/tools/tickets/${ticketId}`);
  return { ok: true };
}

export async function closeTicket(ticketId: string) {
  const { supabase, session } = await assertTicketAdmin();
  const { data: t } = await supabase.from('tickets').select('status').eq('id', ticketId).eq('app', 'internal').single();
  if (!t) throw new Error('工单不存在');
  if (!['review', 'blocked', 'in_progress', 'submitted'].includes((t as any).status)) throw new Error('当前状态不能关闭');
  await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticketId);
  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId, author_type: 'user', author_id: session.userId,
    author_name: session.displayName || session.email || '管理员', body: '已确认，关闭工单。',
  });
  revalidatePath(`/tools/tickets/${ticketId}`);
  return { ok: true };
}

export async function reopenTicket(ticketId: string) {
  const { supabase, session } = await assertTicketAdmin();
  const { data: t } = await supabase.from('tickets').select('status').eq('id', ticketId).eq('app', 'internal').single();
  if (!t) throw new Error('工单不存在');
  if ((t as any).status !== 'closed') throw new Error('工单未关闭');
  await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', ticketId);
  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId, author_type: 'user', author_id: session.userId,
    author_name: session.displayName || session.email || '管理员', body: '重新打开了工单。',
  });
  revalidatePath(`/tools/tickets/${ticketId}`);
  return { ok: true };
}
