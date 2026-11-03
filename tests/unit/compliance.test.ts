import { describe, it, expect } from 'vitest';
import {
  checkSuppression,
  extractEmailDomain,
  matchesEmailPattern,
  normalizeEmail,
  normalizePhone,
} from '@/lib/compliance/suppression';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';

describe('Suppression & Compliance Verification', () => {
  it('normalizes email addresses and phone numbers correctly', () => {
    expect(normalizeEmail('  Test.User@Example.COM ')).toBe('test.user@example.com');
    expect(normalizePhone('+91 (987) 65-43210')).toBe('+919876543210');
    expect(extractEmailDomain('user@corp.example.com')).toBe('corp.example.com');
  });

  it('detects suppressed email case-insensitively', () => {
    const list = [
      {
        normalized_email: 'optout@example.com',
        normalized_phone: null,
        reason: 'opt_out',
        source: 'unsubscribe_link',
      },
    ];

    const result = checkSuppression({ email: 'OPTOUT@EXAMPLE.COM' }, list);
    expect(result.isSuppressed).toBe(true);
    expect(result.reason).toBe('opt_out');
  });

  it('detects wildcard domain suppression (@domain.com, *@domain.com, domain.com)', () => {
    expect(matchesEmailPattern('ceo@competitor.com', '@competitor.com')).toBe(true);
    expect(matchesEmailPattern('sales@competitor.com', '*@competitor.com')).toBe(true);
    expect(matchesEmailPattern('hr@sub.competitor.com', '@competitor.com')).toBe(true);
    expect(matchesEmailPattern('team@competitor.com', 'competitor.com')).toBe(true);
    expect(matchesEmailPattern('innocent@another-company.com', '@competitor.com')).toBe(false);

    const list = [
      {
        normalized_email: '@spamdomain.com',
        reason: 'manual_block',
        source: 'operator_action',
      },
      {
        normalized_email: '*@competitor.io',
        reason: 'opt_out',
        source: 'unsubscribe',
      },
    ];

    const res1 = checkSuppression({ email: 'user@spamdomain.com' }, list);
    expect(res1.isSuppressed).toBe(true);
    expect(res1.reason).toBe('manual_block');

    const res2 = checkSuppression({ email: 'lead@competitor.io' }, list);
    expect(res2.isSuppressed).toBe(true);
    expect(res2.reason).toBe('opt_out');

    const res3 = checkSuppression({ email: 'legitimate@acme.org' }, list);
    expect(res3.isSuppressed).toBe(false);
  });

  it('enforces tenant-level suppression isolation', () => {
    const orgA = '11111111-1111-1111-1111-111111111111';
    const orgB = '22222222-2222-2222-2222-222222222222';

    const records = [
      {
        normalized_email: 'contact@acme.com',
        reason: 'opt_out',
        source: 'inbound_reply',
        organization_id: orgA,
      },
      {
        normalized_email: '@global-block.com',
        reason: 'legal_restriction',
        source: 'system',
        organization_id: null, // Global
      },
    ];

    // Org A cannot contact contact@acme.com
    const resultOrgA = checkSuppression({ email: 'contact@acme.com' }, records, orgA);
    expect(resultOrgA.isSuppressed).toBe(true);

    // Org B CAN contact contact@acme.com because Org A's opt-out was tenant-scoped
    const resultOrgB = checkSuppression({ email: 'contact@acme.com' }, records, orgB);
    expect(resultOrgB.isSuppressed).toBe(false);

    // Both Org A and Org B are blocked from global-block.com
    expect(checkSuppression({ email: 'lead@global-block.com' }, records, orgA).isSuppressed).toBe(true);
    expect(checkSuppression({ email: 'lead@global-block.com' }, records, orgB).isSuppressed).toBe(true);
  });

  it('allows unsuppressed email through', () => {
    const list = [
      {
        normalized_email: 'blocked@example.com',
        reason: 'manual_block',
        source: 'manual',
      },
    ];

    const result = checkSuppression({ email: 'safe.lead@company.com' }, list);
    expect(result.isSuppressed).toBe(false);
  });
});

describe('AES-256-GCM Token Encryption at Rest', () => {
  it('encrypts and decrypts OAuth tokens idempotently', () => {
    const sampleToken = '1//0gSAMPLE_GMAIL_REFRESH_TOKEN_SECURE_STRING';
    const encrypted = encryptSecret(sampleToken);

    expect(encrypted).not.toBe(sampleToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv : authTag : ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(sampleToken);
  });
});
