CREATE TABLE work_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, organization_id),
  FOREIGN KEY (work_item_id, organization_id)
    REFERENCES work_items(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX work_item_comments_thread_idx ON work_item_comments (organization_id, work_item_id, created_at);

CREATE TABLE work_item_mentions (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id, organization_id)
    REFERENCES work_item_comments(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX work_item_mentions_org_user_idx ON work_item_mentions (organization_id, user_id);
ALTER TABLE work_item_mentions
  ADD CONSTRAINT work_item_mentions_member_fk
  FOREIGN KEY (organization_id, user_id)
  REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE;

CREATE TABLE work_item_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL,
  checklist_name TEXT NOT NULL DEFAULT 'Checklist' CHECK (length(trim(checklist_name)) BETWEEN 1 AND 120),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  position INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (work_item_id, organization_id)
    REFERENCES work_items(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX work_item_checklist_items_order_idx ON work_item_checklist_items (organization_id, work_item_id, checklist_name, position);

CREATE TABLE work_item_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  request_note TEXT NOT NULL DEFAULT '' CHECK (length(request_note) <= 2000),
  decision_note TEXT NOT NULL DEFAULT '' CHECK (length(decision_note) <= 2000),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  decided_at TIMESTAMPTZ,
  FOREIGN KEY (work_item_id, organization_id)
    REFERENCES work_items(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX work_item_approvals_queue_idx ON work_item_approvals (organization_id, status, requested_at);
CREATE UNIQUE INDEX work_item_approvals_one_pending_idx ON work_item_approvals (work_item_id) WHERE status = 'pending';

CREATE TABLE work_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 4194304),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (work_item_id, organization_id)
    REFERENCES work_items(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX work_item_attachments_thread_idx ON work_item_attachments (organization_id, work_item_id, created_at);

ALTER TABLE work_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read work item comments"
  ON work_item_comments FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can comment on work items"
  ON work_item_comments FOR INSERT
  WITH CHECK (current_user_has_role(organization_id, 'operator') AND author_id = auth.uid());
CREATE POLICY "Workspace members can read work item mentions"
  ON work_item_mentions FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can create work item mentions"
  ON work_item_mentions FOR INSERT
  WITH CHECK (current_user_has_role(organization_id, 'operator'));
CREATE POLICY "Workspace members can read work item checklist"
  ON work_item_checklist_items FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can manage work item checklist"
  ON work_item_checklist_items FOR ALL
  USING (current_user_has_role(organization_id, 'operator'))
  WITH CHECK (current_user_has_role(organization_id, 'operator'));
CREATE POLICY "Workspace members can read work item approvals"
  ON work_item_approvals FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can request work item approval"
  ON work_item_approvals FOR INSERT
  WITH CHECK (current_user_has_role(organization_id, 'operator') AND requested_by = auth.uid());
CREATE POLICY "Workspace managers can decide work item approval"
  ON work_item_approvals FOR UPDATE
  USING (current_user_has_role(organization_id, 'manager'))
  WITH CHECK (current_user_has_role(organization_id, 'manager'));
CREATE POLICY "Workspace members can read work item attachments"
  ON work_item_attachments FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace operators can register work item attachments"
  ON work_item_attachments FOR INSERT
  WITH CHECK (current_user_has_role(organization_id, 'operator') AND uploaded_by = auth.uid());
CREATE POLICY "Workspace operators can remove work item attachments"
  ON work_item_attachments FOR DELETE USING (current_user_has_role(organization_id, 'operator'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-item-attachments',
  'work-item-attachments',
  false,
  4194304,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON TABLE
  work_item_comments,
  work_item_mentions,
  work_item_checklist_items,
  work_item_approvals,
  work_item_attachments
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  work_item_comments,
  work_item_mentions,
  work_item_checklist_items,
  work_item_approvals,
  work_item_attachments
TO service_role;
