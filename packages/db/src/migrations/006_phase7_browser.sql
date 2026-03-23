-- Migration: 006_phase7_browser
-- Phase 7: Browser + Computer Action Plane
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Browser sessions (org-scoped, linked to runs)
CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  browser_type VARCHAR(50) NOT NULL DEFAULT 'chromium',
  current_url TEXT,
  human_takeover BOOLEAN NOT NULL DEFAULT FALSE,
  takeover_by UUID REFERENCES users(id),
  session_ref TEXT,
  artifact_keys JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_browser_sessions_org ON browser_sessions(org_id);
CREATE INDEX idx_browser_sessions_org_run ON browser_sessions(org_id, run_id);
CREATE INDEX idx_browser_sessions_status ON browser_sessions(status);
CREATE INDEX idx_browser_sessions_org_status ON browser_sessions(org_id, status);

-- RLS
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY browser_sessions_tenant_policy ON browser_sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE browser_sessions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS browser_sessions_tenant_policy ON browser_sessions;
-- ALTER TABLE browser_sessions DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS browser_sessions;
