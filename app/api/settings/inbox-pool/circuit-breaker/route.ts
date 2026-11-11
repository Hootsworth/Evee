// Evee - Circuit Breaker Override & Reset Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { toggleDomainCircuitBreaker } from '@/lib/deliverability/store';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const orgId = userCtx.organizationId;
    const body = await req.json();
    const { domainId, override } = body;

    if (!domainId) {
      return NextResponse.json({ error: 'domainId is required.' }, { status: 400 });
    }

    const updatedDomain = await toggleDomainCircuitBreaker(orgId, domainId, Boolean(override));

    return NextResponse.json({
      success: true,
      domain: updatedDomain,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
