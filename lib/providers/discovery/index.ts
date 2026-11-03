// Evee - Discovery Provider Factory with Organization-Scoped Database Key Retrieval
import { DiscoveryProvider } from './interface';
import { GooglePlacesDiscoveryProvider } from './google-places';
import { MockDiscoveryProvider } from './mock';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicDiscoveryProvider(organizationId?: string | null): Promise<DiscoveryProvider> {
  // If organizationId is provided, query strictly within this organization (or global fallback)
  if (organizationId) {
    try {
      const admin = createAdminClient();
      const { data: records } = await admin
        .from('oauth_credentials')
        .select('*')
        .eq('provider', 'google_places_config')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      // Strictly match tenant's own record first, then null global default; NEVER return another tenant's record
      const record =
        records?.find((r) => r.organization_id === organizationId) ||
        records?.find((r) => r.organization_id === null);

      if (record && record.encrypted_access_token) {
        try {
          const apiKey = decryptSecret(record.encrypted_access_token);
          return new GooglePlacesDiscoveryProvider(apiKey);
        } catch (e) {
          console.error('Failed to decrypt saved Google Places key:', e);
        }
      }
    } catch (e) {
      console.warn('Discovery provider credential lookup failed:', e);
    }
  }

  // Fallback to environment variable if present
  const envKey =
    process.env.DISCOVERY_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY;
  if (envKey) {
    return new GooglePlacesDiscoveryProvider(envKey);
  }

  return new MockDiscoveryProvider();
}

export function getDiscoveryProvider(): DiscoveryProvider {
  return new MockDiscoveryProvider();
}

export * from './interface';
