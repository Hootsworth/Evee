// Evee - Enterprise CRM Integration & Opportunity Collision Types

export type CrmProviderType = 'salesforce' | 'hubspot' | 'pipedrive' | 'close';

export type AccountLifecycleStatus =
  | 'prospect'
  | 'active_opportunity'
  | 'existing_customer'
  | 'closed_lost';

export interface CrmOpportunity {
  id: string;
  name: string;
  companyName: string;
  domain: string;
  stage: string;
  amount?: number;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
  closeDate?: string;
  ownerName?: string;
  ownerEmail?: string;
  provider: CrmProviderType;
  lastSyncedAt: string;
}

export interface CrmCollisionResult {
  hasCollision: boolean;
  accountStatus: AccountLifecycleStatus;
  reason?: string;
  opportunity?: CrmOpportunity;
  shouldSuppress: boolean;
}

export interface CrmSyncSettings {
  organizationId: string;
  provider: CrmProviderType;
  collisionProtectionEnabled: boolean;
  autoSuppressColdOutreach: boolean;
  protectedStages: string[];
  syncQualifiedLeads: boolean;
  logOutreachActivities: boolean;
  excludedDomains: string[];
  lastSyncAt?: string;
}

export interface CrmActivityLogPayload {
  recipientEmail: string;
  recipientName?: string;
  companyName?: string;
  subject: string;
  bodyPreview: string;
  eventType: 'sent' | 'opened' | 'replied' | 'bounced';
  sentiment?: string;
  sentAt: string;
}
