// Evee - Connectors & Integrations API Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';
import { IntegrationProviderId, IntegrationConfigRecord } from '@/lib/integrations/types';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';

// In-memory fallback config store for development & mock environments
const inMemoryConfigs: Record<string, Partial<IntegrationConfigRecord>> = {};

export async function GET() {
  const configsMap: Record<string, Partial<IntegrationConfigRecord>> = { ...inMemoryConfigs };

  if (isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const { data: records } = await admin
        .from('oauth_credentials')
        .select('*')
        .like('provider', 'integration_%');

      for (const rec of records || []) {
        const providerId = rec.provider.replace('integration_', '') as IntegrationProviderId;
        const meta = rec.scopes as any;
        configsMap[providerId] = {
          providerId,
          enabled: meta?.enabled ?? true,
          configured: Boolean(rec.encrypted_access_token),
          lastTestedAt: meta?.lastTestedAt,
          lastTestSuccess: meta?.lastTestSuccess,
          lastTestMessage: meta?.lastTestMessage,
          lastSyncAt: meta?.lastSyncAt,
          syncedRecordsCount: meta?.syncedRecordsCount || 0,
          config: meta?.publicConfig || {},
        };
      }
    } catch (e) {
      console.warn('Failed to load integration credentials from database:', e);
    }
  }

  // Combine definitions with configuration status
  const integrations = INTEGRATION_REGISTRY.map((def) => {
    const existing = configsMap[def.id] || {};
    return {
      ...def,
      enabled: existing.enabled ?? false,
      configured: existing.configured ?? false,
      lastTestedAt: existing.lastTestedAt,
      lastTestSuccess: existing.lastTestSuccess,
      lastTestMessage: existing.lastTestMessage,
      lastSyncAt: existing.lastSyncAt,
      syncedRecordsCount: existing.syncedRecordsCount || 0,
      config: existing.config || {},
    };
  });

  return NextResponse.json({ integrations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, config, enabled = true } = body as {
      providerId: IntegrationProviderId;
      config: Record<string, string>;
      enabled?: boolean;
    };

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    const definition = INTEGRATION_REGISTRY.find((d) => d.id === providerId);
    if (!definition) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 404 });
    }

    // Separate secret fields from public fields
    const secretKeys = new Set(definition.fields.filter((f) => f.isSecret).map((f) => f.key));
    const publicConfig: Record<string, string> = {};
    let primarySecret = '';

    for (const [key, value] of Object.entries(config || {})) {
      if (secretKeys.has(key)) {
        if (value && value.trim()) primarySecret = value.trim();
      } else {
        publicConfig[key] = value;
      }
    }

    // Update in-memory fallback
    const prev = inMemoryConfigs[providerId] || {};
    inMemoryConfigs[providerId] = {
      ...prev,
      providerId,
      enabled,
      configured: Boolean(primarySecret || prev.configured),
      config: publicConfig,
    };

    // Save encrypted to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        const encryptedToken = primarySecret ? encryptSecret(primarySecret) : null;

        const { data: existing } = await admin
          .from('oauth_credentials')
          .select('encrypted_access_token')
          .eq('provider', `integration_${providerId}`)
          .maybeSingle();

        const tokenToSave = encryptedToken || existing?.encrypted_access_token;

        await admin.from('oauth_credentials').upsert(
          {
            provider: `integration_${providerId}`,
            account_email: `integration@${providerId}.service`,
            encrypted_access_token: tokenToSave,
            scopes: {
              enabled,
              publicConfig,
              updatedAt: new Date().toISOString(),
              configured: Boolean(tokenToSave),
            } as any,
          },
          { onConflict: 'provider' }
        );
      } catch (err) {
        console.warn(`Failed to save encrypted credential for ${providerId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      providerId,
      enabled,
      configured: true,
    });
  } catch (error: any) {
    console.error('Failed to configure integration:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
