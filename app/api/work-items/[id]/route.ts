import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized, hasMinimumRole } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchWorkflowTrigger } from '@/lib/workflows/template-engine';

const statuses = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'];
const priorities = ['low', 'normal', 'high', 'urgent'];
const workTypes = ['task', 'follow_up', 'research', 'approval', 'handoff', 'other'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const { id } = await params;
    const body = await req.json();
    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin.from('work_items')
      .select('id, created_by, owner_id, status, title')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });
    const canManageAny = hasMinimumRole(user.role, 'manager');
    if (!canManageAny && existing.created_by !== user.userId && existing.owner_id !== user.userId) {
      return NextResponse.json({ error: 'Operators can update work items they created or own.' }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (Object.hasOwn(body, 'title')) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 240) {
        return NextResponse.json({ error: 'Title must be between 1 and 240 characters.' }, { status: 400 });
      }
      update.title = body.title.trim();
    }
    if (Object.hasOwn(body, 'description')) update.description = typeof body.description === 'string' ? body.description.slice(0, 10000) : '';
    if (Object.hasOwn(body, 'status')) {
      if (!statuses.includes(body.status)) return NextResponse.json({ error: 'Invalid work item status.' }, { status: 400 });
      update.status = body.status;
      update.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    }
    if (Object.hasOwn(body, 'priority')) {
      if (!priorities.includes(body.priority)) return NextResponse.json({ error: 'Invalid work item priority.' }, { status: 400 });
      update.priority = body.priority;
    }
    if (Object.hasOwn(body, 'workType')) {
      if (!workTypes.includes(body.workType)) return NextResponse.json({ error: 'Invalid work item type.' }, { status: 400 });
      update.work_type = body.workType;
    }
    if (Object.hasOwn(body, 'dueAt')) {
      if (body.dueAt === null || body.dueAt === '') update.due_at = null;
      else {
        const dueAt = new Date(body.dueAt);
        if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
        update.due_at = dueAt.toISOString();
      }
    }
    if (Object.hasOwn(body, 'ownerId')) {
      const ownerId = body.ownerId || null;
      if (ownerId) {
        const { data: member, error } = await admin.from('organization_members').select('user_id')
          .eq('organization_id', user.organizationId).eq('user_id', ownerId).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!member) return NextResponse.json({ error: 'Owner must belong to your workspace.' }, { status: 400 });
      }
      update.owner_id = ownerId;
    }
    if (Object.hasOwn(body, 'accountId')) {
      const accountId = body.accountId || null;
      if (accountId) {
        const { data: account, error } = await admin.from('businesses').select('id')
          .eq('id', accountId).eq('organization_id', user.organizationId).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!account) return NextResponse.json({ error: 'Account not found in your workspace.' }, { status: 400 });
      }
      update.account_id = accountId;
    }

    let collaboratorIds: string[] | undefined;
    if (Object.hasOwn(body, 'collaboratorIds')) {
      if (!Array.isArray(body.collaboratorIds) || body.collaboratorIds.some((value: unknown) => typeof value !== 'string')) {
        return NextResponse.json({ error: 'collaboratorIds must be an array of workspace user IDs.' }, { status: 400 });
      }
      collaboratorIds = [...new Set(body.collaboratorIds as string[])];
      if (collaboratorIds.length) {
        const { data: members, error } = await admin.from('organization_members').select('user_id')
          .eq('organization_id', user.organizationId).in('user_id', collaboratorIds);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if ((members || []).length !== collaboratorIds.length) return NextResponse.json({ error: 'Collaborators must belong to your workspace.' }, { status: 400 });
      }
    }

    let item = existing;
    if (Object.keys(update).length) {
      const { data, error } = await admin.from('work_items').update(update).eq('id', id)
        .eq('organization_id', user.organizationId).select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Work item changed while saving. Refresh and try again.' }, { status: 409 });
      item = data;
    }

    if (collaboratorIds) {
      const { error: deleteError } = await admin.from('work_item_collaborators').delete()
        .eq('work_item_id', id).eq('organization_id', user.organizationId);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      if (collaboratorIds.length) {
        const { error: insertError } = await admin.from('work_item_collaborators').insert(collaboratorIds.map((userId) => ({
          organization_id: user.organizationId,
          work_item_id: id,
          user_id: userId,
          added_by: user.userId,
        })));
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const nextStatus = update.status as string | undefined;
    if (nextStatus && nextStatus !== existing.status) {
      void dispatchWorkflowTrigger(user.organizationId, 'work_item_status_changed', id, {
        title: (item as any).title, statusFrom: existing.status, statusTo: nextStatus,
      }, user.userId);
    }
    if (Object.keys(update).length || collaboratorIds) {
      await admin.from('audit_events').insert({
        organization_id: user.organizationId,
        event_type: nextStatus === 'completed' ? 'WORK_ITEM_COMPLETED' : 'WORK_ITEM_UPDATED',
        entity_type: 'work_items',
        entity_id: id,
        details: { changes: Object.keys(update), collaboratorIds, actorName: user.displayName },
      });
    }
    const { data: collaborators } = await admin.from('work_item_collaborators').select('user_id').eq('work_item_id', id);
    return NextResponse.json({ item: { ...item, collaborator_ids: (collaborators || []).map((row) => row.user_id) } });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'manager');
    const { id } = await params;
    const admin = createAdminClient();
    const { data: attachments, error: attachmentError } = await admin.from('work_item_attachments').select('storage_path')
      .eq('organization_id', user.organizationId).eq('work_item_id', id);
    if (attachmentError) return NextResponse.json({ error: attachmentError.message }, { status: 500 });
    const { data, error } = await admin.from('work_items').delete().eq('id', id)
      .eq('organization_id', user.organizationId).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });
    if (attachments?.length) {
      const { error: storageError } = await admin.storage.from('work-item-attachments').remove(attachments.map((attachment) => attachment.storage_path));
      if (storageError) console.warn('[work-items] Could not remove attachment objects after deleting item:', storageError.message);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
