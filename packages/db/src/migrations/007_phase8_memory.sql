-- Migration: 007_phase8_memory
-- Phase 8: Memory Engine
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Memories (org-scoped, flat model combining container + entry)
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL,
  scope_id UUID NOT NULL,
  kind VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  source_run_id UUID REFERENCES runs(id),
  source_agent_id UUID REFERENCES agents(id),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  redacted_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memories_org ON memories(org_id);
CREATE INDEX idx_memories_org_scope ON memories(org_id, scope_type, scope_id);
CREATE INDEX idx_memories_org_kind ON memories(org_id, kind);
CREATE INDEX idx_memories_org_status ON memories(org_id, status);
CREATE INDEX idx_memories_content_hash ON memories(org_id, content_hash);
CREATE INDEX idx_memories_source_run ON memories(source_run_id) WHERE source_run_id IS NOT NULL;

-- RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY memories_tenant_policy ON memories
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE memories FORCE ROW LEVEL SECURITY;

-- Memory links (org-scoped, linking memories to external entities)
CREATE TABLE IF NOT EXISTS memory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  linked_entity_type VARCHAR(100) NOT NULL,
  linked_entity_id UUID NOT NULL,
  link_type VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_links_org ON memory_links(org_id);
CREATE INDEX idx_memory_links_memory ON memory_links(memory_id);
CREATE INDEX idx_memory_links_entity ON memory_links(linked_entity_type, linked_entity_id);

-- RLS
ALTER TABLE memory_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_links_tenant_policy ON memory_links
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE memory_links FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS memory_links_tenant_policy ON memory_links;
-- ALTER TABLE memory_links DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS memory_links;
-- DROP POLICY IF EXISTS memories_tenant_policy ON memories;
-- ALTER TABLE memories DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS memories;
