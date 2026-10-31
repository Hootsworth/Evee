import { describe, it, expect } from 'vitest';
import { recordAuditEvent, queryAuditEvents } from '@/lib/telemetry/audit';

describe('Audit Event Telemetry System', () => {
  it('records and queries audit trail events', async () => {
    const event = await recordAuditEvent({
      organizationId: 'org_test_audit',
      userId: 'usr_operator_1',
      actorEmail: 'operator@test.com',
      action: 'DRAFT_APPROVED',
      entityType: 'EMAIL_DRAFT',
      entityId: 'draft_999',
      metadata: { recipient: 'target@business.com', subject: 'Digital QR offer' },
    });

    expect(event.id).toMatch(/^aud_/);
    expect(event.action).toBe('DRAFT_APPROVED');
    expect(event.actorEmail).toBe('operator@test.com');

    // Query logs
    const logs = await queryAuditEvents({
      organizationId: 'org_test_audit',
      action: 'DRAFT_APPROVED',
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const found = logs.find((l) => l.id === event.id);
    expect(found).toBeDefined();
    expect(found?.entityId).toBe('draft_999');
  });

  it('filters audit records by action type', async () => {
    await recordAuditEvent({
      organizationId: 'org_filter_test',
      action: 'SUPPRESSION_ADDED',
      entityType: 'SUPPRESSION_LIST',
      metadata: { email: 'bad@domain.com' },
    });

    const supLogs = await queryAuditEvents({
      organizationId: 'org_filter_test',
      action: 'SUPPRESSION_ADDED',
    });

    expect(supLogs.every((l) => l.action === 'SUPPRESSION_ADDED')).toBe(true);
  });
});
