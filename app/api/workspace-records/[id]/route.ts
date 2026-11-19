import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchWorkflowTrigger } from '@/lib/workflows/template-engine';
import { getAllPartners } from '@/lib/services/partner-store';
import { recordTypes } from '@/lib/workspace-records/types';

const validStatuses: Record<string, string[]> = {
  account_plan: ['draft', 'active', 'review'], relationship: ['active', 'inactive'], meeting: ['scheduled', 'held', 'cancelled'], inbound_lead: ['new', 'qualifying', 'qualified', 'disqualified', 'routed'],
  opportunity: ['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'paused'], proposal: ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected'],
  onboarding: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], renewal: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], health_review: ['open', 'in_progress', 'completed', 'cancelled'], escalation: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], vendor: ['open', 'active', 'paused', 'completed', 'cancelled'], procurement: ['open', 'in_progress', 'pending_approval', 'approved', 'completed', 'cancelled'], service_request: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], success_plan: ['draft', 'active', 'review', 'completed', 'cancelled'], outcome: ['won', 'lost', 'no_decision'],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const { id } = await params;
    const body = await req.json();
    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin.from('account_workspace_records').select('*')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Workspace record not found.' }, { status: 404 });
    const status = body.status ?? existing.status;
    if (!validStatuses[existing.record_type]?.includes(status)) return NextResponse.json({ error: 'Status is not valid for this record type.' }, { status: 400 });
    const managerDecision = (existing.record_type === 'opportunity' && ['closed_won', 'closed_lost'].includes(status)) ||
      (existing.record_type === 'proposal' && ['approved', 'sent', 'accepted'].includes(status)) ||
      (existing.record_type === 'procurement' && status === 'approved');
    if (managerDecision) assertAuthorized(user, 'manager');
    if (existing.record_type === 'proposal' && status === 'sent' && body.confirmedExternal !== true) {
      return NextResponse.json({ error: 'Confirm that this approved proposal was shared externally before marking it sent.' }, { status: 409 });
    }

    const updates: Record<string, unknown> = {};
    if (Object.hasOwn(body, 'title')) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 240) return NextResponse.json({ error: 'Title must be between 1 and 240 characters.' }, { status: 400 });
      updates.title = body.title.trim();
    }
    if (Object.hasOwn(body, 'body')) updates.body = typeof body.body === 'string' ? body.body.slice(0, 10000) : '';
    if (Object.hasOwn(body, 'status')) updates.status = status;
    if (Object.hasOwn(body, 'stage')) {
      if (typeof body.stage !== 'string' || body.stage.trim().length > 120) return NextResponse.json({ error: 'Stage must be 120 characters or fewer.' }, { status: 400 });
      updates.stage = body.stage.trim();
    }
    if (Object.hasOwn(body, 'priority')) {
      if (!['low', 'normal', 'high', 'urgent'].includes(body.priority)) return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
      updates.priority = body.priority;
    }
    if (Object.hasOwn(body, 'amount')) {
      if (body.amount !== null && (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0)) return NextResponse.json({ error: 'Amount must be a non-negative number.' }, { status: 400 });
      updates.amount = body.amount === null || body.amount === '' ? null : Number(body.amount);
    }
    if (Object.hasOwn(body, 'probability')) {
      if (body.probability !== null && (!Number.isInteger(Number(body.probability)) || Number(body.probability) < 0 || Number(body.probability) > 100)) return NextResponse.json({ error: 'Probability must be 0 to 100.' }, { status: 400 });
      updates.probability = body.probability === null || body.probability === '' ? null : Number(body.probability);
    }
    for (const [inputKey, column] of [['ownerId', 'owner_id'], ['accountId', 'account_id'], ['contactId', 'contact_id'], ['partnerId', 'partner_id']] as const) {
      if (!Object.hasOwn(body, inputKey)) continue;
      const value = typeof body[inputKey] === 'string' && body[inputKey] ? body[inputKey] : null;
      if (inputKey === 'ownerId' && value) {
        const { data: member, error } = await admin.from('organization_members').select('user_id').eq('organization_id', user.organizationId).eq('user_id', value).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!member) return NextResponse.json({ error: 'Owner must belong to this workspace.' }, { status: 400 });
      }
      if (inputKey === 'accountId' && value) {
        const { data: account, error } = await admin.from('businesses').select('id').eq('id', value).eq('organization_id', user.organizationId).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!account) return NextResponse.json({ error: 'Account not found in this workspace.' }, { status: 400 });
      }
      if (inputKey === 'contactId' && value) {
        const accountId = (updates.account_id as string | null) ?? existing.account_id;
        if (!accountId) return NextResponse.json({ error: 'Contact relationship requires a linked account.' }, { status: 400 });
        const { data: contact, error } = await admin.from('contacts').select('id').eq('id', value).eq('business_id', accountId).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!contact) return NextResponse.json({ error: 'Contact does not belong to the linked account.' }, { status: 400 });
      }
      if (inputKey === 'partnerId' && value) {
        if (!(await getAllPartners(user.organizationId)).some((partner) => partner.id === value)) return NextResponse.json({ error: 'Partner not found in this workspace.' }, { status: 400 });
      }
      updates[column] = value;
    }
    for (const [inputKey, column] of [['dueAt', 'due_at'], ['meetingAt', 'meeting_at'], ['closeDate', 'close_date']] as const) {
      if (!Object.hasOwn(body, inputKey)) continue;
      const value = body[inputKey];
      if (!value) { updates[column] = null; continue; }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return NextResponse.json({ error: `Invalid ${inputKey}.` }, { status: 400 });
      updates[column] = column === 'close_date' ? date.toISOString().slice(0, 10) : date.toISOString();
    }
    if (Object.hasOwn(body, 'data')) {
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data) || JSON.stringify(body.data).length > 20000) return NextResponse.json({ error: 'Details must be a JSON object under 20 KB.' }, { status: 400 });
      updates.data = body.data;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ record: existing });
    updates.updated_by = user.userId;
    const { data, error } = await admin.from('account_workspace_records').update(updates).eq('id', id)
      .eq('organization_id', user.organizationId).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Record changed while saving. Refresh and try again.' }, { status: 409 });
    if (existing.record_type === 'inbound_lead' && (Object.hasOwn(updates, 'owner_id') || Object.hasOwn(updates, 'due_at') || ['disqualified', 'routed'].includes(data.status))) {
      const workUpdate: Record<string, unknown> = {};
      if (Object.hasOwn(updates, 'owner_id')) workUpdate.owner_id = data.owner_id;
      if (Object.hasOwn(updates, 'due_at')) workUpdate.due_at = data.due_at;
      if (data.status === 'disqualified') workUpdate.status = 'cancelled';
      const { data: linkedTask, error: taskError } = await admin.from('work_items').update(workUpdate).eq('organization_id', user.organizationId).eq('parent_record_id', id).select('id').maybeSingle();
      if (taskError) console.warn('[workspace-records] Could not update inbound SLA task:', taskError.message);
      if (!linkedTask && data.status !== 'disqualified') {
        const { error: insertError } = await admin.from('work_items').insert({
          organization_id: user.organizationId, title: `Respond to inbound lead: ${data.title}`,
          description: 'Triage and follow up on the inbound lead before the response SLA.', work_type: 'follow_up', priority: data.priority,
          due_at: data.due_at, account_id: data.account_id, owner_id: data.owner_id || user.userId, created_by: user.userId, parent_record_id: id,
        });
        if (insertError) console.warn('[workspace-records] Could not create routed inbound follow-up:', insertError.message);
      }
    }
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: `${existing.record_type.toUpperCase()}_UPDATED`, entity_type: 'account_workspace_records', entity_id: id, details: { title: data.title, status: data.status, stage: data.stage, actorName: user.displayName } });
    if (existing.record_type === 'opportunity' && existing.stage !== data.stage) void dispatchWorkflowTrigger(user.organizationId, 'opportunity_stage_changed', id, { accountId: data.account_id, stageFrom: existing.stage, stageTo: data.stage, amount: data.amount, closeDate: data.close_date }, user.userId);
    return NextResponse.json({ record: data });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
