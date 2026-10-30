// Evee - Discovery Provider Factory with Dynamic Database Key Retrieval
import { DiscoveryProvider } from './interface';
import { GooglePlacesDiscoveryProvider } from './google-places';
import { MockDiscoveryProvider } from './mock';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicDiscoveryProvider(): Promise<DiscoveryProvider> {
  const admin = createAdminClient();

  const { data: record } = await admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'google_places_config')
    .maybeSingle();

  if (record && record.encrypted_access_token) {
    try {
      const apiKey = decryptSecret(record.encrypted_access_token);
      return new GooglePlacesDiscoveryProvider(apiKey);
    } catch (e) {
      console.error('Failed to decrypt saved Google Places key:', e);
    }
  }

  const envKey = process.env.DISCOVERY_API_KEY;
  if (envKey) {
    return new GooglePlacesDiscoveryProvider(envKey);
  }

  return new MockDiscoveryProvider();
}

export function getDiscoveryProvider(): DiscoveryProvider {
  return new MockDiscoveryProvider();
}

export * from './interface';
