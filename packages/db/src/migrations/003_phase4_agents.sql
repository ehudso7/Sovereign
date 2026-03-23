-- Migration: 003_phase4_agents
-- Phase 4: Agent Studio — agents and agent versions
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(63) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE INDEX idx_agents_org_id ON agents(org_id);
CREATE INDEX idx_agents_project_id ON agents(project_id);
CREATE INDEX idx_agents_org_status ON agents(org_id, status);
CREATE INDEX idx_agents_project_slug ON agents(project_id, slug);

-- Agent versions
CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]',
  instructions TEXT NOT NULL DEFAULT '',
  tools JSONB NOT NULL DEFAULT '[]',
  budget JSONB,
  approval_rules JSONB NOT NULL DEFAULT '[]',
  memory_config JSONB,
  schedule JSONB,
  model_config JSONB NOT NULL DEFAULT '{"provider":"openai","model":"gpt-4o"}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);

CREATE INDEX idx_agent_versions_org_id ON agent_versions(org_id);
CREATE INDEX idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX idx_agent_versions_agent_version ON agent_versions(agent_id, version);
CREATE INDEX idx_agent_versions_published ON agent_versions(agent_id, published) WHERE published = true;

-- Row-level security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_tenant_policy ON agents
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY agent_versions_tenant_policy ON agent_versions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE agents FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_versions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS agent_versions_tenant_policy ON agent_versions;
-- DROP POLICY IF EXISTS agents_tenant_policy ON agents;
-- ALTER TABLE agent_versions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS agent_versions;
-- DROP TABLE IF EXISTS agents;
