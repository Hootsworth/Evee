import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerSendingDomain,
  registerSendingMailbox,
  getTenantDomains,
  getTenantMailboxes,
  getPoolSummary,
  toggleDomainCircuitBreaker,
} from '@/lib/deliverability/store';
import {
  selectNextSendingMailbox,
  recordMailboxSend,
  recordMailboxFailure,
} from '@/lib/deliverability/rotator';
import { auditDomainDns, evaluateDomainCircuitBreaker } from '@/lib/deliverability/dns-monitor';

describe('Enterprise Multi-Inbox Rotation & Deliverability Governance', () => {
  const orgId = 'org_enterprise_test_1';

  it('audits DNS records and identifies valid SPF, DKIM, DMARC', async () => {
    const dnsStatus = await auditDomainDns('tryevee.com');
    expect(dnsStatus.spf).toBe(true);
    expect(dnsStatus.dkim).toBe(true);
    expect(dnsStatus.dmarc).toBe(true);
    expect(dnsStatus.mx).toBe(true);
  });

  it('evaluates domain circuit breaker rules', () => {
    const healthyDomain: any = {
      domain: 'tryevee.com',
      dns: { spf: true, dkim: true, dmarc: true, mx: true },
      bounceRate: 0.005, // 0.5%
      spamComplaintRate: 0.0001,
    };
    const evalHealthy = evaluateDomainCircuitBreaker(healthyDomain);
    expect(evalHealthy.circuitBreakerTripped).toBe(false);
    expect(evalHealthy.status).toBe('healthy');

    // Bounce spike over 2%
    const badBounceDomain: any = {
      domain: 'riskyoutbound.com',
      dns: { spf: true, dkim: true, dmarc: true, mx: true },
      bounceRate: 0.025, // 2.5%
      spamComplaintRate: 0.0001,
    };
    const evalBounce = evaluateDomainCircuitBreaker(badBounceDomain);
    expect(evalBounce.circuitBreakerTripped).toBe(true);
    expect(evalBounce.status).toBe('circuit_broken');
    expect(evalBounce.reason).toContain('High bounce rate');

    // Missing SPF/DKIM
    const missingDnsDomain: any = {
      domain: 'unverified.com',
      dns: { spf: false, dkim: true, dmarc: false, mx: true },
      bounceRate: 0,
      spamComplaintRate: 0,
    };
    const evalDns = evaluateDomainCircuitBreaker(missingDnsDomain);
    expect(evalDns.circuitBreakerTripped).toBe(true);
    expect(evalDns.status).toBe('circuit_broken');
  });

  it('rotates mailboxes based on least utilization and daily quotas', async () => {
    const domain = await registerSendingDomain(orgId, 'tryevee.com', 200);

    const mb1 = await registerSendingMailbox(orgId, {
      domainId: domain.id,
      email: 'sarah@tryevee.com',
      senderName: 'Sarah Chen',
      dailyLimit: 2, // low limit for testing
    });

    const mb2 = await registerSendingMailbox(orgId, {
      domainId: domain.id,
      email: 'alex@tryevee.com',
      senderName: 'Alex Mercer',
      dailyLimit: 2,
    });

    // Selection 1: should pick one of them
    const sel1 = await selectNextSendingMailbox({ organizationId: orgId });
    expect(sel1).not.toBeNull();
    const firstChosen = sel1!.mailbox.id;

    // Record send on first mailbox
    await recordMailboxSend(orgId, firstChosen, 'client@target.com');

    // Selection 2: should rotate to the other mailbox with 0 sends!
    const sel2 = await selectNextSendingMailbox({ organizationId: orgId });
    expect(sel2).not.toBeNull();
    expect(sel2!.mailbox.id).not.toBe(firstChosen);

    // Record send on second mailbox
    await recordMailboxSend(orgId, sel2!.mailbox.id, 'client2@target.com');

    // Record second send on both so they hit their dailyLimit of 2
    await recordMailboxSend(orgId, firstChosen, 'client3@target.com');
    await recordMailboxSend(orgId, sel2!.mailbox.id, 'client4@target.com');

    // Selection 3: Both mb1 and mb2 hit dailyLimit (2/2) -> they are quota_exhausted!
    const sel3 = await selectNextSendingMailbox({
      organizationId: orgId,
      excludeMailboxIds: [`box_${orgId.slice(0, 8)}_1`], // exclude default box if present
    });
    // Should be null or only return an unexhausted mailbox
    if (sel3) {
      expect(sel3.mailbox.dailySentCount).toBeLessThan(sel3.mailbox.dailyLimit);
    }
  });

  it('enforces recipient domain spacing to prevent target company spam triggers', async () => {
    const spacingOrg = 'org_spacing_test';
    const domain = await registerSendingDomain(spacingOrg, 'tryevee.com', 100);

    const mb1 = await registerSendingMailbox(spacingOrg, {
      domainId: domain.id,
      email: 'rep1@tryevee.com',
      senderName: 'Rep 1',
      dailyLimit: 50,
    });

    const mb2 = await registerSendingMailbox(spacingOrg, {
      domainId: domain.id,
      email: 'rep2@tryevee.com',
      senderName: 'Rep 2',
      dailyLimit: 50,
    });

    // Send email to contact at acmecorp.com from mb1
    await recordMailboxSend(spacingOrg, mb1.id, 'ceo@acmecorp.com');

    // Immediately select next mailbox for another contact at acmecorp.com
    const selNext = await selectNextSendingMailbox({
      organizationId: spacingOrg,
      recipientEmail: 'cto@acmecorp.com',
      excludeMailboxIds: [`box_${spacingOrg.slice(0, 8)}_1`],
      cooldownWindowMinutes: 10,
    });

    // Must NOT select mb1 because mb1 just sent to acmecorp.com! Must rotate to mb2!
    expect(selNext).not.toBeNull();
    expect(selNext!.mailbox.id).toBe(mb2.id);
  });

  it('skips mailboxes when the parent domain circuit breaker is tripped', async () => {
    const circuitOrg = 'org_circuit_test';
    const domain = await registerSendingDomain(circuitOrg, 'badreputation.com', 50);

    const mb = await registerSendingMailbox(circuitOrg, {
      domainId: domain.id,
      email: 'sales@badreputation.com',
      senderName: 'Sales Rep',
      dailyLimit: 50,
    });

    // Trip the circuit breaker on badreputation.com
    await toggleDomainCircuitBreaker(circuitOrg, domain.id, false);

    // Rotation should skip this mailbox completely
    const sel = await selectNextSendingMailbox({
      organizationId: circuitOrg,
      preferredDomain: 'badreputation.com',
    });

    expect(sel).toBeNull();
  });

  it('computes accurate pool summary metrics', async () => {
    const summaryOrg = 'org_summary_test';
    const domain = await registerSendingDomain(summaryOrg, 'growthleads.io', 150);
    await registerSendingMailbox(summaryOrg, {
      domainId: domain.id,
      email: 'hello@growthleads.io',
      senderName: 'Growth Team',
      dailyLimit: 45,
    });

    const summary = await getPoolSummary(summaryOrg);
    expect(summary.domainsCount).toBeGreaterThanOrEqual(1);
    expect(summary.mailboxesCount).toBeGreaterThanOrEqual(1);
    expect(summary.totalDailyCapacity).toBeGreaterThan(0);
  });
});
