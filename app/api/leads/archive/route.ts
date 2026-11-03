// Evee - Lead Archival & Status Management Endpoint (Tenant-Isolated)
// Enables single, batch, or automated no-email lead archival within the authenticated organization
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
    const { ids, allMissingEmail, action = 'archive' } = body as {
      ids?: string[];
      allMissingEmail?: boolean;
      action?: 'archive' | 'unarchive';
    };

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;
    const targetStatus = action === 'unarchive' ? 'active' : 'archived';

    let targetIds: string[] = [];

    if (allMissingEmail) {
      // Find all active businesses without an email address strictly within this organization
      const { data: missing, error: fetchErr } = await admin
        .from('businesses')
        .select('id, general_business_email')
        .eq('organization_id', orgId)
        .eq('record_status', 'active');

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      targetIds = (missing || [])
        .filter((b) => !b.general_business_email || b.general_business_email.trim() === '')
        .map((b) => b.id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids;
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads matched criteria for update.',
        count: 0,
      });
    }

    // Batch update businesses scoped strictly to this organization
    const { data: updatedRecords, error: updateErr } = await admin
      .from('businesses')
      .update({
        record_status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .in('id', targetIds)
      .eq('organization_id', orgId)
      .select('id');

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const updatedCount = updatedRecords?.length || 0;

    // Log audit event for compliance and traceability scoped to organization
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: action === 'unarchive' ? 'LEADS_UNARCHIVED' : 'LEADS_ARCHIVED',
        entity_type: 'businesses',
        details: {
          count: updatedCount,
          action: targetStatus,
          allMissingEmail: Boolean(allMissingEmail),
          targetIds,
          operatorId: userCtx.userId,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record audit log for archival:', auditErr);
    }

    return NextResponse.json({
      success: true,
      count: updatedCount,
      action: targetStatus,
      targetIds: updatedRecords?.map((r) => r.id) || [],
    });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes('Unauthenticated') ? 401 : error.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: error?.message || 'Failed to update lead status' }, { status });
  }
}
