-- Migration: 005_phase6_connectors
-- Phase 6: Tooling and Connector Hub
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Connector catalog (global registry, not org-scoped)
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(63) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'custom',
  trust_tier VARCHAR(50) NOT NULL DEFAULT 'untrusted',
  auth_mode VARCHAR(50) NOT NULL DEFAULT 'none',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  tools JSONB NOT NULL DEFAULT '[]',
  scopes JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectors_slug ON connectors(slug);
CREATE INDEX idx_connectors_category ON connectors(category);
CREATE INDEX idx_connectors_trust_tier ON connectors(trust_tier);

-- Connector installs (org-scoped installations)
CREATE TABLE IF NOT EXISTS connector_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  connector_slug VARCHAR(63) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  granted_scopes JSONB NOT NULL DEFAULT '[]',
  installed_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, connector_id)
);

CREATE INDEX idx_connector_installs_org_id ON connector_installs(org_id);
CREATE INDEX idx_connector_installs_connector_id ON connector_installs(connector_id);
CREATE INDEX idx_connector_installs_org_enabled ON connector_installs(org_id, enabled);

-- Connector credentials (org-scoped, encrypted)
CREATE TABLE IF NOT EXISTS connector_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_install_id UUID NOT NULL REFERENCES connector_installs(id) ON DELETE CASCADE,
  credential_type VARCHAR(50) NOT NULL,
  encrypted_data TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connector_install_id)
);

CREATE INDEX idx_connector_credentials_org_id ON connector_credentials(org_id);
CREATE INDEX idx_connector_credentials_install ON connector_credentials(connector_install_id);

-- Skills catalog (global registry)
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(63) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trust_tier VARCHAR(50) NOT NULL DEFAULT 'untrusted',
  connector_slugs JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_slug ON skills(slug);
CREATE INDEX idx_skills_trust_tier ON skills(trust_tier);

-- Skill installs (org-scoped installations)
CREATE TABLE IF NOT EXISTS skill_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_slug VARCHAR(63) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  installed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, skill_id)
);

CREATE INDEX idx_skill_installs_org_id ON skill_installs(org_id);
CREATE INDEX idx_skill_installs_skill_id ON skill_installs(skill_id);
CREATE INDEX idx_skill_installs_org_enabled ON skill_installs(org_id, enabled);

-- RLS for org-scoped tables
ALTER TABLE connector_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY connector_installs_tenant_policy ON connector_installs
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY connector_credentials_tenant_policy ON connector_credentials
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY skill_installs_tenant_policy ON skill_installs
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE connector_installs FORCE ROW LEVEL SECURITY;
ALTER TABLE connector_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE skill_installs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS skill_installs_tenant_policy ON skill_installs;
-- DROP POLICY IF EXISTS connector_credentials_tenant_policy ON connector_credentials;
-- DROP POLICY IF EXISTS connector_installs_tenant_policy ON connector_installs;
-- ALTER TABLE skill_installs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE connector_credentials DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE connector_installs DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS skill_installs;
-- DROP TABLE IF EXISTS skills;
-- DROP TABLE IF EXISTS connector_credentials;
-- DROP TABLE IF EXISTS connector_installs;
-- DROP TABLE IF EXISTS connectors;
