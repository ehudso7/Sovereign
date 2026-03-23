-- Migration: 008_phase9_alerts
-- Phase 9: Alerting Engine
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Alert rules (org-scoped, defines conditions that trigger alerts)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  condition_type VARCHAR(50) NOT NULL, -- 'run_failed', 'run_stuck', 'browser_failed', 'connector_failed'
  threshold_minutes INTEGER, -- for stuck detection
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_org ON alert_rules(org_id);

-- RLS
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_rules_tenant_policy ON alert_rules
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;

-- Alert events (org-scoped, individual alert occurrences)
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES alert_rules(id),
  severity VARCHAR(50) NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  condition_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100) NOT NULL, -- 'run', 'browser_session', 'connector'
  resource_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'resolved'
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_events_org_status ON alert_events(org_id, status);
CREATE INDEX idx_alert_events_org_created ON alert_events(org_id, created_at);
CREATE INDEX idx_alert_events_org_condition ON alert_events(org_id, condition_type);

-- RLS
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_events_tenant_policy ON alert_events
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE alert_events FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS alert_events_tenant_policy ON alert_events;
-- ALTER TABLE alert_events DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS alert_events;
-- DROP POLICY IF EXISTS alert_rules_tenant_policy ON alert_rules;
-- ALTER TABLE alert_rules DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS alert_rules;
