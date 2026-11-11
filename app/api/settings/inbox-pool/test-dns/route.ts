// Evee - Live DNS Verification for Sending Domains
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { getTenantDomains } from '@/lib/deliverability/store';
import { auditDomainDns, evaluateDomainCircuitBreaker } from '@/lib/deliverability/dns-monitor';

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const orgId = userCtx.organizationId;
    const body = await req.json();
    const { domainId, selector = 'resend' } = body;

    const domains = await getTenantDomains(orgId);
    const target = domains.find((d) => d.id === domainId);

    if (!target) {
      return NextResponse.json({ error: 'Domain not found in this organization' }, { status: 404 });
    }

    const dnsResults = await auditDomainDns(target.domain, selector);
    target.dns = dnsResults;

    const evaluation = evaluateDomainCircuitBreaker(target);
    target.status = evaluation.status;
    target.circuitBreakerTripped = evaluation.circuitBreakerTripped;
    target.circuitBreakerReason = evaluation.reason;
    target.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      domain: target,
      dns: dnsResults,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
