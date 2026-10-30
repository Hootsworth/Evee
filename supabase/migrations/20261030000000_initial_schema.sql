-- Evee Database Schema Migration
-- Version: 20261030000000_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'operator')) DEFAULT 'owner',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 2. businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  description TEXT,
  country_code TEXT NOT NULL DEFAULT 'IN',
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  official_website_url TEXT,
  public_business_phone TEXT,
  general_business_email TEXT,
  canonical_domain TEXT,
  identity_confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active', 'archived', 'merged', 'suppressed')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_businesses_canonical_domain ON businesses(canonical_domain);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_record_status ON businesses(record_status);

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 3. business_sources
CREATE TABLE IF NOT EXISTS business_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_record_id TEXT,
  source_url TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('official_api', 'website', 'directory', 'user_provided', 'licensed_enrichment')),
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  retention_policy_id TEXT NOT NULL DEFAULT 'default',
  permitted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_provider_record UNIQUE (provider_name, provider_record_id)
);

CREATE INDEX IF NOT EXISTS idx_business_sources_business_id ON business_sources(business_id);

-- 4. campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_geographies JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_industries JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  services_to_promote JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_target INT NOT NULL DEFAULT 100,
  daily_discovery_limit INT NOT NULL DEFAULT 20,
  qualification_threshold INT NOT NULL DEFAULT 65,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. campaign_businesses
CREATE TABLE IF NOT EXISTS campaign_businesses (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  discovery_status TEXT NOT NULL DEFAULT 'discovered' CHECK (discovery_status IN ('discovered', 'researching', 'researched', 'scoring', 'scored', 'rejected')),
  qualification_score INT,
  qualification_status TEXT NOT NULL DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'qualified', 'disqualified', 'review_required')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (campaign_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_businesses_status ON campaign_businesses(qualification_status);

-- 6. research_runs
CREATE TABLE IF NOT EXISTS research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'blocked')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pages_attempted INT NOT NULL DEFAULT 0,
  pages_successfully_read INT NOT NULL DEFAULT 0,
  error_code TEXT,
  error_summary TEXT,
  model_provider TEXT,
  model_name TEXT,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_research_runs_business_id ON research_runs(business_id);

-- 7. evidence_items
CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  research_run_id UUID REFERENCES research_runs(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  finding_type TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  supporting_excerpt TEXT,
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'uncertain', 'contradicted', 'expired')),
  expires_at TIMESTAMPTZ,
  retention_policy_id TEXT NOT NULL DEFAULT 'default',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_business_id ON evidence_items(business_id);

-- 8. contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_name TEXT,
  job_title TEXT,
  email_address TEXT,
  email_normalized TEXT,
  contact_channel TEXT NOT NULL DEFAULT 'email',
  contact_source_url TEXT,
  contact_type TEXT NOT NULL DEFAULT 'general_business' CHECK (contact_type IN ('general_business', 'published_executive', 'user_provided', 'licensed_enrichment')),
  verification_status TEXT NOT NULL DEFAULT 'unknown' CHECK (verification_status IN ('unknown', 'syntax_valid', 'provider_verified', 'bounced', 'invalid')),
  contact_eligibility TEXT NOT NULL DEFAULT 'review_required' CHECK (contact_eligibility IN ('eligible', 'review_required', 'ineligible')),
  consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown', 'consented', 'not_required_confirmed', 'withdrawn', 'denied')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contacts_business_id ON contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_normalized ON contacts(email_normalized);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 9. lead_scores
CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  score_version TEXT NOT NULL DEFAULT 'v1',
  fit_score INT NOT NULL CHECK (fit_score >= 0 AND fit_score <= 30),
  need_score INT NOT NULL CHECK (need_score >= 0 AND need_score <= 35),
  contactability_score INT NOT NULL CHECK (contactability_score >= 0 AND contactability_score <= 15),
  service_match_score INT NOT NULL CHECK (service_match_score >= 0 AND service_match_score <= 20),
  evidence_confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  final_score INT NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_business_id ON lead_scores(business_id);

-- 10. email_drafts
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  personalization_summary TEXT NOT NULL,
  evidence_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'unsupported_claims', 'needs_review')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_approval_status ON email_drafts(approval_status);

CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 11. outreach_workflows
CREATE TABLE IF NOT EXISTS outreach_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'paused', 'revoked')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_outreach_workflows_updated_at
  BEFORE UPDATE ON outreach_workflows
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 12. outreach_messages
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES email_drafts(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES outreach_workflows(id) ON DELETE RESTRICT,
  workflow_version INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  provider_message_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'bounced', 'replied', 'cancelled', 'unknown_outcome')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_idempotency ON outreach_messages(idempotency_key);

CREATE TRIGGER update_outreach_messages_updated_at
  BEFORE UPDATE ON outreach_messages
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 13. suppression_entries
CREATE TABLE IF NOT EXISTS suppression_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email TEXT,
  normalized_phone TEXT,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  channel TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('opt_out', 'complaint', 'hard_bounce', 'manual_block', 'legal_restriction')),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_entries(normalized_email);

-- 14. follow_up_tasks
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  related_message_id UUID REFERENCES outreach_messages(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'email_follow_up',
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_follow_up_tasks_updated_at
  BEFORE UPDATE ON follow_up_tasks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 15. provider_usage
CREATE TABLE IF NOT EXISTS provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  request_count INT NOT NULL DEFAULT 1,
  input_tokens INT,
  output_tokens INT,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  actual_cost NUMERIC(10, 4),
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_period TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_provider ON provider_usage(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_usage_period ON provider_usage(billing_period);

-- 16. audit_events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  request_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);

-- 17. background_jobs
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'manual_review')),
  priority INT NOT NULL DEFAULT 0,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  heartbeat_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_summary TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_queue ON background_jobs(status, scheduled_at, priority DESC);

CREATE TRIGGER update_background_jobs_updated_at
  BEFORE UPDATE ON background_jobs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 18. oauth_credentials (Restricted Server-Only Storage)
CREATE TABLE IF NOT EXISTS oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE DEFAULT 'google',
  account_email TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_access_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_oauth_credentials_updated_at
  BEFORE UPDATE ON oauth_credentials
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Atomic job claim function with SKIP LOCKED
CREATE OR REPLACE FUNCTION claim_background_jobs(
  p_worker_id TEXT,
  p_batch_size INT DEFAULT 5,
  p_lock_timeout_seconds INT DEFAULT 300
)
RETURNS SETOF background_jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE background_jobs
  SET
    status = 'running',
    locked_at = timezone('utc', now()),
    locked_by = p_worker_id,
    heartbeat_at = timezone('utc', now()),
    attempt_count = attempt_count + 1,
    updated_at = timezone('utc', now())
  WHERE id IN (
    SELECT id
    FROM background_jobs
    WHERE
      (status = 'queued' AND scheduled_at <= timezone('utc', now()))
      OR (status = 'running' AND locked_at < timezone('utc', now()) - (p_lock_timeout_seconds || ' seconds')::interval)
    ORDER BY priority DESC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_credentials ENABLE ROW LEVEL SECURITY;

-- Base RLS Policies: Authenticated active owners/operators have read access
-- oauth_credentials is strictly accessible only to service role (no public/auth policies)
CREATE POLICY "Profiles viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles editable by self" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Standard authenticated policies for CRM data
CREATE POLICY "Businesses viewable by authenticated" ON businesses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Businesses insertable by authenticated" ON businesses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Businesses updatable by authenticated" ON businesses
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Campaigns viewable by authenticated" ON campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Campaigns insertable by authenticated" ON campaigns
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Campaigns updatable by authenticated" ON campaigns
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Campaign businesses viewable by authenticated" ON campaign_businesses
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Research runs viewable by authenticated" ON research_runs
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Evidence items viewable by authenticated" ON evidence_items
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Contacts viewable by authenticated" ON contacts
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Lead scores viewable by authenticated" ON lead_scores
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Email drafts viewable by authenticated" ON email_drafts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Email drafts insertable by authenticated" ON email_drafts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Email drafts updatable by authenticated" ON email_drafts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Outreach workflows viewable by authenticated" ON outreach_workflows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Outreach messages viewable by authenticated" ON outreach_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Suppression entries viewable by authenticated" ON suppression_entries
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Follow up tasks viewable by authenticated" ON follow_up_tasks
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Provider usage viewable by authenticated" ON provider_usage
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Audit events viewable by authenticated" ON audit_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Background jobs viewable by authenticated" ON background_jobs
  FOR SELECT TO authenticated USING (true);
