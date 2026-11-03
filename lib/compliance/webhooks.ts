// Evee - Cryptographic Webhook Signature & Security Verification
import crypto from 'crypto';

/**
 * Verifies standard Svix / Resend webhook signatures.
 * Format:
 * - svix-id: unique identifier
 * - svix-timestamp: unix timestamp (seconds)
 * - svix-signature: v1,base64Signature (may contain multiple signatures space-delimited)
 * Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`
 */
export function verifyResendWebhookSignature(
  rawBody: string,
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  },
  secret: string
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) {
    return false;
  }

  // 1. Replay attack defense: Verify timestamp freshness (within 5 minutes)
  const timestampSec = parseInt(headers.timestamp, 10);
  if (isNaN(timestampSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    return false;
  }

  // 2. Decode Svix secret key (handles standard 'whsec_' base64 prefix)
  let keyBuffer: Buffer;
  try {
    if (secret.startsWith('whsec_')) {
      keyBuffer = Buffer.from(secret.slice(6), 'base64');
    } else {
      keyBuffer = Buffer.from(secret, 'utf-8');
    }
  } catch {
    return false;
  }

  // 3. Compute expected HMAC-SHA256 signature
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expectedSig = crypto
    .createHmac('sha256', keyBuffer)
    .update(signedContent)
    .digest('base64');

  // 4. Constant-time comparison across any provided v1 signature
  const passedSignatures = headers.signature.split(' ');
  for (const versionedSig of passedSignatures) {
    const [version, sig] = versionedSig.split(',');
    if (version === 'v1' && sig) {
      try {
        const sigBuf = Buffer.from(sig, 'base64');
        const expBuf = Buffer.from(expectedSig, 'base64');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          return true;
        }
      } catch {
        // Continue checking other signatures if present
      }
    }
  }

  return false;
}

/**
 * Verifies Inbound email webhook authenticity.
 * Supports:
 * 1. HMAC-SHA256 signature in `x-webhook-signature` header: `hex(hmacSha256(secret, rawBody))`
 * 2. Shared secret token in `x-webhook-secret` header or bearer token.
 */
export function verifyInboundWebhook(
  rawBody: string,
  headers: {
    signature?: string | null;
    secretToken?: string | null;
  },
  configuredSecret: string
): boolean {
  if (!configuredSecret) return false;

  // 1. Check direct secret token header using timingSafeEqual
  if (headers.secretToken) {
    const tokenBuf = Buffer.from(headers.secretToken, 'utf-8');
    const expectedBuf = Buffer.from(configuredSecret, 'utf-8');
    if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      return true;
    }
  }

  // 2. Check HMAC signature if provided
  if (headers.signature) {
    try {
      const expectedHmac = crypto
        .createHmac('sha256', configuredSecret)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(headers.signature, 'hex');
      const expectedBuf = Buffer.from(expectedHmac, 'hex');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    } catch {
      // Signature comparison failure
    }
  }

  return false;
}
