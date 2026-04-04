-- Migration: 014_cross_org_lookup_indexes
-- Purpose: eliminate O(total_orgs) scans for auth/session/invitation lookups
-- while preserving FORCE RLS on tenant-scoped source tables.

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_lookup (
  id UUID PRIMARY KEY REFERENCES memberships(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  invited_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_lookup_org_user
  ON membership_lookup (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_membership_lookup_user_created
  ON membership_lookup (user_id, created_at);

CREATE TABLE IF NOT EXISTS invitation_lookup (
  id UUID PRIMARY KEY REFERENCES invitations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitation_lookup_org_id
  ON invitation_lookup (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_lookup_email_pending
  ON invitation_lookup (email_normalized, created_at ASC)
  WHERE accepted_at IS NULL;

CREATE TABLE IF NOT EXISTS session_lookup (
  id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_lookup_user_created
  ON session_lookup (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_lookup_org_id
  ON session_lookup (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_lookup_expires
  ON session_lookup (expires_at);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_membership_lookup() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM membership_lookup WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO membership_lookup (id, org_id, user_id, role, invited_by, accepted_at, created_at)
  VALUES (NEW.id, NEW.org_id, NEW.user_id, NEW.role, NEW.invited_by, NEW.accepted_at, NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    accepted_at = EXCLUDED.accepted_at,
    created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_invitation_lookup() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM invitation_lookup WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO invitation_lookup (
    id,
    org_id,
    email_normalized,
    email,
    role,
    invited_by,
    expires_at,
    accepted_at,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.org_id,
    lower(NEW.email),
    NEW.email,
    NEW.role,
    NEW.invited_by,
    NEW.expires_at,
    NEW.accepted_at,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    email_normalized = EXCLUDED.email_normalized,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at,
    accepted_at = EXCLUDED.accepted_at,
    created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_session_lookup() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM session_lookup WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO session_lookup (id, org_id, user_id, token_hash, expires_at, created_at)
  VALUES (NEW.id, NEW.org_id, NEW.user_id, NEW.token_hash, NEW.expires_at, NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    user_id = EXCLUDED.user_id,
    token_hash = EXCLUDED.token_hash,
    expires_at = EXCLUDED.expires_at,
    created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'memberships_sync_lookup'
  ) THEN
    CREATE TRIGGER memberships_sync_lookup
      AFTER INSERT OR UPDATE OR DELETE ON memberships
      FOR EACH ROW
      EXECUTE FUNCTION sync_membership_lookup();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'invitations_sync_lookup'
  ) THEN
    CREATE TRIGGER invitations_sync_lookup
      AFTER INSERT OR UPDATE OR DELETE ON invitations
      FOR EACH ROW
      EXECUTE FUNCTION sync_invitation_lookup();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sessions_sync_lookup'
  ) THEN
    CREATE TRIGGER sessions_sync_lookup
      AFTER INSERT OR UPDATE OR DELETE ON sessions
      FOR EACH ROW
      EXECUTE FUNCTION sync_session_lookup();
  END IF;
END $$;

-- ============================================================================
-- BACKFILL
-- ============================================================================

INSERT INTO membership_lookup (id, org_id, user_id, role, invited_by, accepted_at, created_at)
SELECT id, org_id, user_id, role, invited_by, accepted_at, created_at
FROM memberships
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  user_id = EXCLUDED.user_id,
  role = EXCLUDED.role,
  invited_by = EXCLUDED.invited_by,
  accepted_at = EXCLUDED.accepted_at,
  created_at = EXCLUDED.created_at;

INSERT INTO invitation_lookup (
  id,
  org_id,
  email_normalized,
  email,
  role,
  invited_by,
  expires_at,
  accepted_at,
  created_at
)
SELECT
  id,
  org_id,
  lower(email),
  email,
  role,
  invited_by,
  expires_at,
  accepted_at,
  created_at
FROM invitations
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  email_normalized = EXCLUDED.email_normalized,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  invited_by = EXCLUDED.invited_by,
  expires_at = EXCLUDED.expires_at,
  accepted_at = EXCLUDED.accepted_at,
  created_at = EXCLUDED.created_at;

INSERT INTO session_lookup (id, org_id, user_id, token_hash, expires_at, created_at)
SELECT id, org_id, user_id, token_hash, expires_at, created_at
FROM sessions
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  user_id = EXCLUDED.user_id,
  token_hash = EXCLUDED.token_hash,
  expires_at = EXCLUDED.expires_at,
  created_at = EXCLUDED.created_at;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TRIGGER IF EXISTS memberships_sync_lookup ON memberships;
-- DROP TRIGGER IF EXISTS invitations_sync_lookup ON invitations;
-- DROP TRIGGER IF EXISTS sessions_sync_lookup ON sessions;
-- DROP FUNCTION IF EXISTS sync_membership_lookup();
-- DROP FUNCTION IF EXISTS sync_invitation_lookup();
-- DROP FUNCTION IF EXISTS sync_session_lookup();
-- DROP TABLE IF EXISTS membership_lookup;
-- DROP TABLE IF EXISTS invitation_lookup;
-- DROP TABLE IF EXISTS session_lookup;
