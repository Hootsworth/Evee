// Evee - Multi-LLM Provider Adapter
// Supports OpenAI, Google Gemini, and Meta Llama (Together.ai / Groq)
// Supports dynamic API key, free choice of model identifier, and custom base URL

import {
  ResearchProvider,
  DraftProvider,
  ResearchResultSchema,
  EmailDraftOutputSchema,
  EmailDraftOutput,
} from './interface';
import { EvidenceItem, ResearchResult } from '@/lib/types';

export interface LLMConfig {
  provider: 'openai' | 'gemini' | 'meta';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class MultiLlmProvider implements ResearchProvider, DraftProvider {
  name: string;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.name = config.provider;
    this.config = config;
  }

  private getEffectiveBaseUrl(): string {
    if (this.config.baseUrl && this.config.baseUrl.trim()) {
      return this.config.baseUrl.trim().replace(/\/+$/, '');
    }

    if (this.config.provider === 'gemini') {
      // Gemini's official OpenAI-compatible endpoint
      return 'https://generativelanguage.googleapis.com/v1beta/openai';
    } else if (this.config.provider === 'meta') {
      // Meta Llama endpoints via Together.ai
      return 'https://api.together.xyz/v1';
    }

    // Default OpenAI
    return 'https://api.openai.com/v1';
  }

  private getEffectiveModel(): string {
    const raw = this.config.model?.trim() || '';

    // If user provided a specific model identifier, respect their free choice
    if (raw) {
      // Helpful shortcuts for aliases
      const lower = raw.toLowerCase();
      if (this.config.provider === 'gemini') {
        if (lower === 'gemini-1.5-flash' || lower.includes('1.5-flash')) return 'gemini-1.5-flash';
        if (lower === 'gemini-2.0-flash' || lower.includes('2.0')) return 'gemini-2.0-flash';
        if (lower === 'gemini-1.5-pro' || lower.includes('1.5-pro')) return 'gemini-1.5-pro';
      } else if (this.config.provider === 'meta') {
        if (lower.includes('3.3-70b') || lower.includes('70b-turbo')) {
          return 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
        }
        if (lower.includes('3.1-8b') || lower.includes('8b-turbo')) {
          return 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
        }
      } else if (this.config.provider === 'openai') {
        if (lower === 'gpt-4o-mini' || lower.includes('mini')) return 'gpt-4o-mini';
        if (lower === 'gpt-4o' || lower === '4o') return 'gpt-4o';
      }

      return raw;
    }

    // Default fallbacks per provider
    if (this.config.provider === 'gemini') return 'gemini-1.5-flash';
    if (this.config.provider === 'meta') return 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
    return 'gpt-4o-mini';
  }

  async analyzeBusiness(
    businessContext: { name: string; category?: string; websiteUrl?: string; city?: string },
    evidence: EvidenceItem[],
    services: string[]
  ): Promise<ResearchResult> {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.config.provider.toUpperCase()}. Please configure it in Settings.`);
    }

    const systemPrompt = `You are an expert B2B research analyst for Evee.
Analyze the following business and the provided empirical evidence items observed from public webpages.
Map evidence to addressable services from the provided list: ${JSON.stringify(services)}.
CRITICAL RULES:
- ONLY reference evidence item IDs that actually exist in the input. Never invent an ID.
- Do NOT hallucinate claims or pretend you visited in person.
- If evidence is weak or uncertain, mark needsHumanReview as true.
- Output strictly valid JSON matching:
{
  "businessSummary": "string",
  "opportunities": [
    {
      "serviceId": "string",
      "serviceName": "string",
      "findingIds": ["string"],
      "businessBenefit": "string",
      "confidence": number,
      "reasoningSummary": "string"
    }
  ],
  "unsupportedClaims": [],
  "needsHumanReview": boolean
}`;

    const userPrompt = JSON.stringify({
      business: businessContext,
      evidence: evidence.map((e) => ({
        id: e.id,
        finding_type: e.finding_type,
        claim_text: e.claim_text,
        confidence: e.confidence,
        url: e.source_url,
      })),
      services,
    });

    const baseUrl = this.getEffectiveBaseUrl();
    const model = this.getEffectiveModel();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.config.provider.toUpperCase()} (${model}) API returned error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.config.provider.toUpperCase()} (${model}) returned empty response`);
    }

    const parsedJson = JSON.parse(content);
    return ResearchResultSchema.parse(parsedJson);
  }

  async createEmailDraft(
    businessContext: { name: string; category?: string; city?: string },
    verifiedFindings: EvidenceItem[],
    serviceMatch: string,
    styleConfig?: { tone?: string; language?: string }
  ): Promise<EmailDraftOutput> {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.config.provider.toUpperCase()}. Please configure it in Settings.`);
    }

    const systemPrompt = `You are a professional outreach copywriter for Evee.
Draft a concise, personalized cold email to the owner of ${businessContext.name}.
RULES:
1. Ground the email in the verified empirical observation provided.
2. Present a plausible business benefit for ${serviceMatch}.
3. Concise call to action (5-minute chat).
4. Plain-text focus, no hype, no deceptive claims.
5. Include an opt-out footer disclosure ("Reply 'unsubscribe' to opt out").
6. ONLY return evidence IDs that were supplied in the prompt.
7. Return JSON matching: { "subject": string, "bodyText": string, "evidenceIds": string[], "personalizationSummary": string }`;

    const userPrompt = JSON.stringify({
      business: businessContext,
      serviceMatch,
      evidence: verifiedFindings.map((f) => ({
        id: f.id,
        claim: f.claim_text,
        type: f.finding_type,
      })),
      tone: styleConfig?.tone || 'respectful, direct, helpful',
    });

    const baseUrl = this.getEffectiveBaseUrl();
    const model = this.getEffectiveModel();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.config.provider.toUpperCase()} (${model}) API returned error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsedJson = JSON.parse(content);

    return EmailDraftOutputSchema.parse(parsedJson);
  }
}
