-- Migration: 011_phase12_billing
-- Phase 12: Billing and Usage (billing_accounts, usage_events, invoices, spend_alerts)
-- Reversible: YES

-- ============================================================================
-- UP
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Billing Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  billing_email VARCHAR(255),
  payment_provider VARCHAR(50) DEFAULT 'local',
  provider_customer_id VARCHAR(255),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  trial_ends_at TIMESTAMPTZ,
  spend_limit_cents BIGINT,
  overage_allowed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_accounts_org_id ON billing_accounts(org_id);
CREATE INDEX idx_billing_accounts_status ON billing_accounts(status);

-- ---------------------------------------------------------------------------
-- Usage Events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  meter VARCHAR(100) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit VARCHAR(50) NOT NULL,
  source_type VARCHAR(50),
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX idx_usage_events_org_period ON usage_events(org_id, occurred_at);
CREATE INDEX idx_usage_events_meter ON usage_events(org_id, meter);
CREATE INDEX idx_usage_events_source ON usage_events(org_id, source_type, source_id);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  provider_invoice_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  overage_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  line_items JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org_id ON invoices(org_id);
CREATE INDEX idx_invoices_billing_account ON invoices(billing_account_id);
CREATE INDEX idx_invoices_period ON invoices(org_id, period_start, period_end);
CREATE INDEX idx_invoices_status ON invoices(org_id, status);

-- ---------------------------------------------------------------------------
-- Spend Alerts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spend_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  threshold_cents BIGINT NOT NULL,
  current_spend_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  triggered_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spend_alerts_org_id ON spend_alerts(org_id);
CREATE INDEX idx_spend_alerts_status ON spend_alerts(org_id, status);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_accounts_tenant_isolation ON billing_accounts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_events_tenant_isolation ON usage_events
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE spend_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY spend_alerts_tenant_isolation ON spend_alerts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================================
-- DOWN
-- ============================================================================

-- DROP POLICY spend_alerts_tenant_isolation ON spend_alerts;
-- DROP POLICY invoices_tenant_isolation ON invoices;
-- DROP POLICY usage_events_tenant_isolation ON usage_events;
-- DROP POLICY billing_accounts_tenant_isolation ON billing_accounts;
-- DROP TABLE IF EXISTS spend_alerts CASCADE;
-- DROP TABLE IF EXISTS invoices CASCADE;
-- DROP TABLE IF EXISTS usage_events CASCADE;
-- DROP TABLE IF EXISTS billing_accounts CASCADE;
