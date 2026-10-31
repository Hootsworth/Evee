// Evee - AI Provider Interface & Zod Schemas
import { z } from 'zod';
import { EvidenceItem, ResearchResult, ResearchOpportunity } from '@/lib/types';

export const ResearchOpportunitySchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  findingIds: z.array(z.string()),
  businessBenefit: z.string(),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string(),
});

export const ResearchResultSchema = z.object({
  businessSummary: z.string(),
  opportunities: z.array(ResearchOpportunitySchema),
  unsupportedClaims: z.array(z.string()),
  needsHumanReview: z.boolean(),
});

export const EmailDraftOutputSchema = z.object({
  subject: z.string().min(5),
  bodyText: z.string().min(20),
  bodyHtml: z.string().optional(),
  evidenceIds: z.array(z.string()),
  personalizationSummary: z.string(),
});

export type EmailDraftOutput = z.infer<typeof EmailDraftOutputSchema>;

export interface EnhanceDraftInput {
  subject?: string;
  bodyText: string;
  goal?: 'concise' | 'persuasive' | 'cta' | 'warmer' | 'punchy' | 'custom';
  instruction?: string;
  businessContext?: {
    name?: string;
    category?: string;
    city?: string;
  };
}

export interface EnhanceDraftOutput {
  improvedSubject: string;
  improvedBody: string;
  changesSummary: string;
  keyImprovementTips?: string[];
  modelUsed: string;
}

export interface ResearchProvider {
  name: string;
  analyzeBusiness(
    businessContext: { name: string; category?: string; websiteUrl?: string; city?: string },
    evidence: EvidenceItem[],
    services: string[]
  ): Promise<ResearchResult>;
}

export interface DraftProvider {
  name: string;
  createEmailDraft(
    businessContext: { name: string; category?: string; city?: string },
    verifiedFindings: EvidenceItem[],
    serviceMatch: string,
    styleConfig?: { tone?: string; language?: string }
  ): Promise<EmailDraftOutput>;
  enhanceDraft?(input: EnhanceDraftInput): Promise<EnhanceDraftOutput>;
}
