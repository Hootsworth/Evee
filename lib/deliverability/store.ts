// Evee - Deliverability Store (Tenant-Isolated Domain & Mailbox Registry)
import { SendingDomain, SendingMailbox, DeliverabilityPoolSummary } from './types';
import { auditDomainDns, evaluateDomainCircuitBreaker } from './dns-monitor';

interface TenantPool {
  domains: Map<string, SendingDomain>;
  mailboxes: Map<string, SendingMailbox>;
  lastQuotaResetDay: number;
}

const tenantPools = new Map<string, TenantPool>();

function getTenantPool(orgId: string): TenantPool {
  let pool = tenantPools.get(orgId);
  const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));

  if (!pool) {
    pool = {
      domains: new Map(),
      mailboxes: new Map(),
      lastQuotaResetDay: currentDay,
    };
    tenantPools.set(orgId, pool);

    // Initialize with a default primary sending domain for ease of use
    const defaultDomain: SendingDomain = {
      id: `dom_${orgId.slice(0, 8)}_1`,
      organizationId: orgId,
      domain: 'tryevee.com',
      status: 'healthy',
      dns: {
        spf: true,
        dkim: true,
        dmarc: true,
        mx: true,
        lastCheckedAt: new Date().toISOString(),
      },
      bounceRate: 0.004,
      spamComplaintRate: 0.0001,
      circuitBreakerTripped: false,
      dailySentCount: 0,
      dailyLimit: 200,
      warmupDay: 14,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    pool.domains.set(defaultDomain.id, defaultDomain);

    const defaultMailbox: SendingMailbox = {
      id: `box_${orgId.slice(0, 8)}_1`,
      organizationId: orgId,
      domainId: defaultDomain.id,
      domainName: defaultDomain.domain,
      email: `outreach@${defaultDomain.domain}`,
      senderName: 'Evee Outreach',
      provider: 'smtp',
      dailySentCount: 0,
      dailyLimit: 40,
      status: 'active',
      warmupEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    pool.mailboxes.set(defaultMailbox.id, defaultMailbox);
  } else if (pool.lastQuotaResetDay !== currentDay) {
    // 24-hour quota rollover: reset daily counts for all mailboxes and domains
    for (const mb of pool.mailboxes.values()) {
      mb.dailySentCount = 0;
      if (mb.status === 'quota_exhausted') {
        mb.status = 'active';
      }
      mb.updatedAt = new Date().toISOString();
    }
    for (const dom of pool.domains.values()) {
      dom.dailySentCount = 0;
      dom.updatedAt = new Date().toISOString();
    }
    pool.lastQuotaResetDay = currentDay;
  }

  return pool;
}

export async function getTenantDomains(orgId: string): Promise<SendingDomain[]> {
  const pool = getTenantPool(orgId);
  return Array.from(pool.domains.values());
}

export async function getTenantMailboxes(orgId: string): Promise<SendingMailbox[]> {
  const pool = getTenantPool(orgId);
  return Array.from(pool.mailboxes.values());
}

export async function registerSendingDomain(
  orgId: string,
  domain: string,
  dailyLimit = 200
): Promise<SendingDomain> {
  const pool = getTenantPool(orgId);
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  // Check if domain already exists
  for (const existing of pool.domains.values()) {
    if (existing.domain === cleanDomain) {
      return existing;
    }
  }

  const dnsStatus = await auditDomainDns(cleanDomain);
  const tempDomain: SendingDomain = {
    id: `dom_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    organizationId: orgId,
    domain: cleanDomain,
    status: 'unverified',
    dns: dnsStatus,
    bounceRate: 0,
    spamComplaintRate: 0,
    circuitBreakerTripped: false,
    dailySentCount: 0,
    dailyLimit,
    warmupDay: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const evaluation = evaluateDomainCircuitBreaker(tempDomain);
  tempDomain.status = evaluation.status;
  tempDomain.circuitBreakerTripped = evaluation.circuitBreakerTripped;
  tempDomain.circuitBreakerReason = evaluation.reason;

  pool.domains.set(tempDomain.id, tempDomain);
  return tempDomain;
}

export async function registerSendingMailbox(
  orgId: string,
  data: {
    domainId: string;
    email: string;
    senderName: string;
    provider?: SendingMailbox['provider'];
    dailyLimit?: number;
    credentials?: SendingMailbox['credentials'];
    warmupEnabled?: boolean;
  }
): Promise<SendingMailbox> {
  const pool = getTenantPool(orgId);
  const domain = pool.domains.get(data.domainId);
  if (!domain) {
    throw new Error(`Domain with id ${data.domainId} does not exist in this organization.`);
  }

  const cleanEmail = data.email.toLowerCase().trim();

  // Check if email already registered
  for (const existing of pool.mailboxes.values()) {
    if (existing.email === cleanEmail) {
      return existing;
    }
  }

  const newMailbox: SendingMailbox = {
    id: `box_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    organizationId: orgId,
    domainId: domain.id,
    domainName: domain.domain,
    email: cleanEmail,
    senderName: data.senderName.trim(),
    provider: data.provider || 'smtp',
    credentials: data.credentials,
    dailySentCount: 0,
    dailyLimit: data.dailyLimit || 40,
    status: 'active',
    warmupEnabled: data.warmupEnabled ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pool.mailboxes.set(newMailbox.id, newMailbox);
  return newMailbox;
}

export async function removeSendingMailbox(orgId: string, mailboxId: string): Promise<boolean> {
  const pool = getTenantPool(orgId);
  return pool.mailboxes.delete(mailboxId);
}

export async function removeSendingDomain(orgId: string, domainId: string): Promise<boolean> {
  const pool = getTenantPool(orgId);
  // Also delete associated mailboxes
  for (const [id, mb] of pool.mailboxes.entries()) {
    if (mb.domainId === domainId) {
      pool.mailboxes.delete(id);
    }
  }
  return pool.domains.delete(domainId);
}

export async function toggleDomainCircuitBreaker(
  orgId: string,
  domainId: string,
  override = false
): Promise<SendingDomain> {
  const pool = getTenantPool(orgId);
  const domain = pool.domains.get(domainId);
  if (!domain) {
    throw new Error('Sending domain not found.');
  }

  domain.circuitBreakerTripped = override ? false : !domain.circuitBreakerTripped;
  domain.status = domain.circuitBreakerTripped ? 'circuit_broken' : 'healthy';
  if (!domain.circuitBreakerTripped) {
    domain.circuitBreakerReason = undefined;
  }
  domain.updatedAt = new Date().toISOString();
  return domain;
}

export async function getPoolSummary(orgId: string): Promise<DeliverabilityPoolSummary> {
  const pool = getTenantPool(orgId);
  const domains = Array.from(pool.domains.values());
  const mailboxes = Array.from(pool.mailboxes.values());

  const activeMailboxes = mailboxes.filter(
    (mb) => mb.status === 'active' || mb.status === 'warming'
  );

  const totalCapacity = activeMailboxes.reduce((acc, mb) => acc + mb.dailyLimit, 0);
  const usedCapacity = activeMailboxes.reduce((acc, mb) => acc + mb.dailySentCount, 0);

  const avgBounce =
    domains.length > 0
      ? domains.reduce((acc, d) => acc + d.bounceRate, 0) / domains.length
      : 0;

  const circuitBreakers = domains.filter((d) => d.circuitBreakerTripped).length;

  return {
    domainsCount: domains.length,
    mailboxesCount: mailboxes.length,
    activeMailboxesCount: activeMailboxes.length,
    totalDailyCapacity: totalCapacity,
    usedDailyCapacity: usedCapacity,
    averageBounceRate: avgBounce,
    circuitBreakersActive: circuitBreakers,
  };
}
