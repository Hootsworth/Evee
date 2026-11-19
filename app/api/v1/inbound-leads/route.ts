import { NextRequest, NextResponse } from 'next/server';
import { authenticateWorkspaceApiKey, apiError } from '@/lib/api-keys';
import { dispatchWorkflowTrigger } from '@/lib/workflows/template-engine';
import { queueWorkspaceWebhook } from '@/lib/integrations/webhooks';

export async function POST(req: NextRequest) {
  try {
    const { organizationId, admin, createdBy } = await authenticateWorkspaceApiKey(req, 'leads:write');
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 240) : '';
    if (!title) return NextResponse.json({ error: 'Lead title is required.' }, { status: 400 });
    const accountId = typeof body.accountId === 'string' ? body.accountId : null;
    if (accountId) {
      const { data: account } = await admin.from('businesses').select('id').eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
      if (!account) return NextResponse.json({ error: 'Account must belong to the API key workspace.' }, { status: 400 });
    }
    const ownerId = createdBy;
    const dueAt = body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data: record, error } = await admin.from('account_workspace_records').insert({
      organization_id: organizationId, record_type: 'inbound_lead', title,
      body: typeof body.description === 'string' ? body.description.slice(0, 10000) : '',
      source: typeof body.source === 'string' ? body.source.slice(0, 200) : 'API', priority: ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal',
      account_id: accountId, owner_id: ownerId, due_at: dueAt.toISOString(), created_by: ownerId, updated_by: ownerId,
      data: { externalReference: typeof body.externalReference === 'string' ? body.externalReference.slice(0, 200) : null },
    }).select('id, title, status, account_id, due_at').single();
    if (error) throw error;
    const { error: taskError } = await admin.from('work_items').insert({
      organization_id: organizationId, title: `Respond to inbound lead: ${title}`, description: 'Triage and follow up on the inbound lead before the response SLA.',
      work_type: 'follow_up', priority: ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal', due_at: dueAt.toISOString(),
      account_id: accountId, owner_id: ownerId, created_by: ownerId, parent_record_id: record.id,
    });
    if (taskError) console.error('[v1 inbound leads] Follow-up task could not be created:', taskError.message);
    void dispatchWorkflowTrigger(organizationId, 'lead_received', record.id, { accountId, accountName: title, source: body.source || 'API', priority: body.priority || 'normal' }, ownerId);
    await queueWorkspaceWebhook(organizationId, 'account_record.created', { id: record.id, type: 'inbound_lead', title, accountId, status: record.status });
    return NextResponse.json({ lead: record, followUpTaskCreated: !taskError }, { status: 201 });
  } catch (err: any) { const result = apiError(err); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
