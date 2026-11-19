import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchWorkflowTrigger } from '@/lib/workflows/template-engine';
import { queueWorkspaceWebhook } from '@/lib/integrations/webhooks';

const workTypes = ['task', 'follow_up', 'research', 'approval', 'handoff', 'other'];
const statuses = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'];
const priorities = ['low', 'normal', 'high', 'urgent'];

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);

    const admin = createAdminClient();
    const params = req.nextUrl.searchParams;
    let query = admin.from('work_items').select('*').eq('organization_id', user.organizationId)
      .order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(200);
    const status = params.get('status');
    const ownerId = params.get('ownerId');
    const accountId = params.get('accountId');
    if (status && statuses.includes(status)) query = query.eq('status', status);
    if (ownerId === 'me') query = query.eq('owner_id', user.userId);
    else if (ownerId) query = query.eq('owner_id', ownerId);
    if (accountId) query = query.eq('account_id', accountId);

    const [{ data: items, error }, { data: members, error: membersError }, { data: availableAccounts, error: availableAccountsError }] = await Promise.all([
      query,
      admin.from('organization_members').select('user_id, role').eq('organization_id', user.organizationId),
      admin.from('businesses').select('id, display_name').eq('organization_id', user.organizationId).order('display_name').limit(200),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });
    if (availableAccountsError) return NextResponse.json({ error: availableAccountsError.message }, { status: 500 });

    const memberIds = (members || []).map((member) => member.user_id);
    const { data: profiles, error: profilesError } = memberIds.length
      ? await admin.from('profiles').select('id, display_name').in('id', memberIds)
      : { data: [], error: null };
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
    const memberNames = new Map((profiles || []).map((profile) => [profile.id, profile.display_name]));

    const itemIds = (items || []).map((item) => item.id);
    const accountIds = [...new Set((items || []).map((item) => item.account_id).filter(Boolean))];
    const [collaboratorsRes, accountsRes] = await Promise.all([
      itemIds.length ? admin.from('work_item_collaborators').select('work_item_id, user_id').in('work_item_id', itemIds) : Promise.resolve({ data: [], error: null }),
      accountIds.length ? admin.from('businesses').select('id, display_name').eq('organization_id', user.organizationId).in('id', accountIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (collaboratorsRes.error) return NextResponse.json({ error: collaboratorsRes.error.message }, { status: 500 });
    if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });

    const accountNames = new Map((accountsRes.data || []).map((account) => [account.id, account.display_name]));
    const collaboratorsByItem = new Map<string, string[]>();
    for (const collaborator of collaboratorsRes.data || []) {
      collaboratorsByItem.set(collaborator.work_item_id, [...(collaboratorsByItem.get(collaborator.work_item_id) || []), collaborator.user_id]);
    }

    return NextResponse.json({
      items: (items || []).map((item) => ({
        ...item,
        account_name: item.account_id ? accountNames.get(item.account_id) || null : null,
        collaborator_ids: collaboratorsByItem.get(item.id) || [],
      })),
      members: (members || []).map((member) => ({ ...member, display_name: memberNames.get(member.user_id) || `Member ${member.user_id.slice(0, 8)}` })),
      accounts: availableAccounts || [],
      userId: user.userId,
      role: user.role,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');

    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 240) return NextResponse.json({ error: 'Title must be between 1 and 240 characters.' }, { status: 400 });
    if (body.workType && !workTypes.includes(body.workType)) return NextResponse.json({ error: 'Invalid work type.' }, { status: 400 });
    if (body.priority && !priorities.includes(body.priority)) return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });

    const ownerId = body.ownerId || user.userId;
    const collaboratorIds = [...new Set(Array.isArray(body.collaboratorIds) ? body.collaboratorIds.filter((id: unknown) => typeof id === 'string') : [])];
    const participantIds = [...new Set([ownerId, ...collaboratorIds])];
    const admin = createAdminClient();
    const { data: members, error: memberError } = await admin.from('organization_members').select('user_id')
      .eq('organization_id', user.organizationId).in('user_id', participantIds);
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
    if ((members || []).length !== participantIds.length) return NextResponse.json({ error: 'Owner and collaborators must belong to your workspace.' }, { status: 400 });

    const accountId = typeof body.accountId === 'string' && body.accountId ? body.accountId : null;
    if (accountId) {
      const { data: account, error } = await admin.from('businesses').select('id').eq('id', accountId)
        .eq('organization_id', user.organizationId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!account) return NextResponse.json({ error: 'Account not found in your workspace.' }, { status: 400 });
    }
    const parentRecordId = typeof body.parentRecordId === 'string' && body.parentRecordId ? body.parentRecordId : null;
    if (parentRecordId) {
      const { data: parent, error } = await admin.from('account_workspace_records').select('id')
        .eq('id', parentRecordId).eq('organization_id', user.organizationId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!parent) return NextResponse.json({ error: 'Parent record not found in this workspace.' }, { status: 400 });
    }
    const blockedById = typeof body.blockedByWorkItemId === 'string' && body.blockedByWorkItemId ? body.blockedByWorkItemId : null;
    if (blockedById) {
      const { data: blocker, error } = await admin.from('work_items').select('id')
        .eq('id', blockedById).eq('organization_id', user.organizationId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!blocker) return NextResponse.json({ error: 'Dependency must be another work item in this workspace.' }, { status: 400 });
    }

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.dueAt && (!dueAt || Number.isNaN(dueAt.getTime()))) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
    const { data: item, error } = await admin.from('work_items').insert({
      organization_id: user.organizationId,
      title,
      description: typeof body.description === 'string' ? body.description.slice(0, 10000) : '',
      work_type: body.workType || 'task',
      priority: body.priority || 'normal',
      due_at: dueAt?.toISOString() || null,
      account_id: accountId,
      owner_id: ownerId,
      created_by: user.userId,
      parent_record_id: parentRecordId,
      blocked_by_work_item_id: blockedById,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await queueWorkspaceWebhook(user.organizationId!, 'work_item.created', { id: item.id, title: item.title, status: item.status, accountId: item.account_id });

    if (collaboratorIds.length) {
      const { error: collaboratorError } = await admin.from('work_item_collaborators').insert(collaboratorIds.map((userId) => ({
        organization_id: user.organizationId,
        work_item_id: item.id,
        user_id: userId,
        added_by: user.userId,
      })));
      if (collaboratorError) {
        await admin.from('work_items').delete().eq('id', item.id).eq('organization_id', user.organizationId);
        return NextResponse.json({ error: collaboratorError.message }, { status: 500 });
      }
    }

    await admin.from('audit_events').insert({
      organization_id: user.organizationId,
      event_type: 'WORK_ITEM_CREATED',
      entity_type: 'work_items',
      entity_id: item.id,
      details: { title, workType: item.work_type, ownerId, accountId, actorName: user.displayName },
    });
    void dispatchWorkflowTrigger(user.organizationId, 'work_item_created', item.id, {
      accountId, title, workType: item.work_type, priority: item.priority, status: item.status,
    }, user.userId);
    return NextResponse.json({ item: { ...item, collaborator_ids: collaboratorIds } }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
