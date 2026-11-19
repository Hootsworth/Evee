CREATE TABLE integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  total_count INTEGER NOT NULL DEFAULT 0,
  synced_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  finished_at TIMESTAMPTZ
);
CREATE INDEX integration_sync_runs_org_idx ON integration_sync_runs (organization_id, provider_id, started_at DESC);

CREATE TABLE integration_field_mappings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  mappings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(mappings) = 'object'),
  sync_direction TEXT NOT NULL DEFAULT 'push' CHECK (sync_direction IN ('push', 'pull', 'bidirectional')),
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (organization_id, provider_id)
);
CREATE TRIGGER update_integration_field_mappings_updated_at BEFORE UPDATE ON integration_field_mappings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(scopes) = 'array'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX workspace_api_keys_org_idx ON workspace_api_keys (organization_id, created_at DESC);

CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  endpoint_url TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX webhook_subscriptions_org_idx ON webhook_subscriptions (organization_id, status);
CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX webhook_deliveries_org_idx ON webhook_deliveries (organization_id, created_at DESC);
CREATE INDEX webhook_deliveries_subscription_idx ON webhook_deliveries (subscription_id, status, created_at DESC);

ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read integration sync history"
  ON integration_sync_runs FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Workspace members can read integration field mappings"
  ON integration_field_mappings FOR SELECT USING (current_user_has_role(organization_id, 'viewer'));
CREATE POLICY "Managers can read workspace API keys"
  ON workspace_api_keys FOR SELECT USING (current_user_has_role(organization_id, 'manager'));
CREATE POLICY "Managers can read webhook subscriptions"
  ON webhook_subscriptions FOR SELECT USING (current_user_has_role(organization_id, 'manager'));
CREATE POLICY "Managers can read webhook deliveries"
  ON webhook_deliveries FOR SELECT USING (current_user_has_role(organization_id, 'manager'));

GRANT SELECT ON TABLE integration_sync_runs, integration_field_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_sync_runs, integration_field_mappings, workspace_api_keys, webhook_subscriptions, webhook_deliveries TO service_role;
GRANT SELECT ON TABLE workspace_api_keys, webhook_subscriptions, webhook_deliveries TO authenticated;
