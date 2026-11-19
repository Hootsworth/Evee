// Evee - Connectors & Integrations API Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';
import { IntegrationProviderId, IntegrationConfigRecord } from '@/lib/integrations/types';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { encryptSecret, decryptSecret } from '@/lib/compliance/encryption';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

// In-memory fallback config store for development & mock environments
const inMemoryConfigs: Record<string, Partial<IntegrationConfigRecord>> = {};

export async function GET() {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const configsMap: Record<string, Partial<IntegrationConfigRecord>> = { ...inMemoryConfigs };

    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        let query = admin
          .from('oauth_credentials')
          .select('*')
          .like('provider', 'integration_%');

        if (userCtx.organizationId) {
          query = query.or(`organization_id.eq.${userCtx.organizationId},organization_id.is.null`);
        }

        const { data: records } = await query;

        for (const rec of records || []) {
          if (userCtx.organizationId && rec.organization_id && rec.organization_id !== userCtx.organizationId) {
            continue;
          }

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
            lastSyncStatus: meta?.lastSyncStatus,
            lastSyncError: meta?.lastSyncError,
            syncedRecordsCount: meta?.syncedRecordsCount || 0,
            config: meta?.publicConfig || {},
          };
        }
      } catch (e) {
        console.warn('Failed to load integration credentials from database:', e);
      }
      if (userCtx.organizationId) {
        const { data: mappings } = await createAdminClient().from('integration_field_mappings').select('provider_id, mappings')
          .eq('organization_id', userCtx.organizationId);
        for (const row of mappings || []) {
          const current = configsMap[row.provider_id] || {};
          configsMap[row.provider_id] = { ...current, config: { ...(current.config || {}), __fieldMappings: JSON.stringify(row.mappings, null, 2) } };
        }
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
        lastSyncStatus: existing.lastSyncStatus,
        lastSyncError: existing.lastSyncError,
        syncedRecordsCount: existing.syncedRecordsCount || 0,
        config: existing.config || {},
      };
    });

    return NextResponse.json({ integrations });
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'admin');

    const body = await req.json();
    const { providerId, enabled, credentials, config } = body as {
      providerId: IntegrationProviderId;
      enabled: boolean;
      credentials?: Record<string, string>;
      config?: Record<string, any>;
    };

    if (!providerId) {
      return NextResponse.json({ error: 'Missing providerId' }, { status: 400 });
    }

    const definition = INTEGRATION_REGISTRY.find((item) => item.id === providerId);
    if (!definition) return NextResponse.json({ error: 'Unknown integration provider' }, { status: 400 });

    const orgId = userCtx.organizationId;

    // Sanitize credentials - extract primary secret (API Key, access token, or webhook secret)
    let primarySecret: string | null = null;
    const secretFields = definition.fields.filter((field) => field.isSecret).map((field) => field.key);
    for (const field of secretFields) {
      const value = credentials?.[field] || config?.[field];
      if (value?.trim()) { primarySecret = value.trim(); break; }
    }

    // Filter out secrets from public config
    const publicConfig: Record<string, string> = {};
    for (const field of definition.fields.filter((item) => !item.isSecret)) {
      const value = config?.[field.key];
      if (typeof value === 'string') publicConfig[field.key] = value.slice(0, 500);
    }
    const fieldMappings = config?.__fieldMappings;
    if (credentials?.targetChannel) {
      publicConfig.targetChannel = credentials.targetChannel;
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

        let existingQuery = admin
          .from('oauth_credentials')
          .select('encrypted_access_token')
          .eq('provider', `integration_${providerId}`);

        if (orgId) {
          existingQuery = existingQuery.eq('organization_id', orgId);
        }

        const { data: existing } = await existingQuery.maybeSingle();
        const tokenToSave = encryptedToken || existing?.encrypted_access_token;

        await admin.from('oauth_credentials').upsert(
          {
            organization_id: orgId,
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
          { onConflict: 'organization_id,provider' }
        );
        if (fieldMappings && typeof fieldMappings === 'object' && !Array.isArray(fieldMappings)) {
          await admin.from('integration_field_mappings').upsert({
            organization_id: orgId,
            provider_id: providerId,
            mappings: fieldMappings,
            sync_direction: 'push',
            updated_by: userCtx.userId,
          }, { onConflict: 'organization_id,provider_id' });
        }
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
    const status = error.statusCode || (error.message.includes('Unauthenticated') ? 401 : error.message.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
