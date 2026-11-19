// Evee - Connector Data Synchronization Endpoint (Tenant-Isolated)
// Pushes qualified leads & approved drafts to connected CRMs or Outreach Engines within organization scope
import { NextRequest, NextResponse } from 'next/server';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';
import { IntegrationProviderId } from '@/lib/integrations/types';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const { provider } = await params;
    const providerId = provider as IntegrationProviderId;
    const orgId = userCtx.organizationId;

    const definition = INTEGRATION_REGISTRY.find((d) => d.id === providerId);
    if (!definition) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 404 });
    }

    const admin = createAdminClient();
    let runId: string | null = null;
    const startedAt = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data: run } = await admin.from('integration_sync_runs').insert({
        organization_id: orgId, provider_id: providerId, status: 'running', started_at: startedAt,
      }).select('id').single();
      runId = run?.id || null;
    }
    let secret = '';
    let publicConfig: Record<string, string> = {};
    let fieldMappings: Record<string, string> = {};

    if (isSupabaseConfigured()) {
      const { data: cred } = await admin
        .from('oauth_credentials')
        .select('*')
        .eq('provider', `integration_${providerId}`)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (cred?.encrypted_access_token) {
        secret = decryptSecret(cred.encrypted_access_token);
        publicConfig = (cred.scopes as any)?.publicConfig || {};
      }
      const { data: mapping } = await admin.from('integration_field_mappings').select('mappings')
        .eq('organization_id', orgId).eq('provider_id', providerId).maybeSingle();
      if (mapping?.mappings && typeof mapping.mappings === 'object' && !Array.isArray(mapping.mappings)) fieldMappings = mapping.mappings as Record<string, string>;
    }

    // Fetch active qualified leads with valid emails to sync strictly within this organization
    const { data: leads } = await admin
      .from('businesses')
      .select('id, display_name, general_business_email, official_website_url, city, business_type')
      .eq('organization_id', orgId)
      .eq('record_status', 'active')
      .not('general_business_email', 'is', null)
      .limit(50);

    const eligibleLeads = (leads || []).filter((l) => l.general_business_email && l.general_business_email.includes('@'));

    let syncedCount = 0;
    const failures: Array<{ recordId: string; message: string }> = [];

    // Dispatch to CRM based on provider
    if (providerId === 'hubspot' && secret) {
      for (const lead of eligibleLeads) {
        try {
          const canonical: Record<string, string> = {
            email: lead.general_business_email,
            company: lead.display_name,
            website: lead.official_website_url || '',
            city: lead.city || '',
            industry: lead.business_type || '',
            lead_source: 'Evee Prospecting',
          };
          const properties: Record<string, string> = {};
          for (const [source, destination] of Object.entries(fieldMappings)) {
            if (typeof destination === 'string' && /^[a-zA-Z0-9_]{1,100}$/.test(destination) && source in canonical) properties[destination] = canonical[source];
          }
          if (!Object.keys(properties).length) Object.assign(properties, canonical);
          const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({
              properties,
            }),
          });
          if (!response.ok) {
            const errorBody = await response.text();
            failures.push({ recordId: lead.id, message: `HubSpot returned ${response.status}: ${errorBody.slice(0, 300)}` });
          } else syncedCount++;
        } catch (e) {
          failures.push({ recordId: lead.id, message: e instanceof Error ? e.message.slice(0, 300) : 'Network request failed' });
        }
      }
    } else if (providerId === 'hubspot') {
      failures.push({ recordId: '', message: 'Connector is not configured with an access token.' });
    } else {
      failures.push({ recordId: '', message: `Sync is not implemented for ${providerId}; no records were sent.` });
    }

    // Update sync telemetry in database scoped strictly to this organization
    if (isSupabaseConfigured()) {
      try {
        const { data: existing } = await admin
          .from('oauth_credentials')
          .select('scopes')
          .eq('provider', `integration_${providerId}`)
          .eq('organization_id', orgId)
          .maybeSingle();

        const currentScopes = (existing?.scopes as any) || {};
        const failedCount = failures.filter((failure) => failure.recordId).length;
        const status = failures.length === 0 ? 'succeeded' : syncedCount > 0 ? 'partial' : 'failed';
        if (runId) await admin.from('integration_sync_runs').update({
          status, total_count: eligibleLeads.length, synced_count: syncedCount,
          failed_count: Math.max(failedCount, eligibleLeads.length - syncedCount),
          errors: failures.slice(0, 20), finished_at: new Date().toISOString(),
        }).eq('id', runId).eq('organization_id', orgId);

        await admin.from('oauth_credentials').upsert(
          {
            organization_id: orgId,
            provider: `integration_${providerId}`,
            account_email: `integration@${providerId}.service`,
            scopes: {
              ...currentScopes,
              lastSyncAt: new Date().toISOString(),
              syncedRecordsCount: (currentScopes.syncedRecordsCount || 0) + syncedCount,
              lastSyncStatus: status,
              lastSyncError: failures[0]?.message || null,
            } as any,
          },
          { onConflict: 'organization_id,provider' }
        );
      } catch (e) {
        console.warn('Failed to update sync telemetry in DB:', e);
      }
    }

    // Record audit event
    try {
      await admin.from('audit_events').insert({
        organization_id: orgId,
        event_type: `INTEGRATION_SYNC_${providerId.toUpperCase()}`,
        entity_type: 'integrations',
        details: {
          providerId,
          syncedCount,
          totalEligible: eligibleLeads.length,
          operatorId: userCtx.userId,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      providerId,
      syncedCount,
      totalEligible: eligibleLeads.length,
      failedCount: Math.max(failures.filter((failure) => failure.recordId).length, eligibleLeads.length - syncedCount),
      status: failures.length === 0 ? 'succeeded' : syncedCount > 0 ? 'partial' : 'failed',
      errors: failures.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json(
      { error: err.message || 'Synchronization failed' },
      { status }
    );
  }
}
