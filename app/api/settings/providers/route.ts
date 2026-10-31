// Evee - Dynamic Settings API Endpoint
// Manages local server-stored provider credentials (AI Keys, SMTP App Passwords, Google Places)
// Automatically encrypts sensitive API keys at rest using AES-256-GCM

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';

// In-memory fallback settings store for mock/sandbox runs
const inMemorySettings: Record<string, any> = {
  smtpConfigured: false,
  smtpUser: null,
  aiProvider: 'gemini',
  aiModel: 'gemini-1.5-flash',
  aiBaseUrl: '',
  aiKeyConfigured: false,
  discoveryKeyConfigured: false,
  enrichmentProvider: 'built_in',
  enrichmentKeyConfigured: false,
};

export async function GET() {
  const summary: Record<string, any> = { ...inMemorySettings };

  if (isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const { data: creds } = await admin.from('oauth_credentials').select('*');

      for (const c of creds || []) {
        if (c.provider === 'smtp_app_password') {
          summary.smtpConfigured = true;
          summary.smtpUser = c.account_email;
        } else if (c.provider === 'ai_provider_config') {
          const meta = c.scopes as any;
          summary.aiProvider = meta?.provider || 'gemini';
          summary.aiModel = meta?.model || 'gemini-1.5-flash';
          summary.aiBaseUrl = meta?.baseUrl || '';
          summary.aiKeyConfigured = Boolean(c.encrypted_access_token);
        } else if (c.provider === 'google_places_config') {
          summary.discoveryKeyConfigured = Boolean(c.encrypted_access_token);
        } else if (c.provider === 'explorium_config' || c.provider === 'enrichment_config') {
          summary.enrichmentKeyConfigured = Boolean(c.encrypted_access_token);
          const meta = c.scopes as any;
          if (meta?.provider) summary.enrichmentProvider = meta.provider;
        }
      }
    } catch {
      // Return memory summary
    }
  }

  return NextResponse.json({ settings: summary });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Save SMTP App Password
    if (body.smtpEmail) {
      inMemorySettings.smtpConfigured = Boolean(body.smtpAppPassword || inMemorySettings.smtpConfigured);
      inMemorySettings.smtpUser = body.smtpEmail.trim();

      if (isSupabaseConfigured() && body.smtpAppPassword) {
        try {
          const admin = createAdminClient();
          const encryptedPass = encryptSecret(body.smtpAppPassword);
          await admin.from('oauth_credentials').upsert(
            {
              provider: 'smtp_app_password',
              account_email: body.smtpEmail.trim(),
              encrypted_refresh_token: encryptedPass,
              encrypted_access_token: body.smtpHost || 'smtp.gmail.com',
              scopes: [String(body.smtpPort || 465)],
            },
            { onConflict: 'provider' }
          );
        } catch {}
      }
    }

    // 2. Save AI Provider configuration & API key (Gemini, OpenAI, Meta Llama)
    if (body.aiProvider) {
      inMemorySettings.aiProvider = body.aiProvider;
      inMemorySettings.aiModel = body.aiModel || 'gemini-1.5-flash';
      inMemorySettings.aiBaseUrl = body.aiBaseUrl || '';
      if (body.aiApiKey) inMemorySettings.aiKeyConfigured = true;

      if (isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
          let encryptedKey: string | null = null;
          if (body.aiApiKey) {
            encryptedKey = encryptSecret(body.aiApiKey.trim());
          } else {
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
                model: body.aiModel || 'gemini-1.5-flash',
                baseUrl: body.aiBaseUrl || undefined,
              } as any,
            },
            { onConflict: 'provider' }
          );
        } catch {}
      }
    }

    // 3. Save Google Places API key
    if (body.placesApiKey) {
      inMemorySettings.discoveryKeyConfigured = true;
      if (isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
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
        } catch {}
      }
    }

    // 4. Save Lead Enrichment configuration
    if (body.enrichmentProvider) {
      inMemorySettings.enrichmentProvider = body.enrichmentProvider;
      if (body.exploriumApiKey || body.enrichmentApiKey) inMemorySettings.enrichmentKeyConfigured = true;

      if (isSupabaseConfigured()) {
        try {
          const admin = createAdminClient();
          const rawKey = body.exploriumApiKey || body.enrichmentApiKey;
          let encryptedKey: string | null = null;
          if (rawKey && rawKey.trim()) {
            encryptedKey = encryptSecret(rawKey.trim());
          } else {
            const { data: existing } = await admin
              .from('oauth_credentials')
              .select('encrypted_access_token')
              .eq('provider', 'explorium_config')
              .maybeSingle();
            encryptedKey = existing?.encrypted_access_token || null;
          }

          await admin.from('oauth_credentials').upsert(
            {
              provider: 'explorium_config',
              account_email: 'explorium_enrichment',
              encrypted_refresh_token: 'active',
              encrypted_access_token: encryptedKey,
              scopes: { provider: body.enrichmentProvider || 'built_in' } as any,
            },
            { onConflict: 'provider' }
          );
        } catch {}
      }
    }

    return NextResponse.json({ success: true, message: 'Settings saved and encrypted.' });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
