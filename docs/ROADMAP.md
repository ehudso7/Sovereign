# SOVEREIGN — Roadmap

## Execution Order (Locked)

Phases execute in strict order. No feature jumping. No shiny-object detours.

---

## Phase 0 — Control Documents and Repo Law ✅

**Goal**: Create the guardrails before writing product code.

**Deliverables**:
- [x] PRD.md
- [x] ROADMAP.md (this file)
- [x] ARCHITECTURE.md
- [x] CLAUDE.md
- [x] AGENTS.md
- [x] TASKS.md
- [x] DB_SCHEMA.md
- [x] API_SPEC.md
- [x] SECURITY.md
- [x] TEST_STRATEGY.md
- [x] RUNBOOKS/
- [x] ADR/0001-system-architecture.md

**Exit Gate**:
- [x] Every phase below is represented in this file
- [x] Every module has acceptance criteria
- [x] Claude Code instructions are pinned in CLAUDE.md
- [x] Change-control rules documented

---

## Phase 1 — Monorepo Foundation ✅

**Goal**: Create the real product skeleton.

**Deliverables**:
- [x] apps/web — Next.js app with App Router
- [x] apps/api — API server
- [x] apps/worker-orchestrator — Temporal worker stub
- [x] apps/worker-browser — Browser worker stub
- [x] apps/gateway-mcp — MCP gateway stub
- [x] apps/docs — Documentation site stub
- [x] packages/ui — Design system shell
- [x] packages/config — Shared configs
- [x] packages/db — Database package with migration framework
- [x] packages/core — Shared types and utilities
- [x] packages/agents — Agent logic package
- [x] packages/connectors — Connector package
- [x] packages/policies — Policy package
- [x] packages/observability — Observability package
- [x] packages/billing — Billing package
- [x] packages/crm — CRM package
- [x] packages/testing — Test utilities
- [x] infra/ — Docker, Terraform, scripts
- [x] CI/CD workflows
- [x] pnpm workspace config
- [x] Turborepo config
- [x] Environment validation

**Exit Gate**:
- [x] Local dev boots cleanly
- [x] CI runs lint, types, unit tests, integration tests
- [x] Preview deploy works (config ready)
- [x] Env validation is enforced

---

## Phase 2 — Identity, Orgs, Tenancy ✅

**Status**: Complete

**Goal**: Make it multi-tenant and safe.

**Build**:
- [x] Organizations CRUD
- [x] Memberships and invitations
- [x] Roles and permissions
- [x] Project workspaces
- [x] WorkOS SSO/SCIM/RBAC/FGA integration (provider abstraction ready, local dev mode implemented)
- [x] Session management
- [x] Org-scoped audit stubs

**Exit Gate**:
- [x] Org isolation tested
- [x] Invite flow works
- [x] Role checks enforced in API and UI
- [x] Audit events emitted for auth-sensitive actions

---

## Phase 3 — Data Layer and Storage ✅

**Status**: Complete

**Goal**: Create the durable system of record.

**Build**:
- [x] Real PostgreSQL client with connection pooling (pg driver)
- [x] TenantDb / UnscopedDb interfaces for tenant-scoped and cross-org queries
- [x] Repository interfaces and PostgreSQL implementations for Phase 2 entities
- [x] Migration runner with schema_migrations tracking
- [x] Row-Level Security policies for org-scoped tables
- [x] Services swapped from in-memory to repository-backed
- [x] In-memory store removed from active code path

**Exit Gate**:
- [x] Migrations are reversible
- [x] Tenant scoping proven in tests
- [x] Local environment works with PostgreSQL via Docker Compose
- [x] Storage foundations in place (DB client, repo pattern, migration runner)

---

## Phase 4 — Agent Studio

**Status**: Complete

**Goal**: Users can define agents, not just view runs.

**Build**:
- [ ] Create/edit agent
- [ ] Goals and instructions
- [ ] Tool selection
- [ ] Budget caps
- [ ] Approval rules
- [ ] Memory modes
- [ ] Schedules
- [ ] Versioning and publish/unpublish

**Exit Gate**:
- [ ] Agent CRUD works
- [ ] Agent version history visible
- [ ] Validation prevents invalid configs
- [ ] Published agent can be executed

---

## Phase 5 — Orchestrator and Run Engine

**Status**: Complete

**Goal**: Durable, resumable execution.

**Build**:
- [ ] Temporal workflows
- [ ] Run state machine
- [ ] Retries and cancellation
- [ ] Pause/resume
- [ ] Compensation hooks
- [ ] Queued/background execution
- [ ] Webhook events

**Exit Gate**:
- [ ] Runs survive worker restart
- [ ] Pause/resume works
- [ ] Cancellation works
- [ ] Every run has durable state history

---

## Phase 6 — Tooling and Connector Hub

**Status**: Complete

**Goal**: One registry for all tools.

**Build**:
- [ ] MCP server registry
- [ ] Connector catalog
- [ ] Auth setup flows
- [ ] Scope viewer
- [ ] Trust tier labels (verified/internal/untrusted)
- [ ] Skill install/uninstall
- [ ] Tool search-ready metadata

**Exit Gate**:
- [ ] Install connector
- [ ] Test connector
- [ ] Revoke connector
- [ ] Use connector inside a real run
- [ ] Audit connector access

---

## Phase 7 — Browser + Computer Action Plane

**Status**: Not started

**Goal**: Agents can do real UI work.

**Build**:
- [ ] Playwright browser pool
- [ ] Session video/screenshots
- [ ] DOM-first actions
- [ ] Screenshot fallback
- [ ] Downloads/uploads
- [ ] Session lockers
- [ ] Live takeover UI
- [ ] Secure secrets injection

**Exit Gate**:
- [ ] Browser jobs run reliably
- [ ] Artifact capture works
- [ ] Human takeover works
- [ ] Risky browser actions are policy-gated

---

## Phase 8 — Memory Engine

**Status**: Not started

**Goal**: Agents remember usefully, not chaotically.

**Memory Lanes**: semantic, episodic, procedural

**Build**:
- [ ] Write pipeline
- [ ] Deduplication
- [ ] Summarization
- [ ] Relevance scoring
- [ ] Expiration
- [ ] Review and redaction UI
- [ ] Org/project/agent/user scopes

**Exit Gate**:
- [ ] Memory reads improve follow-up runs
- [ ] Memory writes are attributable
- [ ] Admin can review and delete memory
- [ ] Cross-tenant leakage impossible in tests

---

## Phase 9 — Observability and Mission Control ✅

**Status**: Complete

**Goal**: No black-box agent theater.

**Build**:
- [ ] Run trace view
- [ ] Step replay
- [ ] Token and cost breakdown
- [ ] Per-tool latency
- [ ] Queue depth
- [ ] Browser session timeline
- [ ] Alerting
- [ ] Dashboards

**Exit Gate**:
- [ ] Every run traceable
- [ ] Every failure classifiable
- [ ] Costs attributable by org/project/agent
- [ ] Alerting works for failed and stalled runs

---

## Phase 10 — Policy, Safety, Secrets, Audit ✅

**Status**: Complete

**Goal**: Enterprise-safe behavior.

**Build**:
- [ ] OPA decision layer
- [ ] Approval policies
- [ ] Secret broker
- [ ] Delegated tokens
- [ ] Policy test suite
- [ ] Audit ledger
- [ ] Quarantine mode
- [ ] Allow/deny tool rules
- [ ] Destructive action gates

**Exit Gate**:
- [ ] Deny rules enforce correctly
- [ ] Secret values never land in logs/prompts unsafely
- [ ] Audit trail is complete
- [ ] Approval-required actions cannot bypass policy

---

## Phase 11 — Revenue Workspace ✅

**Status**: Complete

**Goal**: Absorb the sales/GTM agent tools into the platform.

**Build**:
- [ ] Accounts
- [ ] Contacts
- [ ] Deal pipeline
- [ ] Tasks
- [ ] Meeting notes
- [ ] Outreach drafts
- [ ] CRM sync adapters
- [ ] Human approval before sends

**Exit Gate**:
- [ ] Create and manage accounts/contacts/deals
- [ ] AI draft flow works
- [ ] CRM sync works for at least one external system
- [ ] Approval gate blocks unauthorized outbound actions

---

## Phase 12 — Billing and Usage ✅

**Status**: Complete

**Goal**: Real customers can pay and you can meter usage.

**Build**:
- [ ] Org plans
- [ ] Metering
- [ ] Usage aggregation
- [ ] Invoice previews
- [ ] Payment provider integration
- [ ] Overage rules
- [ ] Spend alerts

**Exit Gate**:
- [ ] Usage recorded accurately
- [ ] Billing dashboard works
- [ ] Plan enforcement works
- [ ] Failed payment handling exists

---

## Phase 13 — Docs, Support, Onboarding, Admin ✅

**Status**: Complete

**Goal**: Product is usable by someone who is not you.

**Build**:
- [ ] Onboarding wizard
- [ ] Docs site
- [ ] Support panel
- [ ] Admin console
- [ ] Status page hooks
- [ ] Runbooks

**Exit Gate**:
- [ ] New org can onboard without engineer assistance
- [ ] Docs cover install, auth, agents, tools, memory, policies, billing
- [ ] Admin can diagnose tenant issues safely

---

## Phase 14 — Release Hardening ✅

**Status**: Complete

**Goal**: Launch-ready, not demo-ready.

**Build**:
- [x] Full E2E suite
- [x] Load tests
- [x] Chaos tests on orchestrator/workers
- [x] Security review
- [x] Backup/restore test
- [x] Incident drills
- [x] Deploy/rollback drill
- [x] Production SLOs

**Validation**:
- [x] Local PostgreSQL-backed integration suite green
- [x] Local API E2E/load/resilience suites green
- [x] Local runtime stack validated: API health, web/docs startup, MinIO, Temporal, workers, MCP gateway
- [x] Local object-storage path validated: browser-session artifact upload, list, download

**Exit Gate**:
- [x] Green CI
- [x] Rollback proven
- [x] Backups restore
- [x] Launch checklist complete
- [x] 932 tests (649 unit + 240 integration + 43 E2E)

---

## Phase 15 — Mobile Terminal with Multi-Provider AI Agent Access ✅

**Status**: Complete

**ADR**: docs/ADR/0002-mobile-terminal-multi-agent.md

**Goal**: Mobile-first terminal experience with multi-provider AI agent routing. Enable developers to execute commands, monitor CI, triage issues, and interact with AI coding agents from any device.

**Build**:
- [x] Multi-provider execution providers (Anthropic Claude, Google Gemini, DeepSeek + existing OpenAI)
- [x] xterm.js terminal emulator component and touch-optimized command palette (packages/ui)
- [x] Terminal proxy service with WebSocket-to-PTY bridge (apps/terminal-proxy)
- [x] PTY bridge with command execution, sanitization, and working directory tracking
- [x] Session manager with reconnection support, output history replay, idle timeout
- [x] Mobile-responsive terminal page with tab-based terminal/AI agent interface
- [x] PWA manifest for installable mobile experience
- [x] DB migration for terminal_sessions, agent_chat_sessions, agent_chat_messages
- [x] Terminal session API (5 endpoints) + Agent chat API (3 endpoints) + Agent providers API
- [x] Agent provider configuration service with per-org settings
- [x] Terminal session detail page with per-session AI chat
- [x] Permission model (6 new permissions across 5 roles)
- [x] Audit events for terminal and agent chat actions
- [x] Unit tests for all providers, terminal proxy, terminal routes, agent chat routes

**Exit Gate**:
- [x] Multi-provider agent routing works (Anthropic, OpenAI, Gemini, DeepSeek, local fallback)
- [x] Terminal proxy handles WebSocket connections with session persistence
- [x] PTY bridge executes commands safely with blocked command protection
- [x] Mobile terminal page renders and interacts with API
- [x] All existing tests pass — zero regressions
- [x] Lint, typecheck, build all pass across full monorepo

---

## Change Control

Any deviation from this roadmap requires:
1. An ADR entry in `docs/ADR/`
2. Explicit approval from the project architect
3. Updated ROADMAP.md reflecting the change
4. No mid-sprint scope additions

Acceptable non-deviation triggers:
- Critical security advisory
- Upstream breaking change
- Failed acceptance test
- Legal/compliance blocker
