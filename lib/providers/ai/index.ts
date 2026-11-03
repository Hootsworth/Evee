// Evee - AI Provider Factory with Organization-Scoped Database Key Retrieval
import { ResearchProvider, DraftProvider } from './interface';
import { MultiLlmProvider } from './multi-llm';
import { MockAiProvider } from './mock';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicAiProvider(organizationId?: string | null): Promise<ResearchProvider & DraftProvider> {
  // If organizationId is provided, query strictly within this organization (or global fallback)
  if (organizationId && isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const { data: records } = await admin
        .from('oauth_credentials')
        .select('*')
        .eq('provider', 'ai_provider_config')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      // Strictly match tenant's own record first, then null global default; NEVER return another tenant's record
      const record =
        records?.find((r) => r.organization_id === organizationId) ||
        records?.find((r) => r.organization_id === null);

      if (record && record.encrypted_access_token) {
        const apiKey = decryptSecret(record.encrypted_access_token);
        const meta = record.scopes as any;
        return new MultiLlmProvider({
          provider: meta?.provider || 'gemini',
          model: meta?.model || 'gemini-1.5-flash',
          baseUrl: meta?.baseUrl,
          apiKey,
        });
      }
    } catch (e) {
      console.error('Failed to decrypt saved AI key:', e);
    }
  }

  // Fallback to environment variable if present
  const envKey =
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.META_API_KEY ||
    process.env.TOGETHER_API_KEY;

  if (envKey) {
    const prov = (
      process.env.AI_PROVIDER ||
      (process.env.OPENAI_API_KEY ? 'openai' : process.env.META_API_KEY || process.env.TOGETHER_API_KEY ? 'meta' : 'gemini')
    ) as 'openai' | 'gemini' | 'meta';

    const defaultModel =
      prov === 'openai'
        ? 'gpt-4o-mini'
        : prov === 'meta'
        ? 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
        : 'gemini-1.5-flash';

    return new MultiLlmProvider({
      provider: prov,
      model: process.env.AI_MODEL || defaultModel,
      baseUrl: process.env.AI_BASE_URL,
      apiKey: envKey,
    });
  }

  return new MockAiProvider();
}

export function getAiProvider(): ResearchProvider & DraftProvider {
  return new MockAiProvider();
}

export * from './interface';
