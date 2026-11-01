// Evee - Connectors & Integrations Type System

export type IntegrationCategory = 'crm' | 'outreach_engine' | 'enrichment' | 'notifications';

export type IntegrationProviderId =
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'close'
  | 'smartlead'
  | 'instantly'
  | 'resend'
  | 'postmark'
  | 'apollo'
  | 'hunter'
  | 'builtwith'
  | 'slack'
  | 'discord'
  | 'zapier';

export interface IntegrationDefinition {
  id: IntegrationProviderId;
  name: string;
  category: IntegrationCategory;
  description: string;
  websiteUrl: string;
  authType: 'api_key' | 'webhook_url' | 'oauth_token';
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    isSecret?: boolean;
    defaultValue?: string;
  }>;
}

export interface IntegrationConfigRecord {
  providerId: IntegrationProviderId;
  enabled: boolean;
  configured: boolean;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
  lastTestMessage?: string;
  lastSyncAt?: string;
  syncedRecordsCount?: number;
  config: Record<string, string>;
}
