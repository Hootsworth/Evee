// Evee - Dynamic Lead Enrichment Factory
import { EnrichmentProvider } from './interface';
import { ExploriumEnrichmentProvider } from './explorium';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicEnrichmentProvider(): Promise<EnrichmentProvider> {
  const admin = createAdminClient();

  const { data: record } = await admin
    .from('oauth_credentials')
    .select('*')
    .in('provider', ['explorium_config', 'enrichment_config'])
    .maybeSingle();

  if (record && record.encrypted_access_token) {
    try {
      const apiKey = decryptSecret(record.encrypted_access_token);
      return new ExploriumEnrichmentProvider({
        apiKey,
      });
    } catch (e) {
      console.error('Failed to decrypt saved Explorium/Enrichment key:', e);
    }
  }

  // Fallback to environment or web-inspection/AI fallback
  return new ExploriumEnrichmentProvider();
}

export * from './interface';
export * from './explorium';
