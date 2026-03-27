-- Migration: 002_row_level_security
-- Phase 3: Row-level security policies for tenant isolation defense-in-depth
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Enable RLS on org-scoped tables
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies use the session variable app.current_org_id
-- This variable is set by the application via SET LOCAL in transactions

-- Memberships: only visible within the current org context
CREATE POLICY memberships_tenant_policy ON memberships
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Invitations: only visible within the current org context
CREATE POLICY invitations_tenant_policy ON invitations
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Projects: only visible within the current org context
CREATE POLICY projects_tenant_policy ON projects
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit events: only visible within the current org context
CREATE POLICY audit_events_tenant_policy ON audit_events
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Sessions: only visible within the current org context
CREATE POLICY sessions_tenant_policy ON sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- IMPORTANT: RLS is enforced for non-superuser roles.
-- The application connection role must NOT be a superuser.
-- RLS policies are bypassed for table owners by default.
-- We do NOT use FORCE ROW LEVEL SECURITY to allow admin operations
-- and test setup. The application should always set app.current_org_id
-- in production transactions for proper isolation.

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS memberships_tenant_policy ON memberships;
-- DROP POLICY IF EXISTS invitations_tenant_policy ON invitations;
-- DROP POLICY IF EXISTS projects_tenant_policy ON projects;
-- DROP POLICY IF EXISTS audit_events_tenant_policy ON audit_events;
-- DROP POLICY IF EXISTS sessions_tenant_policy ON sessions;
-- ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
