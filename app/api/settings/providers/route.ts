// Evee - Dynamic Settings API Endpoint
// Manages local server-stored provider credentials (AI Keys, SMTP App Passwords, Google Places)
// Automatically encrypts sensitive API keys at rest using AES-256-GCM

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';

export async function GET() {
  const admin = createAdminClient();

  const { data: creds } = await admin.from('oauth_credentials').select('*');

  // Strip plaintext secrets; indicate whether configured
  const summary: Record<string, any> = {
    smtpConfigured: false,
    smtpUser: null,
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    aiKeyConfigured: false,
    discoveryKeyConfigured: false,
  };

  for (const c of creds || []) {
    if (c.provider === 'smtp_app_password') {
      summary.smtpConfigured = true;
      summary.smtpUser = c.account_email;
    } else if (c.provider === 'ai_provider_config') {
      const meta = c.scopes as any;
      summary.aiProvider = meta?.provider || 'gemini';
      summary.aiModel = meta?.model || 'gemini-2.5-flash';
      summary.aiKeyConfigured = Boolean(c.encrypted_access_token);
    } else if (c.provider === 'google_places_config') {
      summary.discoveryKeyConfigured = Boolean(c.encrypted_access_token);
    }
  }

  return NextResponse.json({ settings: summary });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const admin = createAdminClient();

    // 1. Save SMTP App Password
    if (body.smtpEmail && body.smtpAppPassword) {
      const encryptedPass = encryptSecret(body.smtpAppPassword);
      await admin.from('oauth_credentials').upsert(
        {
          provider: 'smtp_app_password',
          account_email: body.smtpEmail.trim(),
          encrypted_refresh_token: encryptedPass, // pass stored encrypted
          encrypted_access_token: body.smtpHost || 'smtp.gmail.com',
          scopes: [String(body.smtpPort || 465)],
        },
        { onConflict: 'provider' }
      );
    }

    // 2. Save AI Provider configuration & API key
    if (body.aiProvider) {
      let encryptedKey: string | null = null;
      if (body.aiApiKey) {
        encryptedKey = encryptSecret(body.aiApiKey.trim());
      } else {
        // preserve existing if not passed
        const { data: existing } = await admin
          .from('oauth_credentials')
          .select('encrypted_access_token')
          .eq('provider', 'ai_provider_config')
          .maybeSingle();
        encryptedKey = existing?.encrypted_access_token || null;
      }

      await admin.from('oauth_credentials').upsert(
        {
          provider: 'ai_provider_config',
          account_email: body.aiProvider,
          encrypted_refresh_token: 'active',
          encrypted_access_token: encryptedKey,
          scopes: {
            provider: body.aiProvider,
            model: body.aiModel || 'gemini-2.5-flash',
          } as any,
        },
        { onConflict: 'provider' }
      );
    }

    // 3. Save Google Places API key
    if (body.placesApiKey) {
      const encryptedKey = encryptSecret(body.placesApiKey.trim());
      await admin.from('oauth_credentials').upsert(
        {
          provider: 'google_places_config',
          account_email: 'google_places',
          encrypted_refresh_token: 'active',
          encrypted_access_token: encryptedKey,
          scopes: ['places.searchText'],
        },
        { onConflict: 'provider' }
      );
    }

    return NextResponse.json({ success: true, message: 'Settings saved and encrypted.' });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
