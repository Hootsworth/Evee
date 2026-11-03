// Evee - Campaigns API Handler (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const { data: campaigns, error } = await admin
      .from('campaigns')
      .select('*')
      .eq('organization_id', userCtx.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ campaigns: [] });
    }

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const body = await req.json();
    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    const { data: campaign, error } = await admin
      .from('campaigns')
      .insert({
        organization_id: orgId,
        name: body.name || 'Unnamed Campaign',
        target_geographies: body.targetGeographies || ['Bengaluru'],
        target_industries: body.targetIndustries || ['Cafes & Restaurants'],
        search_terms: body.searchTerms || ['bakery', 'cafe', 'bistro'],
        services_to_promote: body.servicesToPromote || ['Digital QR Menu', 'Online Booking Workflow'],
        monthly_target: body.monthlyTarget || 100,
        daily_discovery_limit: body.dailyDiscoveryLimit || 20,
        qualification_threshold: body.qualificationThreshold || 65,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        return NextResponse.json(
          {
            error: "The Supabase database has not been initialized with the initial SQL migration yet. Table 'public.campaigns' does not exist.",
            code: 'SCHEMA_NOT_INITIALIZED',
            migrationUrl: 'https://supabase.com/dashboard/project/fflnixsmerahqnvwakrn/sql/new',
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Automatically enqueue discovery job scoped to this organization
    await admin.from('background_jobs').insert({
      organization_id: orgId,
      job_type: 'discover_businesses',
      payload: {
        campaignId: campaign.id,
        organizationId: orgId,
        geography: campaign.target_geographies[0] || 'Bengaluru',
        categories: campaign.target_industries,
        keywords: campaign.search_terms,
        limit: 10,
      },
      idempotency_key: `init-discovery-${campaign.id}`,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: unknown) {
    const error = err as any;
    const status = error.statusCode || (error.message?.includes('Unauthenticated') ? 401 : error.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: error.message }, { status });
  }
}
