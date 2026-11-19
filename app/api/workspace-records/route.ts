import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllPartners } from '@/lib/services/partner-store';
import { dispatchWorkflowTrigger } from '@/lib/workflows/template-engine';
import { queueWorkspaceWebhook } from '@/lib/integrations/webhooks';
import { recordTypes } from '@/lib/workspace-records/types';

const statusByType: Record<string, string[]> = {
  account_plan: ['draft', 'active', 'review'], relationship: ['active', 'inactive'], meeting: ['scheduled', 'held', 'cancelled'],
  inbound_lead: ['new', 'qualifying', 'qualified', 'disqualified', 'routed'],
  opportunity: ['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'paused'],
  proposal: ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected'],
  outcome: ['won', 'lost', 'no_decision'],
  onboarding: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], renewal: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'],
  health_review: ['open', 'in_progress', 'completed', 'cancelled'], escalation: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'],
  vendor: ['open', 'active', 'paused', 'completed', 'cancelled'], procurement: ['open', 'in_progress', 'pending_approval', 'approved', 'completed', 'cancelled'],
  service_request: ['open', 'in_progress', 'blocked', 'completed', 'cancelled'], success_plan: ['draft', 'active', 'review', 'completed', 'cancelled'],
};

function validateRecordInput(body: any) {
  const recordType = body.recordType;
  if (!recordTypes.includes(recordType)) return 'Choose a supported record type.';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 240) return 'Title must be between 1 and 240 characters.';
  if (body.status && !statusByType[recordType].includes(body.status)) return 'Status is not valid for this record type.';
  if (body.priority && !['low', 'normal', 'high', 'urgent'].includes(body.priority)) return 'Choose a valid priority.';
  if (body.amount !== undefined && body.amount !== null && (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0)) return 'Amount must be a positive number.';
  if (body.probability !== undefined && body.probability !== null && (!Number.isInteger(Number(body.probability)) || Number(body.probability) < 0 || Number(body.probability) > 100)) return 'Probability must be 0 to 100.';
  if (body.data !== undefined && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data) || JSON.stringify(body.data).length > 20000)) return 'Details must be a JSON object under 20 KB.';
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const params = req.nextUrl.searchParams;
    const admin = createAdminClient();
    let query = admin.from('account_workspace_records').select('*').eq('organization_id', user.organizationId)
      .order('updated_at', { ascending: false }).limit(500);
    const type = params.get('type');
    const accountId = params.get('accountId');
    const status = params.get('status');
    const owner = params.get('owner');
    if (type && recordTypes.includes(type as any)) query = query.eq('record_type', type);
    if (accountId) query = query.eq('account_id', accountId);
    if (status) query = query.eq('status', status);
    if (owner === 'me') query = query.eq('owner_id', user.userId);
    const [{ data, error }, { data: accounts, error: accountError }, { data: members, error: memberError }] = await Promise.all([
      query,
      admin.from('businesses').select('id, display_name, city, business_type').eq('organization_id', user.organizationId).order('display_name').limit(500),
      admin.from('organization_members').select('user_id, role').eq('organization_id', user.organizationId),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
    const accountMap = new Map((accounts || []).map((account) => [account.id, account]));
    const memberIds = (members || []).map((member) => member.user_id);
    const { data: profiles, error: profileError } = memberIds.length ? await admin.from('profiles').select('id, display_name').in('id', memberIds) : { data: [], error: null };
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.display_name]));
    const accountIds = (accounts || []).map((account) => account.id);
    const { data: contacts, error: contactError } = accountIds.length
      ? await admin.from('contacts').select('id, business_id, contact_name, job_title, email_address').in('business_id', accountIds)
      : { data: [], error: null };
    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 });
    return NextResponse.json({
      records: (data || []).map((record) => ({ ...record, account: record.account_id ? accountMap.get(record.account_id) || null : null, owner_name: record.owner_id ? names.get(record.owner_id) || 'Workspace member' : null })),
      accounts: accounts || [],
      contacts: contacts || [],
      members: (members || []).map((member) => ({ ...member, display_name: names.get(member.user_id) || `Member ${member.user_id.slice(0, 8)}` })),
      partners: await getAllPartners(user.organizationId),
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
    const validationError = validateRecordInput(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const requestedStatus = body.status || (body.recordType === 'opportunity' ? 'discovery' : body.recordType === 'proposal' ? 'draft' : body.recordType === 'procurement' ? 'open' : '');
    const requiresManager = (body.recordType === 'opportunity' && ['closed_won', 'closed_lost'].includes(requestedStatus)) ||
      (body.recordType === 'proposal' && ['approved', 'sent', 'accepted'].includes(requestedStatus)) ||
      (body.recordType === 'procurement' && requestedStatus === 'approved');
    if (requiresManager) assertAuthorized(user, 'manager');
    if (body.recordType === 'proposal' && requestedStatus === 'sent' && body.confirmedExternal !== true) {
      return NextResponse.json({ error: 'Confirm that this approved proposal was shared externally before recording it as sent.' }, { status: 409 });
    }
    const admin = createAdminClient();
    const accountId = typeof body.accountId === 'string' && body.accountId ? body.accountId : null;
    if (accountId) {
      const { data: account, error } = await admin.from('businesses').select('id, display_name, city, business_type').eq('id', accountId).eq('organization_id', user.organizationId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!account) return NextResponse.json({ error: 'Account not found in this workspace.' }, { status: 400 });
    }
    const contactId = typeof body.contactId === 'string' && body.contactId ? body.contactId : null;
    if (contactId) {
      if (!accountId) return NextResponse.json({ error: 'A contact relationship requires a linked account.' }, { status: 400 });
      const { data: contact, error } = await admin.from('contacts').select('id').eq('id', contactId).eq('business_id', accountId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!contact) return NextResponse.json({ error: 'Contact is not attached to the selected account.' }, { status: 400 });
    }
    const ownerId = typeof body.ownerId === 'string' && body.ownerId ? body.ownerId : user.userId;
    const { data: owner, error: ownerError } = await admin.from('organization_members').select('user_id').eq('organization_id', user.organizationId).eq('user_id', ownerId).maybeSingle();
    if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 500 });
    if (!owner) return NextResponse.json({ error: 'Owner must belong to this workspace.' }, { status: 400 });
    const partnerId = typeof body.partnerId === 'string' && body.partnerId ? body.partnerId : null;
    if (partnerId && !(await getAllPartners(user.organizationId)).some((partner) => partner.id === partnerId)) return NextResponse.json({ error: 'Partner not found in this workspace.' }, { status: 400 });
    const dueAt = body.dueAt ? new Date(body.dueAt) : body.recordType === 'inbound_lead' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const meetingAt = body.meetingAt ? new Date(body.meetingAt) : null;
    const closeDate = body.closeDate ? new Date(body.closeDate) : null;
    for (const value of [dueAt, meetingAt, closeDate]) if (value && Number.isNaN(value.getTime())) return NextResponse.json({ error: 'A date value is invalid.' }, { status: 400 });

    let bodyText = typeof body.body === 'string' ? body.body.slice(0, 10000) : '';
    const dataObject = body.data || {};
    if (body.recordType === 'proposal' && !bodyText) {
      const { data: account } = accountId ? await admin.from('businesses').select('display_name, city, business_type').eq('id', accountId).eq('organization_id', user.organizationId).maybeSingle() : { data: null };
      bodyText = [
        `Proposal draft for ${account?.display_name || body.title}`,
        account ? `Prepared for ${account.display_name}${account.city ? ` in ${account.city}` : ''}.` : '',
        dataObject.executiveSummary ? `\nSummary\n${String(dataObject.executiveSummary).slice(0, 2000)}` : '',
        dataObject.scope ? `\nProposed scope\n${String(dataObject.scope).slice(0, 4000)}` : '',
        body.amount ? `\nProposed investment\n${body.currency || 'USD'} ${Number(body.amount).toLocaleString()}` : '',
        '\nThis is a draft for internal review. Confirm scope and terms before sharing externally.',
      ].filter(Boolean).join('\n');
      dataObject.sourceFields = account ? ['display_name', 'city', 'business_type'] : [];
      dataObject.template = 'default_proposal_v1';
    }

    const record = {
      organization_id: user.organizationId,
      account_id: accountId,
      contact_id: contactId,
      partner_id: partnerId,
      record_type: body.recordType,
      title: body.title.trim(),
      body: bodyText,
      status: body.status || (body.recordType === 'inbound_lead' ? 'new' : body.recordType === 'meeting' ? 'scheduled' : body.recordType === 'proposal' ? 'draft' : body.recordType === 'opportunity' ? 'discovery' : body.recordType === 'outcome' ? 'no_decision' : 'open'),
      priority: body.priority || 'normal',
      stage: body.recordType === 'opportunity' ? body.stage || 'Discovery' : body.stage || null,
      amount: body.amount === undefined || body.amount === null || body.amount === '' ? null : Number(body.amount),
      currency: body.currency || 'USD',
      probability: body.probability === undefined || body.probability === null || body.probability === '' ? null : Number(body.probability),
      source: typeof body.source === 'string' ? body.source.slice(0, 200) : null,
      owner_id: ownerId,
      due_at: dueAt?.toISOString() || null,
      meeting_at: meetingAt?.toISOString() || null,
      close_date: closeDate?.toISOString().slice(0, 10) || null,
      data: dataObject,
      created_by: user.userId,
      updated_by: user.userId,
    };
    const { data, error } = await admin.from('account_workspace_records').insert(record).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await queueWorkspaceWebhook(user.organizationId!, 'account_record.created', { id: data.id, type: data.record_type, title: data.title, accountId: data.account_id, status: data.status });

    let followUpCreated = false;
    if (body.recordType === 'inbound_lead' && dueAt) {
      const { error: followUpError } = await admin.from('work_items').insert({
        organization_id: user.organizationId,
        title: `Respond to inbound lead: ${record.title}`,
        description: 'Triage and follow up on the inbound lead before the response SLA.',
        work_type: 'follow_up', priority: record.priority, due_at: dueAt.toISOString(),
        account_id: accountId, owner_id: ownerId, created_by: user.userId, parent_record_id: data.id,
      });
      followUpCreated = !followUpError;
      if (followUpError) console.error('[workspace-records] Could not create inbound follow-up task:', followUpError.message);
    }
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: `${body.recordType.toUpperCase()}_CREATED`, entity_type: 'account_workspace_records', entity_id: data.id, details: { title: data.title, accountId, actorName: user.displayName } });
    if (body.recordType === 'inbound_lead') void dispatchWorkflowTrigger(user.organizationId, 'lead_received', data.id, { accountId, accountName: data.data?.accountName || record.title, source: record.source, priority: record.priority }, user.userId);
    if (body.recordType === 'opportunity') void dispatchWorkflowTrigger(user.organizationId, 'opportunity_stage_changed', data.id, { accountId, stageFrom: null, stageTo: data.stage, amount: data.amount, closeDate: data.close_date }, user.userId);
    return NextResponse.json({ record: data, followUpCreated: body.recordType === 'inbound_lead' ? followUpCreated : undefined }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
