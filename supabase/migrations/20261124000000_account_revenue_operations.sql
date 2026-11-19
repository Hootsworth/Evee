CREATE TABLE account_workspace_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  partner_id UUID,
  record_type TEXT NOT NULL CHECK (record_type IN ('account_plan', 'relationship', 'meeting', 'inbound_lead', 'opportunity', 'proposal', 'onboarding', 'renewal', 'health_review', 'escalation', 'vendor', 'procurement', 'service_request', 'success_plan', 'outcome')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  stage TEXT,
  amount NUMERIC(14, 2) CHECK (amount IS NULL OR amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  probability SMALLINT CHECK (probability IS NULL OR probability BETWEEN 0 AND 100),
  source TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  meeting_at TIMESTAMPTZ,
  close_date DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, organization_id)
);
CREATE INDEX account_workspace_records_org_type_idx ON account_workspace_records (organization_id, record_type, status, updated_at DESC);
CREATE INDEX account_workspace_records_account_idx ON account_workspace_records (organization_id, account_id, record_type, created_at DESC);
CREATE INDEX account_workspace_records_owner_due_idx ON account_workspace_records (organization_id, owner_id, due_at);
CREATE INDEX account_workspace_records_opportunity_idx ON account_workspace_records (organization_id, stage, close_date) WHERE record_type = 'opportunity';
CREATE TRIGGER update_account_workspace_records_updated_at BEFORE UPDATE ON account_workspace_records
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE work_items ADD COLUMN parent_record_id UUID REFERENCES account_workspace_records(id) ON DELETE SET NULL;
ALTER TABLE work_items ADD COLUMN blocked_by_work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL;
CREATE INDEX work_items_parent_record_idx ON work_items (organization_id, parent_record_id);
CREATE INDEX work_items_blocked_by_idx ON work_items (blocked_by_work_item_id) WHERE blocked_by_work_item_id IS NOT NULL;

GRANT SELECT ON TABLE account_workspace_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE account_workspace_records TO service_role;
ALTER TABLE account_workspace_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can read account workspace records"
  ON account_workspace_records FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
