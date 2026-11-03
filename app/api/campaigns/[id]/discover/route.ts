// Evee - Trigger Business Discovery for Campaign (Tenant-Isolated)
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
    const orgId = userCtx.organizationId;

    const { data: campaign, error } = await admin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Enqueue new discovery job scoped to organization
    const { data: job, error: jobErr } = await admin
      .from('background_jobs')
      .insert({
        organization_id: orgId,
        job_type: 'discover_businesses',
        payload: {
          campaignId: campaign.id,
          organizationId: orgId,
          geography: campaign.target_geographies[0] || 'Bengaluru',
          categories: campaign.target_industries,
          keywords: campaign.search_terms,
          limit: campaign.daily_discovery_limit || 10,
        },
        idempotency_key: `manual-discovery-${campaign.id}-${Date.now()}`,
      })
      .select()
      .single();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Discovery job queued', jobId: job.id });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
