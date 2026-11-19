// Evee - CRM Opportunity Collision Check Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { checkCrmCollision } from '@/lib/crm/collision-guard';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const body = await req.json();

    // Supports single query or batch queries
    if (Array.isArray(body.queries)) {
      const results = await Promise.all(
        body.queries.map((q: any) => checkCrmCollision(orgId, q))
      );
      return NextResponse.json({ success: true, results });
    }

    const { email, domain, companyName } = body;
    const result = await checkCrmCollision(orgId, { email, domain, companyName });

    return NextResponse.json({
      success: true,
      collision: result,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
