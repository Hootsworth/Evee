-- Evee Database Migration: Scope Workflows & Tenant Isolation
-- Version: 20261102000001_scope_workflows_and_dispatch.sql

DO $$
DECLARE
  v_default_org_id UUID;
BEGIN
  SELECT id INTO v_default_org_id FROM organizations WHERE slug = 'primary-workspace' LIMIT 1;

  -- 1. Add organization_id to outreach_workflows
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outreach_workflows' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE outreach_workflows ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- 2. Associate existing workflows with default organization
  IF v_default_org_id IS NOT NULL THEN
    UPDATE outreach_workflows SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- 3. RLS on outreach_workflows
ALTER TABLE outreach_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workflows in their organization" ON outreach_workflows;
CREATE POLICY "Members can view workflows in their organization"
  ON outreach_workflows FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM get_user_organizations())
  );

DROP POLICY IF EXISTS "Operators and admins can manage workflows in their organization" ON outreach_workflows;
CREATE POLICY "Operators and admins can manage workflows in their organization"
  ON outreach_workflows FOR ALL
  USING (
    current_user_has_role(organization_id, 'operator')
  );

-- 4. Index on organization_id
CREATE INDEX IF NOT EXISTS idx_outreach_workflows_organization_id ON outreach_workflows(organization_id);
