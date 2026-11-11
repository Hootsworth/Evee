// Evee - Enterprise Deliverability & Multi-Inbox Rotation Types

export type MailboxProvider = 'smtp' | 'google' | 'microsoft' | 'resend';

export type MailboxStatus = 'active' | 'warming' | 'paused' | 'quota_exhausted';

export type DomainStatus = 'healthy' | 'warning' | 'circuit_broken' | 'unverified';

export interface DnsCheckStatus {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  mx: boolean;
  spfRecord?: string;
  dkimRecord?: string;
  dmarcRecord?: string;
  lastCheckedAt: string;
}

export interface SendingDomain {
  id: string;
  organizationId: string;
  domain: string;
  status: DomainStatus;
  dns: DnsCheckStatus;
  bounceRate: number; // e.g. 0.012 for 1.2%
  spamComplaintRate: number; // e.g. 0.0005 for 0.05%
  circuitBreakerTripped: boolean;
  circuitBreakerReason?: string;
  dailySentCount: number;
  dailyLimit: number;
  warmupDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendingMailbox {
  id: string;
  organizationId: string;
  domainId: string;
  domainName: string;
  email: string;
  senderName: string;
  provider: MailboxProvider;
  credentials?: {
    user?: string;
    pass?: string;
    host?: string;
    port?: number;
    refreshToken?: string;
    accessToken?: string;
  };
  dailySentCount: number;
  dailyLimit: number; // Recommended: 35-50 sends/day
  status: MailboxStatus;
  warmupEnabled: boolean;
  warmupRampTarget?: number;
  lastUsedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RotationSelection {
  mailbox: SendingMailbox;
  domain: SendingDomain;
  remainingDailyQuota: number;
}

export interface MailboxRotationOptions {
  organizationId: string;
  recipientEmail?: string;
  excludeMailboxIds?: string[];
  preferredDomain?: string;
  cooldownWindowMinutes?: number;
}

export interface DeliverabilityPoolSummary {
  domainsCount: number;
  mailboxesCount: number;
  activeMailboxesCount: number;
  totalDailyCapacity: number;
  usedDailyCapacity: number;
  averageBounceRate: number;
  circuitBreakersActive: number;
}
