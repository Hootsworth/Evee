// Evee - Controlled Outreach Queue & Dispatch Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { draftId, workflowId } = body;
  const admin = createAdminClient();

  // Validate draft
  const { data: draft } = await admin.from('email_drafts').select('*, contacts(*)').eq('id', draftId).single();
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  if (draft.approval_status !== 'approved') {
    return NextResponse.json({ error: 'Cannot queue message: Draft is not approved' }, { status: 400 });
  }

  // Validate workflow
  const { data: workflow } = await admin.from('outreach_workflows').select('*').eq('id', workflowId).single();
  if (!workflow || workflow.status !== 'approved') {
    return NextResponse.json({ error: 'Cannot queue message: Workflow is not approved' }, { status: 400 });
  }

  const idempotencyKey = `msg-${draft.business_id}-${draft.id}-${workflow.version}`;

  const { data: message, error } = await admin
    .from('outreach_messages')
    .insert({
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

  // Enqueue send_email job
  await admin.from('background_jobs').insert({
    job_type: 'send_email',
    payload: { messageId: message.id },
    idempotency_key: `job-send-${message.id}`,
  });

  return NextResponse.json({ success: true, message }, { status: 201 });
}
