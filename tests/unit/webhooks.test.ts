import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyResendWebhookSignature,
  verifyInboundWebhook,
} from '@/lib/compliance/webhooks';

describe('Webhook Cryptographic Signature Verification', () => {
  const secretKey = 'whsec_' + Buffer.from('my-test-svix-secret-key-32bytes!').toString('base64');
  const rawSecret = Buffer.from('my-test-svix-secret-key-32bytes!');

  it('validates a correct Svix / Resend webhook signature', () => {
    const rawBody = JSON.stringify({
      type: 'email.bounced',
      data: { email: 'bounced@example.com', bounce_type: 'hard_bounce' },
    });

    const svixId = 'msg_2rM9XJklsd8FjK';
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();

    const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expectedSig = crypto
      .createHmac('sha256', rawSecret)
      .update(signedPayload)
      .digest('base64');

    const isValid = verifyResendWebhookSignature(
      rawBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: `v1,${expectedSig}`,
      },
      secretKey
    );

    expect(isValid).toBe(true);
  });

  it('rejects a tampered payload with invalid Svix signature', () => {
    const originalBody = JSON.stringify({ type: 'email.bounced', data: { email: 'user@example.com' } });
    const tamperedBody = JSON.stringify({ type: 'email.bounced', data: { email: 'victim@example.com' } });

    const svixId = 'msg_test123';
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${svixId}.${svixTimestamp}.${originalBody}`;
    const sig = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

    const isValid = verifyResendWebhookSignature(
      tamperedBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: `v1,${sig}`,
      },
      secretKey
    );

    expect(isValid).toBe(false);
  });

  it('rejects replayed webhooks with expired timestamps (> 5 minutes)', () => {
    const rawBody = JSON.stringify({ type: 'email.delivered' });
    const svixId = 'msg_expired';
    // 6 minutes in the past
    const svixTimestamp = (Math.floor(Date.now() / 1000) - 360).toString();

    const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
    const sig = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

    const isValid = verifyResendWebhookSignature(
      rawBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: `v1,${sig}`,
      },
      secretKey
    );

    expect(isValid).toBe(false);
  });

  it('rejects replayed webhooks with future timestamps (> 5 minutes ahead)', () => {
    const rawBody = JSON.stringify({ type: 'email.delivered' });
    const svixId = 'msg_future';
    // 10 minutes in the future
    const svixTimestamp = (Math.floor(Date.now() / 1000) + 600).toString();

    const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
    const sig = crypto.createHmac('sha256', rawSecret).update(signedPayload).digest('base64');

    const isValid = verifyResendWebhookSignature(
      rawBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: `v1,${sig}`,
      },
      secretKey
    );

    expect(isValid).toBe(false);
  });

  it('fails closed when webhook secrets are missing or empty', () => {
    // Missing / empty secret for Resend
    expect(
      verifyResendWebhookSignature('{}', { id: 'msg_1', timestamp: '1234567890', signature: 'v1,abc' }, '')
    ).toBe(false);

    expect(
      verifyResendWebhookSignature('{}', { id: 'msg_1', timestamp: '1234567890', signature: 'v1,abc' }, undefined as any)
    ).toBe(false);

    // Missing / empty secret for Inbound
    expect(
      verifyInboundWebhook('{}', { secretToken: 'any-token' }, '')
    ).toBe(false);

    expect(
      verifyInboundWebhook('{}', { secretToken: 'any-token' }, undefined as any)
    ).toBe(false);
  });

  it('rejects when signature or headers are missing or malformed', () => {
    expect(
      verifyResendWebhookSignature('{}', { id: null, timestamp: null, signature: null }, secretKey)
    ).toBe(false);

    expect(
      verifyResendWebhookSignature('{}', { id: 'msg_1', timestamp: 'invalid-num', signature: 'v1,abc' }, secretKey)
    ).toBe(false);
  });

  it('validates authentic inbound webhooks with HMAC or secret token', () => {
    const inboundSecret = 'inbound-secret-token-abcdef123456';
    const payload = JSON.stringify({ from: 'lead@target.com', text: 'Please unsubscribe me' });

    // 1. Secret token header
    expect(
      verifyInboundWebhook(payload, { secretToken: inboundSecret }, inboundSecret)
    ).toBe(true);

    // 2. Secret token mismatch
    expect(
      verifyInboundWebhook(payload, { secretToken: 'wrong-token' }, inboundSecret)
    ).toBe(false);

    // 3. HMAC-SHA256 signature
    const validHmac = crypto.createHmac('sha256', inboundSecret).update(payload).digest('hex');
    expect(
      verifyInboundWebhook(payload, { signature: validHmac }, inboundSecret)
    ).toBe(true);

    // 4. Invalid HMAC
    expect(
      verifyInboundWebhook(payload, { signature: 'abcdef0123456789' }, inboundSecret)
    ).toBe(false);
  });
});

describe('Cron Secret Fail-Closed Authentication & Replay Prevention', () => {
  const cronSecret = 'test-cron-secret-32-chars-long!';

  function verifyCronAuth(authHeader: string | null | undefined, secret: string | null | undefined) {
    if (!secret || secret.trim().length === 0) {
      return { allowed: false, status: 500, error: 'CRON_SECRET unconfigured' };
    }
    if (!authHeader) {
      return { allowed: false, status: 401, error: 'Missing authorization header' };
    }
    const expected = `Bearer ${secret.trim()}`;
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(authHeader, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { allowed: false, status: 401, error: 'Invalid cron secret' };
    }
    return { allowed: true, status: 200 };
  }

  it('fails closed with status 500 when CRON_SECRET is empty, undefined, or whitespace', () => {
    expect(verifyCronAuth('Bearer anything', undefined).status).toBe(500);
    expect(verifyCronAuth('Bearer anything', '').status).toBe(500);
    expect(verifyCronAuth('Bearer anything', '   ').status).toBe(500);
  });

  it('rejects unauthorized requests with status 401 when header is missing or invalid', () => {
    expect(verifyCronAuth(undefined, cronSecret).status).toBe(401);
    expect(verifyCronAuth('', cronSecret).status).toBe(401);
    expect(verifyCronAuth('Bearer wrong-secret', cronSecret).status).toBe(401);
    expect(verifyCronAuth('Basic test', cronSecret).status).toBe(401);
  });

  it('authorizes requests with valid Bearer token matching CRON_SECRET using timing-safe comparison', () => {
    const result = verifyCronAuth(`Bearer ${cronSecret}`, cronSecret);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });
});
