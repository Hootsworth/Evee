import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTenantOpportunities,
  getTenantCrmSettings,
  updateTenantCrmSettings,
  syncTenantCrm,
  findCrmOpportunity,
} from '@/lib/crm/store';
import {
  checkCrmCollision,
  annotateLeadsWithCrmStatus,
} from '@/lib/crm/collision-guard';
import { sendEmailWithSafetyChecks } from '@/lib/providers/email/sender';

describe('Enterprise CRM Bi-Directional Sync & Opportunity Collision Guard', () => {
  const orgId = 'org_crm_test_suite';

  beforeEach(async () => {
    await updateTenantCrmSettings(orgId, {
      collisionProtectionEnabled: true,
      autoSuppressColdOutreach: true,
      protectedStages: [
        'Proposal / Price Quote',
        'Contract Sent',
        'Negotiation',
        'Closed Won',
      ],
    });
    await syncTenantCrm(orgId);
  });

  it('indexes CRM opportunities by domain and normalized company name', async () => {
    const opps = await getTenantOpportunities(orgId);
    expect(opps.length).toBeGreaterThan(0);

    const foundByDomain = findCrmOpportunity(orgId, { domain: 'nexustechnologies.com' });
    expect(foundByDomain).not.toBeNull();
    expect(foundByDomain?.companyName).toBe('Nexus Technologies');

    const foundByEmail = findCrmOpportunity(orgId, { email: 'cto@nexustechnologies.com' });
    expect(foundByEmail).not.toBeNull();

    const foundByName = findCrmOpportunity(orgId, { companyName: 'Nexus Technologies' });
    expect(foundByName).not.toBeNull();
  });

  it('detects active opportunity collision and commands suppression', async () => {
    const result = await checkCrmCollision(orgId, {
      email: 'sara@nexustechnologies.com',
    });

    expect(result.hasCollision).toBe(true);
    expect(result.shouldSuppress).toBe(true);
    expect(result.accountStatus).toBe('active_opportunity');
    expect(result.reason).toContain('Active');
    expect(result.reason).toContain('Nexus Technologies');
  });

  it('flags existing customer accounts (Closed Won) as protected', async () => {
    const result = await checkCrmCollision(orgId, {
      domain: 'starlightanalytics.io',
    });

    expect(result.hasCollision).toBe(true);
    expect(result.accountStatus).toBe('existing_customer');
    expect(result.shouldSuppress).toBe(true);
    expect(result.reason).toContain('Existing Customer Account');
  });

  it('allows cold outreach to standard prospects with no active CRM deal', async () => {
    const result = await checkCrmCollision(orgId, {
      email: 'founder@uncontactedstartup.com',
      domain: 'uncontactedstartup.com',
    });

    expect(result.hasCollision).toBe(false);
    expect(result.shouldSuppress).toBe(false);
    expect(result.accountStatus).toBe('prospect');
  });

  it('respects collision protection toggle when disabled', async () => {
    await updateTenantCrmSettings(orgId, { collisionProtectionEnabled: false });

    const result = await checkCrmCollision(orgId, {
      domain: 'nexustechnologies.com',
    });

    expect(result.hasCollision).toBe(false);
    expect(result.shouldSuppress).toBe(false);
  });

  it('blocks cold email dispatch through sendEmailWithSafetyChecks on collision', async () => {
    await updateTenantCrmSettings(orgId, {
      collisionProtectionEnabled: true,
      autoSuppressColdOutreach: true,
    });

    const sendAttempt = await sendEmailWithSafetyChecks({
      to: 'sarah@nexustechnologies.com',
      subject: 'Quick question regarding your tech stack',
      bodyText: 'Hi Sarah, noticed your team at Nexus Technologies...',
      organizationId: orgId,
    });

    expect(sendAttempt.success).toBe(false);
    expect(sendAttempt.suppressed).toBe(true);
    expect(sendAttempt.provider).toBe('crm_collision_guard');
    expect(sendAttempt.error).toContain('Outreach blocked by CRM Collision Guard');
  });

  it('annotates leads with CRM collision badges for UI rendering', async () => {
    const mockLeads = [
      {
        id: 'lead_1',
        display_name: 'Nexus Technologies',
        canonical_domain: 'nexustechnologies.com',
      },
      {
        id: 'lead_2',
        display_name: 'Fresh Lead Co',
        canonical_domain: 'freshlead.io',
      },
    ];

    const annotated = await annotateLeadsWithCrmStatus(orgId, mockLeads);
    expect(annotated[0].crm_collision).toBeDefined();
    expect(annotated[0].crm_collision.hasCollision).toBe(true);
    expect(annotated[0].crm_collision.dealName).toContain('Nexus');

    expect(annotated[1].crm_collision).toBeUndefined();
  });
});
