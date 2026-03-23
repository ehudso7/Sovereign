-- Migration 004: Phase 5 — Run Engine tables
-- Up migration

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  project_id    uuid NOT NULL REFERENCES projects(id),
  agent_id      uuid NOT NULL REFERENCES agents(id),
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id),
  status        varchar(50) NOT NULL DEFAULT 'queued',
  trigger_type  varchar(50) NOT NULL DEFAULT 'manual',
  triggered_by  uuid REFERENCES users(id),
  execution_provider varchar(50) NOT NULL DEFAULT 'local',
  input         jsonb NOT NULL DEFAULT '{}',
  config_snapshot jsonb NOT NULL DEFAULT '{}',
  output        jsonb,
  error         jsonb,
  token_usage   jsonb,
  cost_cents    integer,
  attempt_count integer NOT NULL DEFAULT 1,
  temporal_workflow_id varchar(255),
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- run_steps
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  run_id        uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_number   integer NOT NULL,
  type          varchar(50) NOT NULL,
  status        varchar(50) NOT NULL DEFAULT 'pending',
  attempt       integer NOT NULL DEFAULT 1,
  tool_name     varchar(255),
  input         jsonb,
  output        jsonb,
  error         jsonb,
  token_usage   jsonb,
  provider_metadata jsonb,
  latency_ms    integer,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_runs_org_status ON runs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_org_agent ON runs(org_id, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_org_project ON runs(org_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_steps_run ON run_steps(run_id, step_number);
CREATE INDEX IF NOT EXISTS idx_run_steps_org ON run_steps(org_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;

CREATE POLICY runs_org_isolation ON runs
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_steps FORCE ROW LEVEL SECURITY;

CREATE POLICY run_steps_org_isolation ON run_steps
  USING (org_id = current_setting('app.current_org_id')::uuid);
