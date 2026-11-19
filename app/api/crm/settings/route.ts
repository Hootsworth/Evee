// Evee - CRM Synchronization & Collision Protection Settings Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { getTenantCrmSettings, updateTenantCrmSettings } from '@/lib/crm/store';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const settings = await getTenantCrmSettings(orgId);

    return NextResponse.json({
      success: true,
      settings,
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
    const body = await req.json();

    const updated = await updateTenantCrmSettings(orgId, body);

    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
