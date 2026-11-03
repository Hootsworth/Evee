-- Evee Database Migration: Scope Credentials & Enforce Tenant Isolation
-- Version: 20261102000000_scope_credentials_and_tenant_security.sql

-- 1. Ensure organizations exist for any legacy seed data
DO $$
DECLARE
  v_default_org_id UUID;
BEGIN
  -- Create primary default organization if none exists
  INSERT INTO organizations (name, slug, plan)
  VALUES ('Primary Workspace', 'primary-workspace', 'growth')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_default_org_id FROM organizations WHERE slug = 'primary-workspace' LIMIT 1;

  -- 2. Scope oauth_credentials by organization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oauth_credentials' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE oauth_credentials ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Associate any existing credentials with default organization
  IF v_default_org_id IS NOT NULL THEN
    UPDATE oauth_credentials SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  END IF;

  -- 3. Update unique constraint on oauth_credentials from UNIQUE(provider) to UNIQUE(organization_id, provider)
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_credentials_provider_key'
  ) THEN
    ALTER TABLE oauth_credentials DROP CONSTRAINT oauth_credentials_provider_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_oauth_credentials_org_provider'
  ) THEN
    ALTER TABLE oauth_credentials ADD CONSTRAINT uq_oauth_credentials_org_provider UNIQUE (organization_id, provider);
  END IF;

  -- 4. Scope any orphaned businesses, campaigns, and drafts to default org
  IF v_default_org_id IS NOT NULL THEN
    UPDATE businesses SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    UPDATE campaigns SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    UPDATE email_drafts SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    UPDATE background_jobs SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    UPDATE suppression_entries SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- 5. RLS Policies on oauth_credentials
ALTER TABLE oauth_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view credentials in their organization" ON oauth_credentials;
CREATE POLICY "Members can view credentials in their organization"
  ON oauth_credentials FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM get_user_organizations())
  );

DROP POLICY IF EXISTS "Admins can manage credentials in their organization" ON oauth_credentials;
CREATE POLICY "Admins can manage credentials in their organization"
  ON oauth_credentials FOR ALL
  USING (
    current_user_has_role(organization_id, 'admin')
  );

-- 6. Indexes for multi-tenant query performance
CREATE INDEX IF NOT EXISTS idx_oauth_credentials_org_provider ON oauth_credentials(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_businesses_organization_id ON businesses(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization_id ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_organization_id ON email_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_organization_id ON background_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppression_entries_organization_id ON suppression_entries(organization_id);
