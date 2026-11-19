CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'work_item_created', 'work_item_status_changed', 'lead_received', 'opportunity_stage_changed')),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conditions) = 'array'),
  actions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(actions) = 'array'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX workflow_templates_name_per_org_idx ON workflow_templates (organization_id, lower(name));
CREATE INDEX workflow_templates_trigger_idx ON workflow_templates (organization_id, trigger_type, status);
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE workflow_template_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_entity_id UUID,
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'executed', 'skipped', 'failed')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_note TEXT NOT NULL DEFAULT '',
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (template_id, organization_id)
    REFERENCES workflow_templates(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX workflow_template_runs_queue_idx ON workflow_template_runs (organization_id, status, created_at DESC);
CREATE INDEX workflow_template_runs_template_idx ON workflow_template_runs (organization_id, template_id, created_at DESC);
CREATE TRIGGER update_workflow_template_runs_updated_at BEFORE UPDATE ON workflow_template_runs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE work_items ADD COLUMN source_workflow_run_id UUID UNIQUE REFERENCES workflow_template_runs(id) ON DELETE SET NULL;
GRANT SELECT ON TABLE workflow_templates, workflow_template_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workflow_templates, workflow_template_runs TO service_role;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can read workflow templates"
  ON workflow_templates FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace members can read workflow runs"
  ON workflow_template_runs FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
