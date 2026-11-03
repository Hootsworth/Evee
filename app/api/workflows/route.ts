// Evee - Workflows API Handler (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const admin = createAdminClient();
    const orgId = userCtx.organizationId;

    const { data: workflows, error } = await admin
      .from('outreach_workflows')
      .select('*')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ workflows: [] });
    }

    return NextResponse.json({ workflows });
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

    const { data: workflow, error } = await admin
      .from('outreach_workflows')
      .insert({
        organization_id: orgId,
        name: body.name || 'Default Controlled Outreach',
        version: 1,
        status: 'pending_approval',
        configuration: body.configuration || {
          daily_limit: 5,
          monthly_limit: 100,
          followup_intervals_days: [4, 9],
          require_manual_review_for_uncertain_evidence: true,
          require_contact_verification: true,
          auto_send_enabled: false,
        },
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
