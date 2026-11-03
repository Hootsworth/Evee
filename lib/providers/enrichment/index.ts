// Evee - Dynamic Lead Enrichment Factory with Organization Scoping
import { EnrichmentProvider } from './interface';
import { ExploriumEnrichmentProvider } from './explorium';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicEnrichmentProvider(organizationId?: string | null): Promise<EnrichmentProvider> {
  // If organizationId is provided, query strictly within this organization (or global fallback)
  if (organizationId) {
    try {
      const admin = createAdminClient();
      const { data: records } = await admin
        .from('oauth_credentials')
        .select('*')
        .in('provider', ['explorium_config', 'enrichment_config'])
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      // Strictly match tenant's own record first, then null global default; NEVER return another tenant's record
      const record =
        records?.find((r) => r.organization_id === organizationId) ||
        records?.find((r) => r.organization_id === null);

      if (record && record.encrypted_access_token) {
        try {
          const apiKey = decryptSecret(record.encrypted_access_token);
          const meta = record.scopes as any;
          return new ExploriumEnrichmentProvider({
            apiKey,
            provider: meta?.provider || 'explorium',
          });
        } catch (e) {
          console.error('Failed to decrypt saved Explorium/Enrichment key:', e);
        }
      }
    } catch (e) {
      console.warn('Enrichment credential lookup failed:', e);
    }
  }

  // Fallback to 100% Free Built-in Web Crawler, Gemini AI & DNS MX Validation
  return new ExploriumEnrichmentProvider({
    provider: 'built_in',
  });
}

export * from './interface';
export * from './explorium';
