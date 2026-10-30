// Evee - Outbound Email Dispatcher Utility
// Loads encrypted SMTP / Google App Passwords / Gmail credentials securely and dispatches emails

import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';
import { getEmailProvider } from '@/lib/providers/email';
import { normalizeEmail } from '@/lib/compliance/suppression';

export async function isSuppressed(identifier: { email?: string | null }): Promise<boolean> {
  const normEmail = identifier.email ? normalizeEmail(identifier.email) : null;
  if (!normEmail) return false;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('suppression_entries')
      .select('id')
      .eq('normalized_email', normEmail)
      .limit(1);

    return !!(data && data.length > 0);
  } catch (err) {
    console.warn('Failed to query suppression_entries:', err);
    return false;
  }
}

export interface DispatchEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  idempotencyKey?: string;
  isTestSend?: boolean;
}

export interface DispatchEmailResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  suppressed?: boolean;
}

export async function getActiveEmailProvider() {
  const admin = createAdminClient();

  // 1. Try to load configured SMTP App Password
  const { data: smtpCreds } = await admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'smtp_app_password')
    .maybeSingle();

  if (smtpCreds && smtpCreds.encrypted_refresh_token) {
    try {
      const appPassword = decryptSecret(smtpCreds.encrypted_refresh_token);
      const provider = getEmailProvider({
        type: 'smtp',
        user: smtpCreds.account_email,
        pass: appPassword,
        host: smtpCreds.encrypted_access_token || 'smtp.gmail.com',
        port: Number(smtpCreds.scopes?.[0]) || 465,
      });
      return {
        provider,
        fromEmail: smtpCreds.account_email,
        isConfigured: true,
      };
    } catch (err) {
      console.error('Failed to decrypt SMTP credentials:', err);
    }
  }

  // 2. Try to load Google OAuth refresh token
  const { data: oauthCreds } = await admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'google')
    .maybeSingle();

  if (oauthCreds && oauthCreds.encrypted_refresh_token) {
    try {
      const refreshToken = decryptSecret(oauthCreds.encrypted_refresh_token);
      const provider = getEmailProvider({ refreshToken });
      return {
        provider,
        fromEmail: oauthCreds.account_email || 'operator@evee.ai',
        isConfigured: true,
      };
    } catch (err) {
      console.error('Failed to decrypt OAuth credentials:', err);
    }
  }

  // 3. Fallback to mock provider
  return {
    provider: getEmailProvider(),
    fromEmail: 'operator@evee.ai',
    isConfigured: false,
  };
}

export async function sendEmailWithSafetyChecks(options: DispatchEmailOptions): Promise<DispatchEmailResult> {
  const recipient = options.to.trim().toLowerCase();

  // Safety Gate: Global Suppression Check (bypass only for test sends to self)
  if (!options.isTestSend) {
    const suppressed = await isSuppressed({ email: recipient });
    if (suppressed) {
      return {
        success: false,
        provider: 'safety_gate',
        suppressed: true,
        error: `Recipient ${recipient} is blocked in the global suppression registry.`,
      };
    }
  }

  const { provider, fromEmail, isConfigured } = await getActiveEmailProvider();

  const idempotencyKey = options.idempotencyKey || `csv-dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const result = await provider.sendEmail({
    to: recipient,
    subject: options.subject,
    bodyText: options.bodyText,
    bodyHtml: options.bodyHtml,
    from: fromEmail,
    idempotencyKey,
  });

  if (result.status === 'sent') {
    return {
      success: true,
      provider: provider.name,
      providerMessageId: result.providerMessageId,
    };
  } else {
    return {
      success: false,
      provider: provider.name,
      error: result.error || 'Failed to dispatch email via mailer.',
    };
  }
}
