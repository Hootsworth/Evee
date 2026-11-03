// Evee - Live LLM Provider Adapter
// Uses OpenAI-compatible chat completion endpoint (works with OpenAI, Together.ai, OpenRouter, or Gemini OpenAI compatibility)
// Enforces structured output and validates responses using Zod

import {
  ResearchProvider,
  DraftProvider,
  ResearchResultSchema,
  EmailDraftOutputSchema,
  EmailDraftOutput,
} from './interface';
import { EvidenceItem, ResearchResult } from '@/lib/types';

export class OpenAiProvider implements ResearchProvider, DraftProvider {
  name = 'openai-compatible';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.AI_API_KEY || '';
    this.model = model || process.env.AI_MODEL || 'gpt-4o-mini';
    this.baseUrl = baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  }

  async analyzeBusiness(
    businessContext: { name: string; category?: string; websiteUrl?: string; city?: string },
    evidence: EvidenceItem[],
    services: string[]
  ): Promise<ResearchResult> {
    if (!this.apiKey) {
      throw new Error('AI API key is missing. Set AI_API_KEY in environment.');
    }

    const systemPrompt = `You are an expert B2B research analyst for Evee.
Analyze the following business and the provided empirical evidence items observed from public webpages.
Map evidence to addressable services from the provided list: ${JSON.stringify(services)}.
CRITICAL RULES:
- ONLY reference evidence item IDs that actually exist in the input. Never invent an ID.
- Do NOT hallucinate claims or pretend you visited in person.
- If evidence is weak or uncertain, mark needsHumanReview as true.
- Output strictly valid JSON matching the required schema.`;

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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
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
      throw new Error(`AI API returned error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI API returned empty response');
    }

    const parsedJson = JSON.parse(content);
    // Validate output strictly with Zod
    return ResearchResultSchema.parse(parsedJson);
  }

  async createEmailDraft(
    businessContext: { name: string; category?: string; city?: string },
    verifiedFindings: EvidenceItem[],
    serviceMatch: string,
    styleConfig?: { tone?: string; language?: string }
  ): Promise<EmailDraftOutput> {
    if (!this.apiKey) {
      throw new Error('AI API key is missing. Set AI_API_KEY in environment.');
    }

    const systemPrompt = `You are a world-class 1-to-1 cold outreach craftsman writing for Evee.
Your goal is to write a bespoke, hand-crafted email to the owner/operator of ${businessContext.name} that feels completely personal, authentic, and unique to their specific company — as if you personally researched them for 15 minutes before drafting.

CRITICAL CRAFTSMANSHIP RULES:
1. NEVER SOUND LIKE A TEMPLATE OR A BOT:
   - Absolutely NO corporate throat-clearing (NO "I hope this email finds you well", "I wanted to reach out because", "In today's fast-paced digital world", "As a valued business in ${businessContext.city || 'your area'}").
   - NO marketing jargon (NO "synergize", "game-changing", "streamline completely").
2. GROUNDED IN EMPIRICAL OBSERVATION:
   - Naturally mention the verified observation provided as a genuine peer who actually visited their website.
   - Connect that exact observation to a tangible business outcome for ${serviceMatch}.
3. CASUAL, RESPECTFUL, PEER-TO-PEER VOICE:
   - Write like one busy founder/operator emailing another.
   - Keep it short: 50 to 85 words maximum. 2 to 3 short paragraphs.
4. LOW-FRICTION CONVERSATIONAL CTA:
   - Low friction question: "Worth a quick 2-minute glance?", "Happy to send over a 60-second video if helpful."
5. AUTHENTIC LOWERCASE/CONVERSATIONAL SUBJECT LINE:
   - E.g. "quick note regarding ${businessContext.name}", "observation on ${businessContext.name}'s site".
6. INCLUDE CLEAN COMPLIANCE FOOTER:
   - Conclude naturally with an opt-out line: "Reply 'unsubscribe' to opt out."
7. ONLY return evidence IDs that were supplied in the prompt.
8. Return JSON matching: { subject, bodyText, evidenceIds: string[], personalizationSummary: string }`;

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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
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
      throw new Error(`AI API returned error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsedJson = JSON.parse(content);

    return EmailDraftOutputSchema.parse(parsedJson);
  }
}
