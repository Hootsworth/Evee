// Evee - AI Provider Factory with Dynamic Database Key Retrieval
import { ResearchProvider, DraftProvider } from './interface';
import { MultiLlmProvider } from './multi-llm';
import { MockAiProvider } from './mock';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/compliance/encryption';

export async function getDynamicAiProvider(): Promise<ResearchProvider & DraftProvider> {
  const admin = createAdminClient();

  const { data: record } = await admin
    .from('oauth_credentials')
    .select('*')
    .eq('provider', 'ai_provider_config')
    .maybeSingle();

  if (record && record.encrypted_access_token) {
    try {
      const apiKey = decryptSecret(record.encrypted_access_token);
      const meta = record.scopes as any;
      return new MultiLlmProvider({
        provider: meta?.provider || 'gemini',
        model: meta?.model || 'gemini-2.5-flash',
        apiKey,
      });
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
    process.env.ANTHROPIC_API_KEY;

  if (envKey) {
    const prov = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'gemini')) as any;
    return new MultiLlmProvider({
      provider: prov === 'openai' || prov === 'meta' ? prov : 'gemini',
      model: process.env.AI_MODEL || (prov === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'),
      apiKey: envKey,
    });
  }

  return new MockAiProvider();
}

export function getAiProvider(): ResearchProvider & DraftProvider {
  // Sync fallback
  return new MockAiProvider();
}

export * from './interface';
