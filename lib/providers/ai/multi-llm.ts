// Evee - Multi-LLM Provider Adapter
// Supports OpenAI, Google Gemini, and Meta Llama (Together.ai / Groq)
// Supports dynamic API key, free choice of model identifier, and custom base URL

import {
  ResearchProvider,
  DraftProvider,
  ResearchResultSchema,
  EmailDraftOutputSchema,
  EmailDraftOutput,
  EnhanceDraftInput,
  EnhanceDraftOutput,
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

  async enhanceDraft(input: EnhanceDraftInput): Promise<EnhanceDraftOutput> {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.config.provider.toUpperCase()}. Please configure it in Settings.`);
    }

    const goalDescriptions: Record<string, string> = {
      concise: 'Make this draft radically concise, sharp, and easy to read on mobile. Cut fluff, preamble, and pleasantries. Target under 85 words.',
      persuasive: 'Make this draft more compelling and value-focused. Hook the reader immediately and articulate the high-impact business benefit clearly.',
      cta: 'Improve the Call-To-Action (CTA). Make it conversational, low-friction, and easy to reply to (e.g. asking if they are open to a 2-min screen share or quick question).',
      warmer: 'Make the tone warmer, respectful, consultative, and peer-to-peer. Avoid sounding like a pushy or automated sales blast.',
      punchy: 'Make sentences short, active, dynamic, and direct. Eliminate passive voice and corporate jargon.',
      custom: input.instruction || 'Improve the copy for better clarity and conversion.',
    };

    const targetGoal = input.goal || 'persuasive';
    const goalInstruction = goalDescriptions[targetGoal] || goalDescriptions.persuasive;

    const systemPrompt = `You are a world-class B2B cold email strategist and copywriter.
Your task is to refine and elevate an outreach email to maximize engagement, positive reply rates, and clarity.

PRIMARY OBJECTIVE:
${goalInstruction}

ADDITIONAL OPERATOR INSTRUCTION:
${input.instruction ? input.instruction : 'None provided.'}

CRITICAL RULES:
1. STRICTLY PRESERVE all placeholder/template tokens in curly brackets (e.g., {first_name}, {company_name}, {company_type}, {personalized_pitch}, {website}, {city}, {industry}, {pain_point}, {value_prop}). NEVER remove, rename, or translate these tokens.
2. Maintain plain-text email styling with short 1-2 sentence paragraphs.
3. Preserve or include an opt-out footer notice (e.g., "Reply 'unsubscribe' to opt out" or similar).
4. Do NOT make deceptive claims or fake guarantees.
5. Provide a crisp summary of what you improved and why.

Output strictly valid JSON with this exact schema:
{
  "improvedSubject": "Refined email subject line",
  "improvedBody": "Refined plain text email body",
  "changesSummary": "Concise 1-2 sentence summary of specific enhancements made",
  "keyImprovementTips": ["Key tip 1 applied", "Key tip 2 applied"]
}`;

    const userPrompt = JSON.stringify({
      businessContext: input.businessContext,
      currentSubject: input.subject || '',
      currentBodyText: input.bodyText,
      goal: targetGoal,
      operatorInstruction: input.instruction,
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
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.config.provider.toUpperCase()} (${model}) API returned error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error(`${this.config.provider.toUpperCase()} (${model}) returned empty response`);
    }

    let parsed: any;
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse AI response into JSON: ${rawContent.slice(0, 100)}`);
    }

    return {
      improvedSubject: parsed.improvedSubject || input.subject || 'Follow-up regarding your workflow',
      improvedBody: parsed.improvedBody || input.bodyText,
      changesSummary: parsed.changesSummary || 'Copy polished for clarity and conversion.',
      keyImprovementTips: Array.isArray(parsed.keyImprovementTips) ? parsed.keyImprovementTips : [],
      modelUsed: `${this.config.provider.toUpperCase()} // ${model}`,
    };
  }
}
