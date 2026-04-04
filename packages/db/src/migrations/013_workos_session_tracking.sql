-- Migration: 013_workos_session_tracking
-- Add optional provider session tracking for hosted auth providers

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS provider_session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sessions_provider_session_id
  ON sessions (provider_session_id)
  WHERE provider_session_id IS NOT NULL;
