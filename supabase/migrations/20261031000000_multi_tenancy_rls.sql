-- Evee Multi-Tenancy & Row-Level Security (RLS) Migration
-- Version: 20261031000000_multi_tenancy_rls.sql

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 2. Organization Members with RBAC roles
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')) DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (organization_id, user_id)
);

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 3. Add organization_id to core entity tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'organization_id') THEN
    ALTER TABLE campaigns ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'organization_id') THEN
    ALTER TABLE businesses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_drafts' AND column_name = 'organization_id') THEN
    ALTER TABLE email_drafts ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outreach_messages' AND column_name = 'organization_id') THEN
    ALTER TABLE outreach_messages ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppression_entries' AND column_name = 'organization_id') THEN
    ALTER TABLE suppression_entries ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'background_jobs' AND column_name = 'organization_id') THEN
    ALTER TABLE background_jobs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_events' AND column_name = 'organization_id') THEN
    ALTER TABLE audit_events ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Helper function: Get organizations the current authenticated user belongs to
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (organization_id UUID, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id, om.role
  FROM organization_members om
  WHERE om.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper function: Check if current user has minimum role in organization
CREATE OR REPLACE FUNCTION current_user_has_role(p_org_id UUID, p_required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT om.role INTO v_role
  FROM organization_members om
  WHERE om.organization_id = p_org_id AND om.user_id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_required_role = 'viewer' THEN
    RETURN v_role IN ('admin', 'operator', 'viewer');
  ELSIF p_required_role = 'operator' THEN
    RETURN v_role IN ('admin', 'operator');
  ELSIF p_required_role = 'admin' THEN
    RETURN v_role = 'admin';
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row Level Security (RLS) on all tenant-isolated tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Organizations
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (current_user_has_role(id, 'admin'));

-- 8. RLS Policies: Campaigns
CREATE POLICY "Members can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY "Operators and admins can create/update campaigns"
  ON campaigns FOR ALL
  USING (current_user_has_role(organization_id, 'operator'));

-- 9. RLS Policies: Businesses & Leads
CREATE POLICY "Members can view businesses in their organization"
  ON businesses FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY "Operators and admins can insert/update businesses"
  ON businesses FOR ALL
  USING (current_user_has_role(organization_id, 'operator'));

-- 10. RLS Policies: Email Drafts
CREATE POLICY "Members can view email drafts in their organization"
  ON email_drafts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY "Operators and admins can approve or edit drafts"
  ON email_drafts FOR ALL
  USING (current_user_has_role(organization_id, 'operator'));

-- 11. RLS Policies: Audit Events
CREATE POLICY "Members can view audit logs for their organization"
  ON audit_events FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY "System can record audit logs"
  ON audit_events FOR INSERT
  WITH CHECK (true);
