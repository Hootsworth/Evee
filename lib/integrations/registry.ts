// Evee - Connectors & Integrations Registry
import { IntegrationDefinition } from './types';

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  // 1. CRM & Pipeline Connectors
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    category: 'crm',
    description: 'Two-way contact & deal synchronization. Automatically creates Deals when prospects reply with interest.',
    websiteUrl: 'https://hubspot.com',
    authType: 'api_key',
    fields: [
      { key: 'accessToken', label: 'Private App Access Token', placeholder: 'pat-na1-...', isSecret: true },
      { key: 'pipelineId', label: 'Deal Pipeline ID (Optional)', placeholder: 'default' },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Enterprise sync with Lead and Account objects. Respects internal ownership and suppression lists.',
    websiteUrl: 'https://salesforce.com',
    authType: 'oauth_token',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://yourinstance.salesforce.com' },
      { key: 'apiToken', label: 'Security Token / Session Token', placeholder: 'sf_token_...', isSecret: true },
    ],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'crm',
    description: 'Creates Organizations, Persons, and Deals in your pipeline automatically upon lead qualification.',
    websiteUrl: 'https://pipedrive.com',
    authType: 'api_key',
    fields: [
      { key: 'apiToken', label: 'Personal API Token', placeholder: 'pipedrive_api_token', isSecret: true },
      { key: 'companyDomain', label: 'Company Subdomain', placeholder: 'yourcompany' },
    ],
  },
  {
    id: 'close',
    name: 'Close CRM',
    category: 'crm',
    description: 'Fast B2B founder CRM sync with custom fields for empirical observations and qualification scores.',
    websiteUrl: 'https://close.com',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Close API Key', placeholder: 'api_...', isSecret: true },
    ],
  },

  // 2. Cold Outreach & Sending Engines
  {
    id: 'smartlead',
    name: 'Smartlead.ai',
    category: 'outreach_engine',
    description: 'Export leads and campaigns directly to Smartlead for unlimited inbox rotation and warmup.',
    websiteUrl: 'https://smartlead.ai',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Smartlead API Key', placeholder: 'sl_api_key_...', isSecret: true },
      { key: 'defaultCampaignId', label: 'Default Campaign ID (Optional)', placeholder: '12345' },
    ],
  },
  {
    id: 'instantly',
    name: 'Instantly.ai',
    category: 'outreach_engine',
    description: 'Push verified prospects into Instantly campaigns with variable mapping and automated warmup monitoring.',
    websiteUrl: 'https://instantly.ai',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Instantly V2 API Key', placeholder: 'instantly_api_key_...', isSecret: true },
      { key: 'campaignId', label: 'Campaign ID (Optional)', placeholder: 'cmp_...' },
    ],
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'outreach_engine',
    description: 'Modern developer transactional and batch cold email infrastructure with built-in DKIM compliance.',
    websiteUrl: 'https://resend.com',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Resend API Key', placeholder: 're_...', isSecret: true },
      { key: 'fromDomain', label: 'Verified Sending Domain', placeholder: 'outreach.yourdomain.com' },
    ],
  },
  {
    id: 'postmark',
    name: 'Postmark',
    category: 'outreach_engine',
    description: 'Ultra-high deliverability email API with granular bounce tracking and inbox placement priority.',
    websiteUrl: 'https://postmarkapp.com',
    authType: 'api_key',
    fields: [
      { key: 'serverToken', label: 'Server API Token', placeholder: 'postmark_server_token_...', isSecret: true },
    ],
  },

  // 3. Lead Intelligence & Data Enrichment
  {
    id: 'apollo',
    name: 'Apollo.io',
    category: 'enrichment',
    description: 'Direct mobile phone, executive title, and verified email discovery for B2B decision makers.',
    websiteUrl: 'https://apollo.io',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Apollo API Key', placeholder: 'apollo_api_key_...', isSecret: true },
    ],
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    category: 'enrichment',
    description: 'Domain email pattern analysis and real-time SMTP deliverability verification.',
    websiteUrl: 'https://hunter.io',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Hunter API Key', placeholder: 'hunter_api_key_...', isSecret: true },
    ],
  },
  {
    id: 'builtwith',
    name: 'BuiltWith / Tech Stack Detector',
    category: 'enrichment',
    description: 'Detects website technologies (Shopify, WordPress, Square, React, outdated plugins) to power empirical pitches.',
    websiteUrl: 'https://builtwith.com',
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'BuiltWith API Key (Optional; fallback to native crawler)', placeholder: 'bw_api_key_...', isSecret: true },
    ],
  },

  // 4. Notifications & Workflow Webhooks
  {
    id: 'slack',
    name: 'Slack Webhook Alerts',
    category: 'notifications',
    description: 'Instant notification cards to #hot-leads when a prospect replies with interest, books a meeting, or batch finishes.',
    websiteUrl: 'https://slack.com',
    authType: 'webhook_url',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/...', isSecret: true },
      { key: 'channelName', label: 'Alert Channel', placeholder: '#hot-leads' },
    ],
  },
  {
    id: 'discord',
    name: 'Discord Webhook Alerts',
    category: 'notifications',
    description: 'Formatted rich embeds sent to Discord when hot leads are discovered or reply to outreach.',
    websiteUrl: 'https://discord.com',
    authType: 'webhook_url',
    fields: [
      { key: 'webhookUrl', label: 'Discord Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', isSecret: true },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier / Make.com Webhook Gateway',
    category: 'notifications',
    description: 'Dispatches real-time JSON payloads on events (lead.created, draft.approved, reply.interested).',
    websiteUrl: 'https://zapier.com',
    authType: 'webhook_url',
    fields: [
      { key: 'webhookUrl', label: 'Catch Hook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...' },
      { key: 'secretKey', label: 'Signing Secret (Optional)', placeholder: 'whsec_...', isSecret: true },
    ],
  },
];
