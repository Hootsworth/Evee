// Evee - Intelligent Mailbox Rotation & Load Balancing Engine
// Enforces: Daily quota throttling, domain health guard, circuit breakers, and recipient domain spacing

import {
  SendingMailbox,
  SendingDomain,
  RotationSelection,
  MailboxRotationOptions,
} from './types';
import { getTenantDomains, getTenantMailboxes } from './store';

// Map tracking recent sends to recipient domains: Map<"mailboxId:recipientDomain", timestamp>
const recipientDomainSpacingLog = new Map<string, number>();

export async function selectNextSendingMailbox(
  options: MailboxRotationOptions
): Promise<RotationSelection | null> {
  const {
    organizationId,
    recipientEmail,
    excludeMailboxIds = [],
    preferredDomain,
    cooldownWindowMinutes = 15,
  } = options;

  const domains = await getTenantDomains(organizationId);
  const mailboxes = await getTenantMailboxes(organizationId);

  const domainMap = new Map<string, SendingDomain>(domains.map((d) => [d.id, d]));

  // Extract recipient company domain for collision / spacing check (e.g. "acme.com")
  let recipientDomain: string | null = null;
  if (recipientEmail && recipientEmail.includes('@')) {
    recipientDomain = recipientEmail.split('@')[1].toLowerCase().trim();
  }

  const now = Date.now();
  const cooldownMs = cooldownWindowMinutes * 60 * 1000;

  // 1. Filter eligible mailboxes
  const candidates: Array<{ mailbox: SendingMailbox; domain: SendingDomain; utilization: number }> = [];

  for (const mb of mailboxes) {
    if (excludeMailboxIds.includes(mb.id)) continue;

    const domain = domainMap.get(mb.domainId);
    if (!domain) continue;

    // Safety Gate 1: Check Domain Circuit Breaker
    if (domain.circuitBreakerTripped || domain.status === 'circuit_broken') {
      continue;
    }

    // Safety Gate 2: Check Mailbox Status & Daily Quota
    if (mb.status === 'paused') continue;
    if (mb.dailySentCount >= mb.dailyLimit) {
      mb.status = 'quota_exhausted';
      continue;
    }

    // Safety Gate 3: Preferred Domain Match (if specified)
    if (preferredDomain && domain.domain.toLowerCase() !== preferredDomain.toLowerCase()) {
      continue;
    }

    // Safety Gate 4: Recipient Domain Spacing
    // Prevents the same mailbox from bombarding multiple employees at the same target company within cooldown
    if (recipientDomain) {
      const spacingKey = `${mb.id}:${recipientDomain}`;
      const lastSentTime = recipientDomainSpacingLog.get(spacingKey);
      if (lastSentTime && now - lastSentTime < cooldownMs) {
        continue;
      }
    }

    const utilization = mb.dailySentCount / Math.max(mb.dailyLimit, 1);
    candidates.push({ mailbox: mb, domain, utilization });
  }

  if (candidates.length === 0) {
    return null;
  }

  // 2. Load-Balance: Select the candidate with the lowest quota utilization
  // Tie-breaker: Least Recently Used (oldest lastUsedAt or null)
  candidates.sort((a, b) => {
    if (Math.abs(a.utilization - b.utilization) > 0.05) {
      return a.utilization - b.utilization;
    }
    const aTime = a.mailbox.lastUsedAt ? new Date(a.mailbox.lastUsedAt).getTime() : 0;
    const bTime = b.mailbox.lastUsedAt ? new Date(b.mailbox.lastUsedAt).getTime() : 0;
    return aTime - bTime;
  });

  const selected = candidates[0];
  const remainingQuota = Math.max(0, selected.mailbox.dailyLimit - selected.mailbox.dailySentCount);

  return {
    mailbox: selected.mailbox,
    domain: selected.domain,
    remainingDailyQuota: remainingQuota,
  };
}

/**
 * Records a successful email dispatch: increments daily count, updates timestamps and spacing log.
 */
export async function recordMailboxSend(
  organizationId: string,
  mailboxId: string,
  recipientEmail?: string
): Promise<void> {
  const mailboxes = await getTenantMailboxes(organizationId);
  const domains = await getTenantDomains(organizationId);

  const mb = mailboxes.find((m) => m.id === mailboxId);
  if (!mb) return;

  const nowIso = new Date().toISOString();
  mb.dailySentCount++;
  mb.lastUsedAt = nowIso;
  mb.updatedAt = nowIso;

  if (mb.dailySentCount >= mb.dailyLimit) {
    mb.status = 'quota_exhausted';
  }

  const domain = domains.find((d) => d.id === mb.domainId);
  if (domain) {
    domain.dailySentCount++;
    domain.updatedAt = nowIso;
  }

  if (recipientEmail && recipientEmail.includes('@')) {
    const domainPart = recipientEmail.split('@')[1].toLowerCase().trim();
    const spacingKey = `${mb.id}:${domainPart}`;
    recipientDomainSpacingLog.set(spacingKey, Date.now());
  }
}

/**
 * Records a bounce or delivery failure, updating domain telemetry and potentially tripping circuit breakers.
 */
export async function recordMailboxFailure(
  organizationId: string,
  mailboxId: string,
  errorSummary: string,
  isBounce = false
): Promise<void> {
  const mailboxes = await getTenantMailboxes(organizationId);
  const domains = await getTenantDomains(organizationId);

  const mb = mailboxes.find((m) => m.id === mailboxId);
  if (!mb) return;

  mb.lastError = errorSummary;
  mb.updatedAt = new Date().toISOString();

  if (isBounce) {
    const domain = domains.find((d) => d.id === mb.domainId);
    if (domain) {
      // Micro-increment bounce rate estimation
      domain.bounceRate = Math.min(1.0, domain.bounceRate + 0.005);
      if (domain.bounceRate >= 0.02) {
        domain.circuitBreakerTripped = true;
        domain.status = 'circuit_broken';
        domain.circuitBreakerReason = `Automated circuit breaker tripped: Bounce rate spiked to ${(domain.bounceRate * 100).toFixed(1)}%`;
      }
      domain.updatedAt = new Date().toISOString();
    }
  }
}
