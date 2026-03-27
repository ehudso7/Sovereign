-- Migration: 012_performance_optimization
-- Purpose: Performance indexes, monitoring tables, and maintenance functions
-- ============================================================================

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Users table: Optimize authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Organizations table: Optimize slug lookups and listing
CREATE INDEX IF NOT EXISTS idx_organizations_slug_lower ON organizations (lower(slug));
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations (created_at DESC);

-- Memberships table: Optimize permission checks
CREATE INDEX IF NOT EXISTS idx_memberships_user_org_accepted ON memberships (user_id, org_id) WHERE accepted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_org_role_accepted ON memberships (org_id, role) WHERE accepted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_created_at ON memberships (created_at DESC);

-- Sessions table: Optimize session validation
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions USING hash (token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions (user_id, expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup ON sessions (expires_at) WHERE expires_at < NOW();

-- Audit events: Optimize audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_events_org_action ON audit_events (org_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at_brin ON audit_events USING brin (created_at);

-- Runs table: Optimize workflow tracking
CREATE INDEX IF NOT EXISTS idx_runs_org_status ON runs (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_temporal_workflow ON runs (temporal_workflow_id) WHERE temporal_workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_active ON runs (org_id, started_at DESC) WHERE status IN ('running', 'paused');

-- Projects table: Optimize project queries
CREATE INDEX IF NOT EXISTS idx_projects_org_slug ON projects (org_id, slug);
CREATE INDEX IF NOT EXISTS idx_projects_org_created ON projects (org_id, created_at DESC);

-- Agents table: Optimize agent lookups
CREATE INDEX IF NOT EXISTS idx_agents_org_slug ON agents (org_id, slug);
CREATE INDEX IF NOT EXISTS idx_agents_org_status_new ON agents (org_id, status);

-- Browser sessions: Optimize active session queries
CREATE INDEX IF NOT EXISTS idx_browser_sessions_org_status ON browser_sessions (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_active ON browser_sessions (org_id, last_activity_at) WHERE status = 'connected';

-- ============================================================================
-- QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Enable query performance tracking (skip if extension not available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_stat_statements not available, skipping';
END $$;

-- Table for tracking slow queries
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  avg_duration_ms NUMERIC NOT NULL,
  max_duration_ms NUMERIC NOT NULL,
  call_count BIGINT NOT NULL,
  total_time_ms NUMERIC NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_hash, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_avg_duration ON performance_metrics (avg_duration_ms DESC, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_call_count ON performance_metrics (call_count DESC, captured_at DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Organization activity summary (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS org_activity_summary AS
SELECT
  o.id as org_id,
  o.slug,
  o.name,
  COUNT(DISTINCT m.user_id) as member_count,
  COUNT(DISTINCT p.id) as project_count,
  COUNT(DISTINCT a.id) as agent_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.created_at > NOW() - INTERVAL '30 days') as runs_last_30d,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed' AND r.created_at > NOW() - INTERVAL '30 days') as successful_runs_30d,
  MAX(r.created_at) as last_run_at,
  NOW() as refreshed_at
FROM organizations o
LEFT JOIN memberships m ON o.id = m.org_id AND m.accepted_at IS NOT NULL
LEFT JOIN projects p ON o.id = p.org_id
LEFT JOIN agents a ON o.id = a.org_id
LEFT JOIN runs r ON o.id = r.org_id
GROUP BY o.id, o.slug, o.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_activity_summary_org ON org_activity_summary (org_id);
CREATE INDEX IF NOT EXISTS idx_org_activity_summary_runs ON org_activity_summary (runs_last_30d DESC);

-- User activity summary (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_summary AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT m.org_id) as org_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.expires_at > NOW()) as active_sessions,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.created_at > NOW() - INTERVAL '7 days') as actions_last_7d,
  MAX(s.created_at) as last_login_at,
  NOW() as refreshed_at
FROM users u
LEFT JOIN memberships m ON u.id = m.user_id AND m.accepted_at IS NOT NULL
LEFT JOIN sessions s ON u.id = s.user_id
LEFT JOIN audit_events ae ON u.id = ae.actor_id
GROUP BY u.id, u.email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_summary_user ON user_activity_summary (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_summary_login ON user_activity_summary (last_login_at DESC NULLS LAST);

-- ============================================================================
-- AUTOMATIC MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to automatically clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
  DELETE FROM browser_sessions WHERE created_at < NOW() - INTERVAL '30 days' AND status != 'connected';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_activity_summaries() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY org_activity_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure email uniqueness is case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_lower ON users (lower(email));

-- Ensure org slugs are unique case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique_lower ON organizations (lower(slug));

-- Ensure one owner per org minimum
CREATE OR REPLACE FUNCTION ensure_org_has_owner() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'org_owner' AND NEW.role != 'org_owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE org_id = NEW.org_id
      AND role = 'org_owner'
      AND user_id != NEW.user_id
      AND accepted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Organization must have at least one owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_org_owner_exists'
  ) THEN
    CREATE TRIGGER ensure_org_owner_exists
      BEFORE UPDATE ON memberships
      FOR EACH ROW
      EXECUTE FUNCTION ensure_org_has_owner();
  END IF;
END $$;

-- ============================================================================
-- MONITORING TABLES
-- ============================================================================

-- Health check table for monitoring
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms NUMERIC,
  details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks (service_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_unhealthy ON health_checks (status, checked_at DESC) WHERE status != 'healthy';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts with secure password storage';
COMMENT ON TABLE organizations IS 'Multi-tenant organizations with complete isolation';
COMMENT ON TABLE memberships IS 'Organization membership with RBAC roles';
COMMENT ON TABLE sessions IS 'User authentication sessions with automatic expiry';
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for compliance';
COMMENT ON TABLE runs IS 'Workflow execution tracking with Temporal integration';
COMMENT ON TABLE agents IS 'AI agents with versioning and deployment tracking';
COMMENT ON TABLE projects IS 'Organizational projects for grouping resources';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP INDEX IF EXISTS idx_users_email_lower;
-- DROP INDEX IF EXISTS idx_users_created_at;
-- DROP INDEX IF EXISTS idx_organizations_slug_lower;
-- DROP INDEX IF EXISTS idx_organizations_created_at;
-- DROP INDEX IF EXISTS idx_memberships_user_org_accepted;
-- DROP INDEX IF EXISTS idx_memberships_org_role_accepted;
-- DROP INDEX IF EXISTS idx_memberships_created_at;
-- DROP INDEX IF EXISTS idx_sessions_token_hash;
-- DROP INDEX IF EXISTS idx_sessions_user_active;
-- DROP INDEX IF EXISTS idx_sessions_cleanup;
-- DROP INDEX IF EXISTS idx_audit_events_org_action;
-- DROP INDEX IF EXISTS idx_audit_events_actor_created;
-- DROP INDEX IF EXISTS idx_audit_events_resource;
-- DROP INDEX IF EXISTS idx_audit_events_created_at_brin;
-- DROP INDEX IF EXISTS idx_runs_org_status;
-- DROP INDEX IF EXISTS idx_runs_temporal_workflow;
-- DROP INDEX IF EXISTS idx_runs_active;
-- DROP INDEX IF EXISTS idx_projects_org_slug;
-- DROP INDEX IF EXISTS idx_projects_org_created;
-- DROP INDEX IF EXISTS idx_agents_org_slug;
-- DROP INDEX IF EXISTS idx_agents_org_status_new;
-- DROP INDEX IF EXISTS idx_browser_sessions_org_status;
-- DROP INDEX IF EXISTS idx_browser_sessions_active;
-- DROP TABLE IF EXISTS performance_metrics;
-- DROP MATERIALIZED VIEW IF EXISTS org_activity_summary;
-- DROP MATERIALIZED VIEW IF EXISTS user_activity_summary;
-- DROP TABLE IF EXISTS health_checks;
-- DROP FUNCTION IF EXISTS cleanup_expired_sessions();
-- DROP FUNCTION IF EXISTS refresh_activity_summaries();
-- DROP FUNCTION IF EXISTS ensure_org_has_owner();
-- DROP TRIGGER IF EXISTS ensure_org_owner_exists ON memberships;
