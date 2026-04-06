-- Migration: 015_phase15_terminal
-- Phase 15: Mobile Terminal Sessions
-- Reversible: YES

-- ============================================================================
-- UP
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Terminal Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE terminal_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  project_id   UUID REFERENCES projects(id),
  status       TEXT NOT NULL DEFAULT 'provisioning'
                 CHECK (status IN ('provisioning', 'active', 'idle', 'closed', 'failed')),
  container_id TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY terminal_sessions_org_isolation ON terminal_sessions
  USING (org_id = current_setting('app.current_org_id')::UUID);

-- Indexes
CREATE INDEX idx_terminal_sessions_org ON terminal_sessions(org_id);
CREATE INDEX idx_terminal_sessions_user ON terminal_sessions(user_id);
CREATE INDEX idx_terminal_sessions_status ON terminal_sessions(status);
CREATE INDEX idx_terminal_sessions_last_active ON terminal_sessions(last_active);

-- ---------------------------------------------------------------------------
-- Agent Chat Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE agent_chat_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  provider     TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'deepseek', 'custom')),
  model        TEXT NOT NULL,
  terminal_session_id UUID REFERENCES terminal_sessions(id),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'closed')),
  message_count INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE agent_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY agent_chat_sessions_org_isolation ON agent_chat_sessions
  USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE INDEX idx_agent_chat_sessions_org ON agent_chat_sessions(org_id);
CREATE INDEX idx_agent_chat_sessions_user ON agent_chat_sessions(user_id);
CREATE INDEX idx_agent_chat_sessions_terminal ON agent_chat_sessions(terminal_session_id);

-- ---------------------------------------------------------------------------
-- Agent Chat Messages
-- ---------------------------------------------------------------------------
CREATE TABLE agent_chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id),
  chat_session_id UUID NOT NULL REFERENCES agent_chat_sessions(id),
  role           TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content        TEXT NOT NULL,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  latency_ms     INTEGER,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE agent_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY agent_chat_messages_org_isolation ON agent_chat_messages
  USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE INDEX idx_agent_chat_messages_session ON agent_chat_messages(chat_session_id);
CREATE INDEX idx_agent_chat_messages_org ON agent_chat_messages(org_id);
CREATE INDEX idx_agent_chat_messages_created ON agent_chat_messages(created_at);

-- ============================================================================
-- DOWN
-- ============================================================================

-- DROP TABLE agent_chat_messages;
-- DROP TABLE agent_chat_sessions;
-- DROP TABLE terminal_sessions;
