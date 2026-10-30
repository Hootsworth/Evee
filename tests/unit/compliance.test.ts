import { describe, it, expect } from 'vitest';
import { checkSuppression, normalizeEmail, normalizePhone } from '@/lib/compliance/suppression';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';

describe('Suppression & Compliance Verification', () => {
  it('normalizes email addresses and phone numbers correctly', () => {
    expect(normalizeEmail('  Test.User@Example.COM ')).toBe('test.user@example.com');
    expect(normalizePhone('+91 (987) 65-43210')).toBe('+919876543210');
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
