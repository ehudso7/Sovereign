-- Phase 10: Policy, Safety, Secrets, Audit
-- Tables: policies, policy_decisions, approvals, quarantine_records

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  policy_type VARCHAR(50) NOT NULL,       -- access_control, deny, require_approval, quarantine, budget_cap, content_filter
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, disabled, archived
  enforcement_mode VARCHAR(50) NOT NULL,  -- allow, deny, require_approval, quarantine
  scope_type VARCHAR(50) NOT NULL,        -- org, project, agent, connector, browser, memory, run
  scope_id UUID,                          -- null = applies to all of scope_type
  rules JSONB NOT NULL DEFAULT '[]',      -- array of rule conditions
  priority INTEGER NOT NULL DEFAULT 0,    -- higher = evaluated first
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_org ON policies(org_id);
CREATE INDEX idx_policies_org_status ON policies(org_id, status);
CREATE INDEX idx_policies_org_scope ON policies(org_id, scope_type, scope_id);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_tenant_policy ON policies
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE policies FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policy Decisions (evaluation log)
-- ---------------------------------------------------------------------------

CREATE TABLE policy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  subject_type VARCHAR(100) NOT NULL,     -- agent, run, connector, browser_session, memory
  subject_id UUID,
  action_type VARCHAR(100) NOT NULL,      -- run.create, connector.use, browser.risky_action, memory.redact, etc.
  result VARCHAR(50) NOT NULL,            -- allow, deny, require_approval, quarantined
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  requested_by UUID REFERENCES users(id),
  approval_id UUID,                       -- linked approval if require_approval
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_decisions_org ON policy_decisions(org_id);
CREATE INDEX idx_policy_decisions_org_subject ON policy_decisions(org_id, subject_type, subject_id);
CREATE INDEX idx_policy_decisions_org_result ON policy_decisions(org_id, result);

ALTER TABLE policy_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_decisions_tenant_policy ON policy_decisions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE policy_decisions FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_type VARCHAR(100) NOT NULL,     -- run, connector, browser_session, memory
  subject_id UUID,
  action_type VARCHAR(100) NOT NULL,      -- what action needs approval
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired, cancelled
  request_note TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  requested_by UUID NOT NULL REFERENCES users(id),
  decided_by UUID REFERENCES users(id),
  policy_decision_id UUID REFERENCES policy_decisions(id),
  expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_org ON approvals(org_id);
CREATE INDEX idx_approvals_org_status ON approvals(org_id, status);
CREATE INDEX idx_approvals_org_subject ON approvals(org_id, subject_type, subject_id);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approvals_tenant_policy ON approvals
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Quarantine Records
-- ---------------------------------------------------------------------------

CREATE TABLE quarantine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_type VARCHAR(100) NOT NULL,     -- agent, run
  subject_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, released
  policy_decision_id UUID REFERENCES policy_decisions(id),
  quarantined_by UUID NOT NULL REFERENCES users(id),
  released_by UUID REFERENCES users(id),
  released_at TIMESTAMPTZ,
  release_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quarantine_org ON quarantine_records(org_id);
CREATE INDEX idx_quarantine_org_status ON quarantine_records(org_id, status);
CREATE INDEX idx_quarantine_org_subject ON quarantine_records(org_id, subject_type, subject_id);

ALTER TABLE quarantine_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY quarantine_tenant_policy ON quarantine_records
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE quarantine_records FORCE ROW LEVEL SECURITY;

-- Add back-reference for policy_decisions.approval_id
ALTER TABLE policy_decisions ADD CONSTRAINT fk_policy_decisions_approval
  FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE SET NULL;

-- DOWN (commented for reversibility reference)
-- ALTER TABLE policy_decisions DROP CONSTRAINT IF EXISTS fk_policy_decisions_approval;
-- DROP POLICY IF EXISTS quarantine_tenant_policy ON quarantine_records;
-- ALTER TABLE quarantine_records DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS quarantine_records;
-- DROP POLICY IF EXISTS approvals_tenant_policy ON approvals;
-- ALTER TABLE approvals DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS approvals;
-- DROP POLICY IF EXISTS policy_decisions_tenant_policy ON policy_decisions;
-- ALTER TABLE policy_decisions DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS policy_decisions;
-- DROP POLICY IF EXISTS policies_tenant_policy ON policies;
-- ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS policies;
