// Evee - Core Domain Types
// Strictly aligned with ARCHITECTURE.MD Part C & E

export type BusinessRecordStatus = 'active' | 'archived' | 'merged' | 'suppressed';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type QualificationStatus = 'pending' | 'qualified' | 'disqualified' | 'review_required';
export type ResearchStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
export type EvidenceVerificationStatus = 'verified' | 'uncertain' | 'contradicted' | 'expired';
export type ContactChannel = 'email' | 'phone' | 'website_form';
export type ContactType = 'general_business' | 'published_executive' | 'user_provided' | 'licensed_enrichment';
export type ContactVerificationStatus = 'unknown' | 'syntax_valid' | 'provider_verified' | 'bounced' | 'invalid';
export type ContactEligibility = 'eligible' | 'review_required' | 'ineligible';
export type ConsentStatus = 'unknown' | 'consented' | 'not_required_confirmed' | 'withdrawn' | 'denied';
export type WorkflowStatus = 'draft' | 'pending_approval' | 'approved' | 'paused' | 'revoked';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'bounced' | 'replied' | 'cancelled' | 'unknown_outcome';
export type SuppressionReason = 'opt_out' | 'complaint' | 'hard_bounce' | 'manual_block' | 'legal_restriction';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'manual_review';

export interface Profile {
  id: string;
  display_name: string;
  role: 'owner' | 'operator';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  normalized_name: string;
  display_name: string;
  business_type: string;
  description: string | null;
  country_code: string;
  region: string;
  city: string;
  postal_code: string | null;
  official_website_url: string | null;
  public_business_phone: string | null;
  general_business_email: string | null;
  canonical_domain: string | null;
  identity_confidence: number;
  record_status: BusinessRecordStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessSource {
  id: string;
  business_id: string;
  provider_name: string;
  provider_record_id: string | null;
  source_url: string | null;
  source_type: 'official_api' | 'website' | 'directory' | 'user_provided' | 'licensed_enrichment';
  retrieved_at: string;
  retention_policy_id: string;
  permitted_fields: Record<string, unknown>;
  provider_metadata: Record<string, unknown>;
}

export interface Campaign {
  id: string;
  name: string;
  target_geographies: string[];
  target_industries: string[];
  search_terms: string[];
  services_to_promote: string[];
  monthly_target: number;
  daily_discovery_limit: number;
  qualification_threshold: number;
  status: CampaignStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignBusiness {
  campaign_id: string;
  business_id: string;
  discovery_status: 'discovered' | 'researching' | 'researched' | 'scoring' | 'scored' | 'rejected';
  qualification_score: number | null;
  qualification_status: QualificationStatus;
  added_at: string;
  // Joined fields
  business?: Business;
  score?: LeadScore;
}

export interface ResearchRun {
  id: string;
  business_id: string;
  campaign_id: string | null;
  status: ResearchStatus;
  started_at: string | null;
  completed_at: string | null;
  pages_attempted: number;
  pages_successfully_read: number;
  error_code: string | null;
  error_summary: string | null;
  model_provider: string | null;
  model_name: string | null;
  estimated_cost: number;
  currency: string;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  business_id: string;
  research_run_id: string | null;
  source_url: string;
  source_type: string;
  observed_at: string;
  finding_type: string;
  claim_text: string;
  supporting_excerpt: string | null;
  confidence: number;
  verification_status: EvidenceVerificationStatus;
  expires_at: string | null;
  retention_policy_id: string;
  metadata: Record<string, unknown>;
}

export interface Contact {
  id: string;
  business_id: string;
  contact_name: string | null;
  job_title: string | null;
  email_address: string | null;
  email_normalized: string | null;
  contact_channel: ContactChannel;
  contact_source_url: string | null;
  contact_type: ContactType;
  verification_status: ContactVerificationStatus;
  contact_eligibility: ContactEligibility;
  consent_status: ConsentStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadScore {
  id: string;
  business_id: string;
  campaign_id: string | null;
  score_version: string;
  fit_score: number;
  need_score: number;
  contactability_score: number;
  service_match_score: number;
  evidence_confidence: number;
  final_score: number;
  reason_codes: string[];
  created_at: string;
}

export interface EmailDraft {
  id: string;
  business_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  personalization_summary: string;
  evidence_item_ids: string[];
  model_provider: string;
  model_name: string;
  prompt_version: string;
  validation_status: 'valid' | 'unsupported_claims' | 'needs_review';
  approval_status: 'pending' | 'approved' | 'rejected' | 'expired';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  business?: Business;
  contact?: Contact;
}

export interface OutreachWorkflow {
  id: string;
  name: string;
  version: number;
  status: WorkflowStatus;
  configuration: {
    daily_limit: number;
    monthly_limit: number;
    followup_intervals_days: number[];
    require_manual_review_for_uncertain_evidence: boolean;
    require_contact_verification: boolean;
    auto_send_enabled: boolean;
    sender_account_email?: string;
  };
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachMessage {
  id: string;
  business_id: string;
  contact_id: string;
  draft_id: string;
  workflow_id: string;
  workflow_version: number;
  channel: string;
  provider_message_id: string | null;
  idempotency_key: string;
  status: MessageStatus;
  scheduled_at: string;
  attempted_at: string | null;
  sent_at: string | null;
  failure_code: string | null;
  failure_detail: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  business?: Business;
  contact?: Contact;
  draft?: EmailDraft;
}

export interface SuppressionEntry {
  id: string;
  normalized_email: string | null;
  normalized_phone: string | null;
  business_id: string | null;
  channel: string | null;
  reason: SuppressionReason;
  source: string;
  created_at: string;
}

export interface FollowUpTask {
  id: string;
  business_id: string;
  contact_id: string;
  related_message_id: string | null;
  task_type: string;
  due_at: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ProviderUsage {
  id: string;
  provider_name: string;
  operation: string;
  campaign_id: string | null;
  request_count: number;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  currency: string;
  billing_period: string;
  recorded_at: string;
  metadata: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  request_id: string | null;
  details: Record<string, unknown>;
}

export interface BackgroundJob<T = Record<string, unknown>> {
  id: string;
  job_type:
    | 'discover_businesses'
    | 'research_business'
    | 'score_lead'
    | 'generate_draft'
    | 'send_email'
    | 'sync_replies'
    | 'process_followups'
    | 'refresh_evidence'
    | 'reconcile_unknown_send';
  payload: T;
  status: JobStatus;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string;
  locked_at: string | null;
  locked_by: string | null;
  heartbeat_at: string | null;
  last_error_code: string | null;
  last_error_summary: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

// Provider neutral interfaces
export interface DiscoveryQuery {
  geography: string;
  categories: string[];
  keywords: string[];
  limit: number;
}

export interface BusinessCandidate {
  provider: string;
  providerId?: string;
  name: string;
  category?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  officialWebsite?: string;
  publicContact?: string;
  publicPhone?: string;
  sourceUrl?: string;
  attribution?: string;
}

export interface DiscoveryProvider {
  name: string;
  search(query: DiscoveryQuery): Promise<BusinessCandidate[]>;
}

export interface ResearchOpportunity {
  serviceId: string;
  serviceName: string;
  findingIds: string[];
  businessBenefit: string;
  confidence: number;
  reasoningSummary: string;
}

export interface ResearchResult {
  businessSummary: string;
  opportunities: ResearchOpportunity[];
  unsupportedClaims: string[];
  needsHumanReview: boolean;
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
  ): Promise<{
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    evidenceIds: string[];
  }>;
}
