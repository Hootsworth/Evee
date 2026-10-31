// Evee - Lead & Contact Enrichment Interface
// Multi-provider standard for B2B email, phone, and contact discovery

export interface EnrichedContact {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  jobTitle?: string;
  phone?: string;
  confidence: number;
  source: 'explorium' | 'hunter' | 'website_inspection' | 'ai_inference';
  type: 'published_executive' | 'licensed_enrichment' | 'general_business';
  verificationStatus: 'provider_verified' | 'syntax_valid' | 'unknown';
}

export interface EnrichmentOutput {
  businessName: string;
  domain?: string;
  generalEmail?: string;
  phone?: string;
  contacts: EnrichedContact[];
  industry?: string;
  sourceProvider: string;
  rawDetails?: Record<string, any>;
}

export interface EnrichmentProvider {
  name: string;
  enrichBusiness(target: {
    name: string;
    website?: string | null;
    domain?: string | null;
    city?: string | null;
    phone?: string | null;
    category?: string | null;
  }): Promise<EnrichmentOutput>;
}
