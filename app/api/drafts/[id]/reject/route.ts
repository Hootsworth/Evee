// Evee - Draft Rejection Action (Tenant-Isolated)
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
    const { data: updated, error } = await admin
      .from('email_drafts')
      .update({
        approval_status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Draft not found' }, { status: 404 });
    }

    await admin.from('audit_events').insert({
      organization_id: userCtx.organizationId,
      event_type: 'DRAFT_REJECTED',
      entity_type: 'email_drafts',
      entity_id: id,
      details: { rejected_at: new Date().toISOString(), operatorId: userCtx.userId },
    });

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
