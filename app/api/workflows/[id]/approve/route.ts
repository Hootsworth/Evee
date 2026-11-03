// Evee - Workflow Approval Endpoint (Tenant-Isolated)
// Required before automated sending can be activated
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'admin');

    const { id } = await params;
    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    const { data: updated, error } = await admin
      .from('outreach_workflows')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Workflow not found' }, { status: 404 });
    }

    await admin.from('audit_events').insert({
      organization_id: orgId,
      event_type: 'WORKFLOW_APPROVED',
      entity_type: 'outreach_workflows',
      entity_id: id,
      details: {
        version: updated.version,
        approved_at: new Date().toISOString(),
        operatorId: userCtx.userId,
      },
    });

    return NextResponse.json({ success: true, workflow: updated });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
