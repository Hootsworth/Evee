CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description TEXT NOT NULL DEFAULT '',
  work_type TEXT NOT NULL DEFAULT 'task' CHECK (work_type IN ('task', 'follow_up', 'research', 'approval', 'handoff', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  account_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, organization_id)
);

CREATE INDEX work_items_org_status_due_idx ON work_items (organization_id, status, due_at);
CREATE INDEX work_items_org_owner_status_idx ON work_items (organization_id, owner_id, status);
CREATE INDEX work_items_org_account_idx ON work_items (organization_id, account_id);

CREATE TRIGGER update_work_items_updated_at
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE work_item_collaborators (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (work_item_id, user_id),
  FOREIGN KEY (work_item_id, organization_id)
    REFERENCES work_items(id, organization_id) ON DELETE CASCADE
);

CREATE INDEX work_item_collaborators_org_user_idx ON work_item_collaborators (organization_id, user_id);

ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view work items"
  ON work_items FOR SELECT
  USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can create work items"
  ON work_items FOR INSERT
  WITH CHECK (current_user_has_role(organization_id, 'operator') AND created_by = auth.uid());
CREATE POLICY "Workspace operators can update work items"
  ON work_items FOR UPDATE
  USING (current_user_has_role(organization_id, 'operator'))
  WITH CHECK (current_user_has_role(organization_id, 'operator'));
CREATE POLICY "Workspace managers can delete work items"
  ON work_items FOR DELETE
  USING (current_user_has_role(organization_id, 'manager'));

CREATE POLICY "Workspace members can view work item collaborators"
  ON work_item_collaborators FOR SELECT
  USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can manage work item collaborators"
  ON work_item_collaborators FOR ALL
  USING (current_user_has_role(organization_id, 'operator'))
  WITH CHECK (
    current_user_has_role(organization_id, 'operator')
    AND added_by = auth.uid()
  );
