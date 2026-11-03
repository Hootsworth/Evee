// Evee - Outbound Email Dispatcher Utility
// Loads encrypted SMTP / Google App Passwords / Gmail credentials securely and dispatches emails

import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';
import { getEmailProvider } from '@/lib/providers/email';
import { checkSuppression, normalizeEmail } from '@/lib/compliance/suppression';

export async function isSuppressed(
  identifier: { email?: string | null },
  organizationId?: string | null
): Promise<boolean> {
  const normEmail = identifier.email ? normalizeEmail(identifier.email) : null;
  if (!normEmail) return false;

  try {
    const admin = createAdminClient();
    let query = admin
      .from('suppression_entries')
      .select('normalized_email, normalized_phone, reason, source, organization_id');

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return false;

    const result = checkSuppression({ email: normEmail }, data, organizationId);
    return result.isSuppressed;
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
  organizationId?: string;
}

export interface DispatchEmailResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  suppressed?: boolean;
}

export async function getActiveEmailProvider(organizationId?: string | null) {
  const admin = createAdminClient();

  // 1. Try to load configured SMTP App Password for this organization (or global fallback)
  let smtpQuery = admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'smtp_app_password');

  if (organizationId) {
    smtpQuery = smtpQuery.eq('organization_id', organizationId);
  }

  const { data: smtpCreds } = await smtpQuery.maybeSingle();

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

  // 2. Try to load Google OAuth refresh token for this organization
  let googleQuery = admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'google');

  if (organizationId) {
    googleQuery = googleQuery.eq('organization_id', organizationId);
  }

  const { data: oauthCreds } = await googleQuery.maybeSingle();

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

  // Safety Gate: Global & Tenant Suppression Check (bypass only for test sends to self)
  if (!options.isTestSend) {
    const suppressed = await isSuppressed({ email: recipient }, options.organizationId);
    if (suppressed) {
      return {
        success: false,
        provider: 'safety_gate',
        suppressed: true,
        error: `Recipient ${recipient} is blocked in the suppression registry.`,
      };
    }
  }

  const { provider, fromEmail, isConfigured } = await getActiveEmailProvider(options.organizationId);

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
