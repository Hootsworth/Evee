import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

async function getWorkItem(admin: ReturnType<typeof createAdminClient>, id: string, organizationId: string) {
  const { data, error } = await admin.from('work_items').select('id, organization_id, title')
    .eq('id', id).eq('organization_id', organizationId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const { id } = await params;
    const admin = createAdminClient();
    const item = await getWorkItem(admin, id, user.organizationId);
    if (!item) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });

    const [commentsRes, checklistRes, approvalsRes] = await Promise.all([
      admin.from('work_item_comments').select('*').eq('organization_id', user.organizationId).eq('work_item_id', id).order('created_at'),
      admin.from('work_item_checklist_items').select('*').eq('organization_id', user.organizationId).eq('work_item_id', id).order('checklist_name').order('position'),
      admin.from('work_item_approvals').select('*').eq('organization_id', user.organizationId).eq('work_item_id', id).order('requested_at', { ascending: false }),
    ]);
    if (commentsRes.error) return NextResponse.json({ error: commentsRes.error.message }, { status: 500 });
    if (checklistRes.error) return NextResponse.json({ error: checklistRes.error.message }, { status: 500 });
    if (approvalsRes.error) return NextResponse.json({ error: approvalsRes.error.message }, { status: 500 });

    const comments = commentsRes.data || [];
    const commentIds = comments.map((comment) => comment.id);
    const involvedIds = new Set<string>([
      ...comments.map((comment) => comment.author_id),
      ...(checklistRes.data || []).flatMap((row) => [row.created_by, row.completed_by].filter(Boolean) as string[]),
      ...(approvalsRes.data || []).flatMap((row) => [row.requested_by, row.approver_id, row.decided_by].filter(Boolean) as string[]),
    ]);
    const [mentionsRes, profilesRes] = await Promise.all([
      commentIds.length ? admin.from('work_item_mentions').select('comment_id, user_id').in('comment_id', commentIds) : Promise.resolve({ data: [], error: null }),
      involvedIds.size ? admin.from('profiles').select('id, display_name').in('id', [...involvedIds]) : Promise.resolve({ data: [], error: null }),
    ]);
    if (mentionsRes.error) return NextResponse.json({ error: mentionsRes.error.message }, { status: 500 });
    if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });

    const names = new Map((profilesRes.data || []).map((profile) => [profile.id, profile.display_name]));
    const mentionsByComment = new Map<string, string[]>();
    for (const mention of mentionsRes.data || []) mentionsByComment.set(mention.comment_id, [...(mentionsByComment.get(mention.comment_id) || []), mention.user_id]);
    return NextResponse.json({
      comments: comments.map((comment) => ({ ...comment, author_name: names.get(comment.author_id) || 'Workspace member', mention_ids: mentionsByComment.get(comment.id) || [] })),
      checklist: checklistRes.data || [],
      approvals: (approvalsRes.data || []).map((approval) => ({
        ...approval,
        requested_by_name: names.get(approval.requested_by) || 'Workspace member',
        approver_name: approval.approver_id ? names.get(approval.approver_id) || 'Workspace member' : null,
        decided_by_name: approval.decided_by ? names.get(approval.decided_by) || 'Workspace member' : null,
      })),
      userId: user.userId,
      role: user.role,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const { id } = await params;
    const body = await req.json();
    const admin = createAdminClient();
    const item = await getWorkItem(admin, id, user.organizationId);
    if (!item) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });

    if (body.action === 'comment') {
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if (!text || text.length > 4000) return NextResponse.json({ error: 'Comment must be between 1 and 4,000 characters.' }, { status: 400 });
      const mentionIds = [...new Set(Array.isArray(body.mentionIds) ? body.mentionIds.filter((value: unknown) => typeof value === 'string') : [])];
      if (mentionIds.length) {
        const { data: members, error } = await admin.from('organization_members').select('user_id').eq('organization_id', user.organizationId).in('user_id', mentionIds);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if ((members || []).length !== mentionIds.length) return NextResponse.json({ error: 'Mentioned people must belong to your workspace.' }, { status: 400 });
      }
      const { data: comment, error } = await admin.from('work_item_comments').insert({
        organization_id: user.organizationId, work_item_id: id, author_id: user.userId, body: text,
      }).select('*').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (mentionIds.length) {
        const { error: mentionError } = await admin.from('work_item_mentions').insert(mentionIds.map((userId) => ({
          organization_id: user.organizationId, comment_id: comment.id, user_id: userId,
        })));
        if (mentionError) {
          await admin.from('work_item_comments').delete().eq('id', comment.id).eq('organization_id', user.organizationId);
          return NextResponse.json({ error: mentionError.message }, { status: 500 });
        }
      }
      await admin.from('audit_events').insert({
        organization_id: user.organizationId, event_type: 'WORK_ITEM_COMMENTED', entity_type: 'work_items', entity_id: id,
        details: { commentId: comment.id, mentionIds, actorName: user.displayName },
      });
      return NextResponse.json({ comment: { ...comment, author_name: user.displayName, mention_ids: mentionIds } }, { status: 201 });
    }

    if (body.action === 'checklist_add') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const checklistName = typeof body.checklistName === 'string' && body.checklistName.trim() ? body.checklistName.trim() : 'Checklist';
      if (!title || title.length > 300 || checklistName.length > 120) return NextResponse.json({ error: 'Checklist title or item text is invalid.' }, { status: 400 });
      const { count, error: countError } = await admin.from('work_item_checklist_items').select('id', { count: 'exact', head: true })
        .eq('organization_id', user.organizationId).eq('work_item_id', id).eq('checklist_name', checklistName);
      if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
      const { data, error } = await admin.from('work_item_checklist_items').insert({
        organization_id: user.organizationId, work_item_id: id, checklist_name: checklistName,
        title, position: count || 0, created_by: user.userId,
      }).select('*').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ checklistItem: data }, { status: 201 });
    }

    if (body.action === 'checklist_toggle') {
      if (typeof body.checklistItemId !== 'string' || typeof body.isComplete !== 'boolean') return NextResponse.json({ error: 'Checklist item and completion state are required.' }, { status: 400 });
      const { data, error } = await admin.from('work_item_checklist_items').update({
        is_complete: body.isComplete, completed_by: body.isComplete ? user.userId : null, completed_at: body.isComplete ? new Date().toISOString() : null,
      }).eq('id', body.checklistItemId).eq('work_item_id', id).eq('organization_id', user.organizationId).select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Checklist item not found.' }, { status: 404 });
      return NextResponse.json({ checklistItem: data });
    }

    if (body.action === 'approval_request') {
      const approverId = typeof body.approverId === 'string' && body.approverId ? body.approverId : null;
      if (approverId) {
        const { data: approver, error } = await admin.from('organization_members').select('user_id, role')
          .eq('organization_id', user.organizationId).eq('user_id', approverId).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!approver || !['admin', 'manager'].includes(approver.role)) return NextResponse.json({ error: 'Choose an admin or manager in your workspace.' }, { status: 400 });
      }
      const { data: pending, error: pendingError } = await admin.from('work_item_approvals').select('id')
        .eq('organization_id', user.organizationId).eq('work_item_id', id).eq('status', 'pending').limit(1);
      if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
      if (pending?.length) return NextResponse.json({ error: 'This work item already has a pending approval.' }, { status: 409 });
      const note = typeof body.requestNote === 'string' ? body.requestNote.trim().slice(0, 2000) : '';
      const { data, error } = await admin.from('work_item_approvals').insert({
        organization_id: user.organizationId, work_item_id: id, requested_by: user.userId, approver_id: approverId, request_note: note,
      }).select('*').single();
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 });
      await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORK_ITEM_APPROVAL_REQUESTED', entity_type: 'work_items', entity_id: id, details: { approvalId: data.id, approverId, actorName: user.displayName } });
      return NextResponse.json({ approval: data }, { status: 201 });
    }

    if (body.action === 'approval_decide') {
      assertAuthorized(user, 'manager');
      if (typeof body.approvalId !== 'string' || !['approved', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'Approval ID and approved/rejected status are required.' }, { status: 400 });
      const { data: pendingApproval, error: approvalLoadError } = await admin.from('work_item_approvals').select('requested_by, approver_id')
        .eq('id', body.approvalId).eq('work_item_id', id).eq('organization_id', user.organizationId).eq('status', 'pending').maybeSingle();
      if (approvalLoadError) return NextResponse.json({ error: approvalLoadError.message }, { status: 500 });
      if (!pendingApproval) return NextResponse.json({ error: 'Pending approval not found. Refresh and try again.' }, { status: 409 });
      if (pendingApproval.requested_by === user.userId) return NextResponse.json({ error: 'You cannot approve your own request.' }, { status: 403 });
      if (pendingApproval.approver_id && pendingApproval.approver_id !== user.userId && user.role !== 'admin') {
        return NextResponse.json({ error: 'This approval is assigned to another manager.' }, { status: 403 });
      }
      const { data, error } = await admin.from('work_item_approvals').update({
        status: body.status, decision_note: typeof body.decisionNote === 'string' ? body.decisionNote.trim().slice(0, 2000) : '',
        decided_by: user.userId, decided_at: new Date().toISOString(),
      }).eq('id', body.approvalId).eq('work_item_id', id).eq('organization_id', user.organizationId).eq('status', 'pending').select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Pending approval not found. Refresh and try again.' }, { status: 409 });
      await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: body.status === 'approved' ? 'WORK_ITEM_APPROVAL_GRANTED' : 'WORK_ITEM_APPROVAL_REJECTED', entity_type: 'work_items', entity_id: id, details: { approvalId: data.id, actorName: user.displayName } });
      return NextResponse.json({ approval: data });
    }

    return NextResponse.json({ error: 'Unsupported collaboration action.' }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
