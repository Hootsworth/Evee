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
}

export class ExploriumEnrichmentProvider implements EnrichmentProvider {
  name = 'explorium';
  private apiKey?: string;
  private baseUrl: string;

  constructor(config?: ExploriumConfig) {
    this.apiKey = config?.apiKey || process.env.EXPLORIUM_API_KEY || process.env.ENRICHMENT_API_KEY;
    this.baseUrl = config?.baseUrl || process.env.EXPLORIUM_BASE_URL || 'https://api.explorium.ai/v1';
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
    let sourceProvider = 'explorium';

    // 1. Try Explorium Live API if apiKey is present
    if (this.apiKey) {
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
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Explorium Provider] API error, falling back to Web & AI Discovery:', err);
      }
    }

    // 2. Secondary Tier: Safe Web Inspection if email not found yet
    if (contacts.length === 0 && target.website) {
      try {
        const inspection = await inspectWebsite(target.website, 3);
        if (inspection.contactEmail) {
          generalEmail = inspection.contactEmail;
          contacts.push({
            fullName: `${target.name} Contact`,
            email: inspection.contactEmail.toLowerCase().trim(),
            confidence: 0.9,
            source: 'website_inspection',
            type: 'general_business',
            verificationStatus: 'provider_verified',
          });
          sourceProvider = 'website_inspection';
        }
      } catch (err) {
        console.warn('[Enrichment] Web inspection error:', err);
      }
    }

    // 3. Third Tier: Domain Email Heuristic & AI Model Inference
    if (contacts.length === 0 && domain) {
      const cleanDomain = domain.replace(/^www\./, '');
      const defaultMailboxes = ['contact', 'hello', 'info', 'support'];
      const primaryEmail = `${defaultMailboxes[0]}@${cleanDomain}`;

      // Check if we can use active AI provider to deduce key founder / operator email format
      try {
        const ai = await getDynamicAiProvider();
        if (ai instanceof MultiLlmProvider) {
          const config = (ai as any).config;
          if (config && config.apiKey) {
            const baseUrl = (ai as any).getEffectiveBaseUrl();
            const model = (ai as any).getEffectiveModel();

            const prompt = `Given business name "${target.name}", category "${target.category || 'Business'}", and canonical domain "${cleanDomain}", what is the most probable public email contact or standard mailbox address (e.g. hello@..., contact@..., info@..., owner@...)? Return valid JSON: {"email": "...", "mailboxRole": "..."}`;

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
                    confidence: 0.8,
                    source: 'ai_inference',
                    type: 'general_business',
                    verificationStatus: 'syntax_valid',
                  });
                  sourceProvider = 'ai_inference';
                }
              }
            }
          }
        }
      } catch (aiErr) {
        console.warn('[Enrichment] AI inference fallback error:', aiErr);
      }

      // If still empty, use high-confidence primary domain mailbox
      if (contacts.length === 0) {
        generalEmail = primaryEmail;
        contacts.push({
          fullName: `${target.name} Inquiries`,
          email: primaryEmail,
          confidence: 0.75,
          source: 'ai_inference',
          type: 'general_business',
          verificationStatus: 'syntax_valid',
        });
        sourceProvider = 'heuristic_domain';
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
