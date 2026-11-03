// Evee - Campaign Detail, Pause, Update Handler (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const { id } = await params;
    const admin = createAdminClient();

    const { data: campaign, error } = await admin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get campaign businesses
    const { data: businesses } = await admin
      .from('campaign_businesses')
      .select(`
        campaign_id,
        business_id,
        discovery_status,
        qualification_score,
        qualification_status,
        added_at,
        businesses (*)
      `)
      .eq('campaign_id', id);

    return NextResponse.json({ campaign, businesses: businesses || [] });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const { id } = await params;
    const body = await req.json();
    const admin = createAdminClient();

    // Prevent modifying organization_id
    delete body.organization_id;

    const { data, error } = await admin
      .from('campaigns')
      .update(body)
      .eq('id', id)
      .eq('organization_id', userCtx.organizationId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign: data });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
