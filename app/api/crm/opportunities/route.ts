// Evee - CRM Opportunities & Deals Registry Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import {
  getTenantOpportunities,
  getTenantCrmSettings,
  syncTenantCrm,
} from '@/lib/crm/store';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const [opportunities, settings] = await Promise.all([
      getTenantOpportunities(orgId),
      getTenantCrmSettings(orgId),
    ]);

    return NextResponse.json({
      success: true,
      opportunities,
      settings,
      totalCount: opportunities.length,
      protectedCount: opportunities.filter((o) =>
        settings.protectedStages.some((s) => s.toLowerCase() === o.stage.toLowerCase()) || o.isClosedWon
      ).length,
    });
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

    const orgId = userCtx.organizationId;
    const body = await req.json().catch(() => ({}));

    const result = await syncTenantCrm(orgId, body.credentials);
    const opportunities = await getTenantOpportunities(orgId);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.opportunitiesCount} opportunities from CRM.`,
      lastSyncedAt: result.lastSyncedAt,
      opportunities,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
