// Evee - Controlled Outreach Queue & Dispatch Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const { draftId, workflowId } = body;
    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    // Validate draft belongs to this organization
    const { data: draft } = await admin
      .from('email_drafts')
      .select('*, contacts(*)')
      .eq('id', draftId)
      .eq('organization_id', orgId)
      .single();

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    if (draft.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Cannot queue message: Draft is not approved' }, { status: 400 });
    }

    // Validate workflow belongs to this organization (or global default)
    const { data: workflow } = await admin
      .from('outreach_workflows')
      .select('*')
      .eq('id', workflowId)
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .single();

    if (!workflow || workflow.status !== 'approved') {
      return NextResponse.json({ error: 'Cannot queue message: Workflow is not approved' }, { status: 400 });
    }

    const idempotencyKey = `msg-${draft.business_id}-${draft.id}-${workflow.version}`;

    const { data: message, error } = await admin
      .from('outreach_messages')
      .insert({
        organization_id: orgId,
        business_id: draft.business_id,
        contact_id: draft.contact_id,
        draft_id: draft.id,
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        channel: 'email',
        idempotency_key: idempotencyKey,
        status: 'queued',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Enqueue send_email job scoped to organization
    await admin.from('background_jobs').insert({
      organization_id: orgId,
      job_type: 'send_email',
      payload: { messageId: message.id, organizationId: orgId },
      idempotency_key: `job-send-${message.id}`,
    });

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
