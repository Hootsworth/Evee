import { describe, it, expect } from 'vitest';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';

describe('Connectors & Integrations Registry', () => {
  it('registers all required CRM, outreach, intelligence, and notification connectors', () => {
    const ids = INTEGRATION_REGISTRY.map((i) => i.id);

    // CRMs
    expect(ids).toContain('hubspot');
    expect(ids).toContain('salesforce');
    expect(ids).toContain('pipedrive');
    expect(ids).toContain('close');

    // Outreach
    expect(ids).toContain('smartlead');
    expect(ids).toContain('instantly');
    expect(ids).toContain('resend');
    expect(ids).toContain('postmark');

    // Intelligence
    expect(ids).toContain('apollo');
    expect(ids).toContain('hunter');
    expect(ids).toContain('builtwith');

    // Notifications
    expect(ids).toContain('slack');
    expect(ids).toContain('discord');
    expect(ids).toContain('zapier');
  });

  it('marks secret fields correctly for AES-256 encryption', () => {
    const hubspot = INTEGRATION_REGISTRY.find((i) => i.id === 'hubspot');
    expect(hubspot).toBeDefined();
    const tokenField = hubspot?.fields.find((f) => f.key === 'accessToken');
    expect(tokenField?.isSecret).toBe(true);

    const slack = INTEGRATION_REGISTRY.find((i) => i.id === 'slack');
    expect(slack).toBeDefined();
    const webhookField = slack?.fields.find((f) => f.key === 'webhookUrl');
    expect(webhookField?.isSecret).toBe(true);
  });
});
