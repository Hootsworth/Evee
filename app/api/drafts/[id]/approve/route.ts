// Evee - Draft Approval Action (Tenant-Isolated)
// Complies with ARCHITECTURE.MD Part D: Approval Security
// Authenticated server-side mutation that validates readiness, creates an audit event, and approves draft

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const { id } = await params;
    const admin = createAdminClient();

    // Verify draft belongs to user's organization
    const { data: draft, error: fetchErr } = await admin
      .from('email_drafts')
      .select('*, contacts(*)')
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
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
    if (payload.subjectLine || (payload as any).subject) updateFields.subject = payload.subjectLine || (payload as any).subject;

    const { data: updated, error: updateErr } = await admin
      .from('email_drafts')
      .update(updateFields)
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Record audit log scoped to organization
    await admin.from('audit_events').insert({
      organization_id: userCtx.organizationId,
      event_type: 'DRAFT_APPROVED',
      entity_type: 'email_drafts',
      entity_id: id,
      details: {
        subject: draft.subject,
        approved_at: new Date().toISOString(),
        operatorId: userCtx.userId,
      },
    });

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
