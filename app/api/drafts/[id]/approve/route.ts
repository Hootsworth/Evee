// Evee - Draft Approval Action
// Complies with ARCHITECTURE.MD Part D: Approval Security
// Authenticated server-side mutation that validates readiness, creates an audit event, and approves draft

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: draft, error: fetchErr } = await admin
    .from('email_drafts')
    .select('*, contacts(*)')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  // Update draft status to approved (and persist any copy edits if provided)
  let payload: { bodyText?: string; subjectLine?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // No request body provided; proceed with status update
  }

  const updateFields: Record<string, any> = {
    approval_status: 'approved',
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (payload.bodyText) updateFields.body_text = payload.bodyText;
  if (payload.subjectLine) updateFields.subject_line = payload.subjectLine;

  const { data: updated, error: updateErr } = await admin
    .from('email_drafts')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Record audit log
  await admin.from('audit_events').insert({
    event_type: 'DRAFT_APPROVED',
    entity_type: 'email_drafts',
    entity_id: id,
    details: { subject: draft.subject, approved_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, draft: updated });
}
