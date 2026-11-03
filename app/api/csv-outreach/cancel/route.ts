// Evee - Cancel Active Outreach Dispatch Endpoint (Tenant-Isolated)
// Cancels pending queued dispatch jobs immediately to prevent duplicate sends or stop outreach
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;
    const body = await req.json().catch(() => ({}));
    const { batchId, cancelAll = false } = body;

    let query = admin
      .from('background_jobs')
      .update({
        status: 'cancelled',
        last_error_code: 'CANCELLED_BY_OPERATOR',
        last_error_summary: 'Outreach dispatch cancelled by operator',
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', orgId)
      .eq('job_type', 'csv_email_dispatch')
      .eq('status', 'queued');

    if (batchId && !cancelAll) {
      query = query.contains('payload', { batchId });
    }

    const { data: cancelled, error } = await query.select('id');

    if (error) {
      console.error('Failed to cancel outreach dispatch:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cancelledCount = cancelled ? cancelled.length : 0;

    // Record audit event
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: 'CSV_OUTREACH_DISPATCH_CANCELLED',
        entity_type: 'campaigns',
        details: {
          batchId: batchId || 'all_active',
          cancelledCount,
          operatorId: userCtx.userId,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      cancelledCount,
      message: `Successfully cancelled ${cancelledCount} queued outreach emails.`,
    });
  } catch (err: any) {
    console.error('Cancel dispatch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel outreach dispatch' }, { status: 500 });
  }
}
