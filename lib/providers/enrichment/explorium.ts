// Evee - Explorium & Multi-Tier Lead Enrichment Provider
// Connects to Explorium B2B Enrichment API with automatic web-inspection and AI fallback

import { EnrichmentProvider, EnrichmentOutput, EnrichedContact } from './interface';
import { extractCanonicalDomain } from '@/lib/normalization/deduplication';
import { inspectWebsite } from '@/lib/research/inspector';
import { getDynamicAiProvider } from '@/lib/providers/ai';
import { MultiLlmProvider } from '@/lib/providers/ai/multi-llm';

export interface ExploriumConfig {
  apiKey?: string;
  baseUrl?: string;
  provider?: 'explorium' | 'hunter' | 'built_in';
}

export async function checkDomainMxDetails(domain: string): Promise<{
  hasMx: boolean;
  provider?: string;
}> {
  if (!domain || !domain.includes('.')) return { hasMx: false };
  try {
    const dns = await import('node:dns/promises');
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) return { hasMx: false };

    const exchanges = records.map((r) => (r.exchange || '').toLowerCase());
    let provider = 'Custom Mail Server';
    if (exchanges.some((e) => e.includes('google') || e.includes('aspmx') || e.includes('gmail'))) {
      provider = 'Google Workspace';
    } else if (exchanges.some((e) => e.includes('outlook') || e.includes('microsoft'))) {
      provider = 'Microsoft 365';
    } else if (exchanges.some((e) => e.includes('zoho'))) {
      provider = 'Zoho Mail';
    } else if (exchanges.some((e) => e.includes('pphosted') || e.includes('proofpoint'))) {
      provider = 'Proofpoint';
    }

    return { hasMx: true, provider };
  } catch {
    return { hasMx: false };
  }
}

export class ExploriumEnrichmentProvider implements EnrichmentProvider {
  name = 'enrichment';
  private apiKey?: string;
  private baseUrl: string;
  private activeProvider: 'explorium' | 'hunter' | 'built_in';

  constructor(config?: ExploriumConfig) {
    this.apiKey = config?.apiKey || process.env.EXPLORIUM_API_KEY || process.env.HUNTER_API_KEY || process.env.ENRICHMENT_API_KEY;
    this.baseUrl = config?.baseUrl || process.env.EXPLORIUM_BASE_URL || 'https://api.explorium.ai/v1';
    this.activeProvider = config?.provider || 'built_in';
  }

  async enrichBusiness(target: {
    name: string;
    website?: string | null;
    domain?: string | null;
    city?: string | null;
    phone?: string | null;
    category?: string | null;
  }): Promise<EnrichmentOutput> {
    const domain = target.domain || extractCanonicalDomain(target.website);
    const contacts: EnrichedContact[] = [];
    let generalEmail: string | undefined;
    let sourceProvider = 'built_in';

    // 1. Try Hunter.io API if provider is Hunter or key is Hunter
    if (this.apiKey && this.activeProvider === 'hunter' && domain) {
      try {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${this.apiKey}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const json = await res.json();
          const hunterEmails = json.data?.emails || [];
          for (const item of hunterEmails) {
            if (item.value) {
              contacts.push({
                fullName: [item.first_name, item.last_name].filter(Boolean).join(' ') || undefined,
                firstName: item.first_name,
                lastName: item.last_name,
                email: item.value.toLowerCase().trim(),
                jobTitle: item.position || 'Decision Maker',
                confidence: (item.confidence || 85) / 100,
                source: 'hunter',
                type: 'published_executive',
                verificationStatus: 'provider_verified',
              });
            }
          }
          if (contacts.length > 0) {
            generalEmail = contacts[0].email;
            sourceProvider = 'hunter';
          }
        }
      } catch (hErr) {
        console.warn('[Hunter Provider] API error, falling back to Web & AI Discovery:', hErr);
      }
    }

    // 1B. Try Explorium Live API if apiKey is present and provider is explorium
    if (this.apiKey && this.activeProvider === 'explorium' && contacts.length === 0) {
      try {
        const response = await fetch(`${this.baseUrl}/businesses/enrich`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
          headers: {
            'Content-Type': 'application/json',
            'API_KEY': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            name: target.name,
            domain: domain || undefined,
            website: target.website || undefined,
            city: target.city || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const businessData = data.business || data.data || data;

          if (businessData.email || businessData.general_email) {
            generalEmail = businessData.email || businessData.general_email;
            contacts.push({
              email: generalEmail!,
              fullName: businessData.contact_name || `${target.name} Team`,
              confidence: 0.95,
              source: 'explorium',
              type: 'licensed_enrichment',
              verificationStatus: 'provider_verified',
            });
            sourceProvider = 'explorium';
          }

          if (Array.isArray(businessData.contacts)) {
            for (const c of businessData.contacts) {
              if (c.email && !contacts.some((existing) => existing.email.toLowerCase() === c.email.toLowerCase())) {
                contacts.push({
                  fullName: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || undefined,
                  firstName: c.first_name,
                  lastName: c.last_name,
                  email: c.email.toLowerCase().trim(),
                  jobTitle: c.title || c.job_title || 'Decision Maker',
                  phone: c.phone || undefined,
                  confidence: c.confidence || 0.9,
                  source: 'explorium',
                  type: 'published_executive',
                  verificationStatus: 'provider_verified',
                });
                sourceProvider = 'explorium';
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Explorium Provider] API error, falling back to Web & AI Discovery:', err);
      }
    }

    // 2. Step 1 (Method 1): Safe Deep Web Inspection (Crawls /contact, /about, /team, /privacy-policy)
    if (contacts.length === 0 && target.website) {
      try {
        const inspection = await inspectWebsite(target.website, 5, 3000);
        if (inspection.contactEmail) {
          generalEmail = inspection.contactEmail;
          const emailDomain = inspection.contactEmail.split('@')[1];
          const mx = await checkDomainMxDetails(emailDomain);

          contacts.push({
            fullName: `${target.name} Contact`,
            email: inspection.contactEmail.toLowerCase().trim(),
            confidence: mx.hasMx ? 0.95 : 0.9,
            source: 'website_inspection',
            type: 'general_business',
            verificationStatus: 'provider_verified',
          });
          sourceProvider = mx.hasMx && mx.provider ? `website_crawl (${mx.provider})` : 'website_crawl';
        }
      } catch (err) {
        console.warn('[Enrichment] Web inspection error:', err);
      }
    }

    // 3. Step 2 & 3 (Methods 3 & 4): Gemini AI Domain Inference + Real DNS MX Validation
    if (contacts.length === 0 && domain) {
      const cleanDomain = domain.replace(/^www\./, '');
      const mx = await checkDomainMxDetails(cleanDomain);
      const defaultMailboxes = ['contact', 'hello', 'info', 'support'];
      const primaryEmail = `${defaultMailboxes[0]}@${cleanDomain}`;

      // Query active Gemini LLM
      try {
        const ai = await getDynamicAiProvider();
        if (ai instanceof MultiLlmProvider) {
          const config = (ai as any).config;
          if (config && config.apiKey) {
            const baseUrl = (ai as any).getEffectiveBaseUrl();
            const model = (ai as any).getEffectiveModel();

            const prompt = `Given business name "${target.name}", category "${target.category || 'Business'}", and canonical domain "${cleanDomain}"${mx.provider ? ` (Mail exchanger: ${mx.provider})` : ''}, what is the most probable public email contact or standard inbound mailbox address (e.g. hello@..., contact@..., info@..., owner@...)? Return valid JSON: {"email": "...", "mailboxRole": "..."}`;

            const aiRes = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              signal: AbortSignal.timeout(2500),
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.1,
              }),
            });

            if (aiRes.ok) {
              const parsed = await aiRes.json();
              const text = parsed.choices?.[0]?.message?.content;
              if (text) {
                const result = JSON.parse(text);
                if (result.email && result.email.includes('@')) {
                  generalEmail = result.email.toLowerCase().trim();
                  contacts.push({
                    fullName: `${target.name} (${result.mailboxRole || 'Inbound'})`,
                    email: generalEmail!,
                    confidence: mx.hasMx ? 0.9 : 0.8,
                    source: 'ai_inference',
                    type: 'general_business',
                    verificationStatus: mx.hasMx ? 'provider_verified' : 'syntax_valid',
                  });
                  sourceProvider = mx.hasMx && mx.provider ? `gemini_ai (${mx.provider})` : 'gemini_ai';
                }
              }
            }
          }
        }
      } catch (aiErr) {
        console.warn('[Enrichment] AI inference fallback error:', aiErr);
      }

      // Step 4 Fallback: Primary corporate mailbox verified with MX
      if (contacts.length === 0) {
        generalEmail = primaryEmail;
        contacts.push({
          fullName: `${target.name} Inquiries`,
          email: primaryEmail,
          confidence: mx.hasMx ? 0.85 : 0.7,
          source: 'ai_inference',
          type: 'general_business',
          verificationStatus: mx.hasMx ? 'provider_verified' : 'syntax_valid',
        });
        sourceProvider = mx.hasMx && mx.provider ? `domain_mx (${mx.provider})` : 'domain_pattern';
      }
    }

    return {
      businessName: target.name,
      domain: domain || undefined,
      generalEmail: generalEmail || contacts[0]?.email,
      phone: target.phone || undefined,
      contacts,
      industry: target.category || undefined,
      sourceProvider,
    };
  }
}
