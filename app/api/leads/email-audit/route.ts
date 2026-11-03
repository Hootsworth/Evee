// Evee - AI & Rule Email Audit & Cleanup Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scanLeadsEmailQuality } from '@/lib/services/email-quality';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';

    let query = admin.from('businesses').select('*').eq('organization_id', orgId);
    if (status !== 'all') {
      query = query.eq('record_status', status);
    }

    const { data: businesses, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const report = scanLeadsEmailQuality(businesses || []);
    return NextResponse.json(report);
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: error?.message || 'Failed to scan leads' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const {
      leadIds,
      action = 'archive',
      archiveAllFlagged = false,
      filterCategory,
    } = body as {
      leadIds?: string[];
      action?: 'archive' | 'delete';
      archiveAllFlagged?: boolean;
      filterCategory?: string;
    };

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    let targetIds: string[] = [];

    if (archiveAllFlagged) {
      // Fetch active businesses strictly within organization
      const { data: businesses, error } = await admin
        .from('businesses')
        .select('*')
        .eq('organization_id', orgId)
        .eq('record_status', 'active');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const report = scanLeadsEmailQuality(businesses || []);
      let candidates = report.flaggedLeads;

      if (filterCategory && filterCategory !== 'all') {
        candidates = candidates.filter((c) => c.flag.category === filterCategory);
      }

      targetIds = candidates.map((c) => c.leadId);
    } else if (Array.isArray(leadIds) && leadIds.length > 0) {
      targetIds = leadIds;
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads matched criteria for action.',
        count: 0,
      });
    }

    let affectedCount = 0;

    if (action === 'archive') {
      const { data: updated, error: updateErr } = await admin
        .from('businesses')
        .update({
          record_status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .in('id', targetIds)
        .eq('organization_id', orgId)
        .select('id');

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      affectedCount = updated?.length || 0;
    } else if (action === 'delete') {
      // Clean dependent rows scoped to tenant's businesses
      const { data: validBusinesses } = await admin
        .from('businesses')
        .select('id')
        .in('id', targetIds)
        .eq('organization_id', orgId);

      const verifiedIds = (validBusinesses || []).map((b) => b.id);

      if (verifiedIds.length > 0) {
        try {
          await admin.from('outreach_jobs').delete().in('business_id', verifiedIds);
          await admin.from('email_drafts').delete().in('business_id', verifiedIds).eq('organization_id', orgId);
          await admin.from('lead_scores').delete().in('business_id', verifiedIds);
          await admin.from('evidence_items').delete().in('business_id', verifiedIds);
          await admin.from('contacts').delete().in('business_id', verifiedIds);
          await admin.from('campaign_businesses').delete().in('business_id', verifiedIds);

          const { error: delErr } = await admin
            .from('businesses')
            .delete()
            .in('id', verifiedIds)
            .eq('organization_id', orgId);

          if (!delErr) {
            affectedCount = verifiedIds.length;
          }
        } catch (e) {
          console.warn('Error during cascaded delete:', e);
        }
      }
    }

    // Record audit event
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: `LEADS_${action.toUpperCase()}_EMAIL_AUDIT`,
        entity_type: 'businesses',
        details: {
          count: affectedCount,
          action,
          targetIds,
          operatorId: userCtx.userId,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      action,
      count: affectedCount,
      targetIds,
    });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes('Unauthenticated') ? 401 : error.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: error?.message || 'Failed to process leads' }, { status });
  }
}
