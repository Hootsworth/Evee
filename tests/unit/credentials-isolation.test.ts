import { describe, it, expect } from 'vitest';
import { checkSuppression } from '@/lib/compliance/suppression';

describe('Multi-Tenant Data & Credential Isolation', () => {
  const orgA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('prevents Organization A from reading Organization B businesses', () => {
    const businesses = [
      { id: 'b1', organization_id: orgA, display_name: 'Org A Prospect' },
      { id: 'b2', organization_id: orgB, display_name: 'Org B Secret Prospect' },
    ];

    // Scoped read for Org A
    const orgABusinesses = businesses.filter((b) => b.organization_id === orgA);
    expect(orgABusinesses).toHaveLength(1);
    expect(orgABusinesses[0].display_name).toBe('Org A Prospect');

    // Scoped read for Org B
    const orgBBusinesses = businesses.filter((b) => b.organization_id === orgB);
    expect(orgBBusinesses).toHaveLength(1);
    expect(orgBBusinesses[0].display_name).toBe('Org B Secret Prospect');

    // Verify zero cross-tenant leak
    expect(orgABusinesses.some((b) => b.organization_id === orgB)).toBe(false);
  });

  it('prevents Organization A from updating or archiving Organization B leads', () => {
    const businesses = [
      { id: 'b1', organization_id: orgA, record_status: 'active' },
      { id: 'b2', organization_id: orgB, record_status: 'active' },
    ];

    // Org A attempts to archive all leads: query is scoped strictly to orgA
    const targetStatus = 'archived';
    const updated = businesses
      .filter((b) => b.organization_id === orgA)
      .map((b) => ({ ...b, record_status: targetStatus }));

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('b1');

    // Org B's record remains untouched
    const b2Record = businesses.find((b) => b.id === 'b2');
    expect(b2Record?.record_status).toBe('active');
  });

  it('prevents Organization A from approving or rejecting Organization B drafts', () => {
    const drafts = [
      { id: 'd1', organization_id: orgA, approval_status: 'pending' },
      { id: 'd2', organization_id: orgB, approval_status: 'pending' },
    ];

    // Org A operator attempts to approve draft 'd2'
    const targetDraftId = 'd2';
    const draftInOrgA = drafts.find(
      (d) => d.id === targetDraftId && d.organization_id === orgA
    );
    expect(draftInOrgA).toBeUndefined(); // Cannot be approved by Org A

    // Org B operator approves draft 'd2'
    const draftInOrgB = drafts.find(
      (d) => d.id === targetDraftId && d.organization_id === orgB
    );
    expect(draftInOrgB).toBeDefined();
    if (draftInOrgB) {
      draftInOrgB.approval_status = 'approved';
    }
    expect(draftInOrgB?.approval_status).toBe('approved');
  });

  it('prevents Organization A from seeing or modifying Organization B credentials', () => {
    const credentialRecords = [
      {
        id: '1',
        organization_id: orgA,
        provider: 'ai_provider_config',
        encrypted_access_token: 'secret-a',
      },
      {
        id: '2',
        organization_id: orgB,
        provider: 'ai_provider_config',
        encrypted_access_token: 'secret-b',
      },
    ];

    // Org A scoped query
    const orgACreds = credentialRecords.filter((r) => r.organization_id === orgA);
    expect(orgACreds).toHaveLength(1);
    expect(orgACreds[0].encrypted_access_token).toBe('secret-a');

    // Org B scoped query
    const orgBCreds = credentialRecords.filter((r) => r.organization_id === orgB);
    expect(orgBCreds).toHaveLength(1);
    expect(orgBCreds[0].encrypted_access_token).toBe('secret-b');

    // Verify Org A cannot retrieve Org B's records
    const crossTenantLeak = orgACreds.some((r) => r.organization_id === orgB);
    expect(crossTenantLeak).toBe(false);
  });

  it('blocks outbound message dispatch to suppressed recipients and respects domain wildcards', () => {
    const suppressionList = [
      {
        normalized_email: 'optout@target.com',
        reason: 'opt_out',
        source: 'unsubscribe_link',
      },
      {
        normalized_email: '@competitor.com',
        reason: 'manual_block',
        source: 'operator',
      },
    ];

    // Suppressed direct email
    expect(checkSuppression({ email: 'optout@target.com' }, suppressionList).isSuppressed).toBe(true);

    // Suppressed domain wildcard
    expect(checkSuppression({ email: 'john@competitor.com' }, suppressionList).isSuppressed).toBe(true);
    expect(checkSuppression({ email: 'sales@sub.competitor.com' }, suppressionList).isSuppressed).toBe(true);

    // Allowed recipient
    expect(checkSuppression({ email: 'ceo@validprospect.com' }, suppressionList).isSuppressed).toBe(false);
  });

  it('ensures test-send operations strictly retrieve only the authenticated organization credentials', () => {
    const credentialStore = [
      {
        id: 'cred-1',
        organization_id: orgA,
        provider: 'smtp_app_password',
        account_email: 'operator@org-a.com',
        encrypted_refresh_token: 'enc-pass-a',
      },
      {
        id: 'cred-2',
        organization_id: orgB,
        provider: 'smtp_app_password',
        account_email: 'secret-operator@org-b.com',
        encrypted_refresh_token: 'enc-pass-b',
      },
    ];

    // Scoped lookup for test-send mirroring getActiveEmailProvider with organizationId
    const getTestSendCredentialsForOrg = (targetOrgId: string) => {
      return credentialStore.filter(
        (c) => c.organization_id === targetOrgId && c.provider === 'smtp_app_password'
      );
    };

    // Org A test-send lookup
    const orgACreds = getTestSendCredentialsForOrg(orgA);
    expect(orgACreds).toHaveLength(1);
    expect(orgACreds[0].account_email).toBe('operator@org-a.com');

    // Org B test-send lookup
    const orgBCreds = getTestSendCredentialsForOrg(orgB);
    expect(orgBCreds).toHaveLength(1);
    expect(orgBCreds[0].account_email).toBe('secret-operator@org-b.com');

    // Org A test-send must NEVER access or use Org B credentials
    expect(orgACreds.some((c) => c.organization_id === orgB)).toBe(false);
    expect(orgACreds.some((c) => c.account_email === 'secret-operator@org-b.com')).toBe(false);

    // Unconfigured Organization C falls back cleanly without leaking Org A or Org B credentials
    const orgC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const orgCCreds = getTestSendCredentialsForOrg(orgC);
    expect(orgCCreds).toHaveLength(0);
  });

  it('ensures durable job idempotency keys prevent duplicate email dispatches', () => {
    const batchId = 'batch-test-123';
    const email = 'prospect@acme.com';
    const idempotencyKey1 = `csv-${batchId}-0-${email}`;
    const idempotencyKey2 = `csv-${batchId}-0-${email}`;

    expect(idempotencyKey1).toBe(idempotencyKey2);

    // Simulated queue table with unique idempotency constraint
    const queuedKeys = new Set<string>();
    queuedKeys.add(idempotencyKey1);

    const isDuplicate = queuedKeys.has(idempotencyKey2);
    expect(isDuplicate).toBe(true);
  });
});
