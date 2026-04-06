# ADR 0002: Mobile Terminal with Multi-Provider AI Agent Access

## Status

Proposed

## Date

2026-04-06

## Context

Sovereign is a production-grade multi-tenant agent OS with a desktop-oriented web UI and a Rust-based CLI (claw-runtime). There is no mobile-optimized experience. Developers today cannot:

1. **Execute terminal commands from mobile** — SSH apps exist (Termux, Blink Shell) but have no AI agent integration, poor UX, and no session persistence across devices
2. **Access AI coding agents on the go** — Claude Code, Cursor, Codex, Gemini CLI, Grok, DeepSeek are all desktop-bound; no unified mobile access point exists
3. **Monitor and triage from mobile** — CI failures, test results, deployment status require opening a laptop for anything beyond read-only GitHub mobile notifications
4. **Continue work across devices** — Starting a task on desktop and picking it up on mobile (or vice versa) requires manual context reconstruction

The market gap is real: no product provides a mobile-first terminal experience with multi-provider AI agent routing. This is not about replacing desktop development — it's about enabling the "quick fix, triage, review, monitor" use cases that currently require finding a laptop.

### Why Sovereign Is Positioned for This

- **Agent runtime abstraction** already supports pluggable providers (`ExecutionProvider` interface with OpenAI implemented, `ModelProvider` type includes `"anthropic" | "google" | "mistral" | "custom"`)
- **Temporal orchestration** already provides session durability, pause/resume, and cross-device continuity
- **Claw-runtime server crate** already has an Axum-based HTTP server with SSE streaming — can serve as the terminal backend
- **MCP Gateway** already provides tool/connector extensibility
- **Multi-tenant auth, audit, and policy enforcement** already exist — mobile is another client, not a new trust boundary

### What This Is NOT

- A full IDE on mobile — screen real estate makes this impractical
- Local development on phone hardware — computation stays server-side
- A replacement for desktop workflows — this is a complement for on-the-go access

## Decision

### Phase 15: Mobile Terminal with Multi-Provider AI Agent Access

Add a mobile-optimized Progressive Web App (PWA) experience to the existing `apps/web` Next.js application, backed by a new WebSocket terminal proxy service and multi-provider agent routing.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Mobile Browser (PWA)                       │
│  ┌───────────────┐  ┌───────────────────┐   │
│  │ xterm.js       │  │ Command Palette   │   │
│  │ Terminal        │  │ (touch-optimized) │   │
│  └───────┬───────┘  └────────┬──────────┘   │
└──────────┼────────────────────┼──────────────┘
           │ WebSocket          │ REST API
           ▼                    ▼
┌──────────────────┐  ┌────────────────────┐
│ Terminal Proxy    │  │ API Server         │
│ Service           │  │ (existing Fastify) │
│ (new: ws-proxy)   │  │                    │
└────────┬─────────┘  └────────┬───────────┘
         │                      │
         ▼                      ▼
┌──────────────────┐  ┌────────────────────┐
│ Container/SSH     │  │ Agent Router       │
│ Session Pool      │  │ (multi-provider)   │
│                   │  │                    │
└──────────────────┘  └────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        ┌──────────┐   ┌──────────┐    ┌──────────────┐
        │ Anthropic│   │ OpenAI   │    │ Google/etc   │
        │ Claude   │   │ Codex    │    │ Gemini/Grok/ │
        │ API      │   │ API      │    │ DeepSeek     │
        └──────────┘   └──────────┘    └──────────────┘
```

### Component Breakdown

#### 1. Multi-Provider Agent Router (`packages/agents`)

Extend the existing `ExecutionProvider` abstraction with production providers:

| Provider | API | Use Case |
|----------|-----|----------|
| Anthropic Claude | Messages API | General coding, reasoning, long-context |
| OpenAI Codex | Responses API (existing) | Code generation, structured output |
| Google Gemini | Gemini API | Multi-modal, large context windows |
| xAI Grok | Grok API | Real-time knowledge, fast iteration |
| DeepSeek | DeepSeek API | Cost-effective coding, open-weight fallback |

Each provider implements `ExecutionProvider` — same interface, same audit trail, same policy enforcement. Provider selection is per-agent or per-request, controlled by the user.

#### 2. Terminal Proxy Service (`apps/terminal-proxy`)

New monorepo app — lightweight WebSocket-to-PTY bridge:

- Accepts authenticated WebSocket connections
- Allocates a sandboxed container or SSH session per user
- Bridges terminal I/O over WebSocket with binary framing
- Session persistence: reconnect to active session on network drop
- Idle timeout with configurable keep-alive
- All sessions are org-scoped and audited

#### 3. Mobile Terminal UI (`apps/web` — responsive)

Not a separate app — extend the existing Next.js web app with mobile-optimized layouts:

- **xterm.js** terminal emulator component in `packages/ui`
- **Touch-optimized command palette**: common actions (run tests, git status, deploy, "ask AI to fix") as tappable buttons above the keyboard
- **Responsive layouts**: detect viewport, show mobile-optimized terminal view
- **PWA manifest**: installable on home screen, offline shell, push notifications for long-running tasks
- **Session switcher**: multiple terminal sessions, plus AI agent chat sessions
- **Swipe gestures**: switch between terminal and AI agent panel

#### 4. AI Agent Chat Panel

Adjacent to the terminal — not a separate page:

- Send natural language requests to any configured provider
- Agent can read terminal context (last N lines of output)
- Agent can suggest commands (user approves before execution)
- Agent can edit files (shows diff, user approves)
- All actions go through existing policy engine
- Provider switching mid-conversation

### Implementation Phases

**15a: Foundation (Week 1-2)**
- [ ] Add Anthropic, Gemini, DeepSeek execution providers to `packages/agents`
- [ ] xterm.js terminal component in `packages/ui`
- [ ] WebSocket terminal proxy service scaffolding (`apps/terminal-proxy`)
- [ ] Mobile-responsive layout detection in `apps/web`
- [ ] PWA manifest and service worker

**15b: Terminal Core (Week 3-4)**
- [ ] WebSocket-to-PTY bridge with container/SSH session allocation
- [ ] Session persistence and reconnection
- [ ] Terminal proxy auth integration (existing session tokens)
- [ ] Terminal session CRUD API endpoints
- [ ] Mobile keyboard optimization (common key shortcuts bar)

**15c: AI Agent Integration (Week 5-6)**
- [ ] Multi-provider agent chat panel
- [ ] Terminal context injection into agent prompts
- [ ] Command suggestion and approval flow
- [ ] File diff viewer (mobile-optimized)
- [ ] Provider configuration UI (API keys, model selection)

**15d: Polish and Hardening (Week 7-8)**
- [ ] Push notifications for long-running tasks
- [ ] Offline mode (queued commands)
- [ ] Touch gesture navigation
- [ ] Load testing WebSocket connections
- [ ] E2E tests for mobile flows
- [ ] Security review of terminal proxy attack surface

### Database Changes

New migration: `012_phase15_terminal.sql`

```sql
CREATE TABLE terminal_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  project_id   UUID REFERENCES projects(id),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('provisioning','active','idle','closed','failed')),
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

CREATE INDEX idx_terminal_sessions_org ON terminal_sessions(org_id);
CREATE INDEX idx_terminal_sessions_user ON terminal_sessions(user_id);
CREATE INDEX idx_terminal_sessions_status ON terminal_sessions(status);
```

### API Endpoints (New)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/terminal-sessions | Create terminal session |
| GET | /api/v1/terminal-sessions | List user's sessions |
| GET | /api/v1/terminal-sessions/:id | Get session detail |
| POST | /api/v1/terminal-sessions/:id/close | Close session |
| POST | /api/v1/terminal-sessions/:id/resize | Resize terminal |
| GET | /api/v1/agent-providers | List available AI providers |
| POST | /api/v1/agent-providers/configure | Configure provider API key |
| POST | /api/v1/agent-chat | Send message to AI agent |
| GET | /api/v1/agent-chat/:sessionId/history | Get chat history |

WebSocket endpoint: `ws://api/v1/terminal-sessions/:id/connect`

### Permission Model

| Permission | Roles |
|------------|-------|
| terminal:read | all roles |
| terminal:create | org_owner, org_admin, org_member |
| terminal:admin | org_owner, org_admin |
| agent_provider:read | all roles |
| agent_provider:configure | org_owner, org_admin |
| agent_chat:use | org_owner, org_admin, org_member |

### Audit Events

- terminal.session_created, terminal.session_closed, terminal.session_idle_timeout
- terminal.command_executed (command hash only — never log raw commands with secrets)
- agent_chat.message_sent, agent_chat.command_suggested, agent_chat.command_approved
- agent_provider.configured, agent_provider.removed

### Billing Integration

New meters added to existing plans:

| Meter | Free | Team | Enterprise |
|-------|------|------|-----------|
| terminal_sessions | 5 concurrent | 50 concurrent | unlimited |
| agent_chat_messages | 100/mo | 5,000/mo | unlimited |
| agent_tokens | 50K/mo | 2M/mo | unlimited |

## Consequences

### Positive
- First-to-market mobile-first AI terminal experience
- Natural extension of existing architecture (not a bolt-on)
- Multi-provider agent routing is reusable across all Sovereign surfaces
- PWA avoids App Store review cycles and dual-platform maintenance
- All existing security/audit/policy infrastructure applies to mobile

### Negative
- WebSocket terminal proxy is a new operational surface (scaling, security)
- PWA has limitations vs native (no background execution, limited push notification support on iOS)
- xterm.js on mobile is inherently limited by touch keyboard UX
- Multi-provider API key management adds credential surface area

### Risks
- Mobile terminal UX may feel awkward despite optimization — mitigation: command palette reduces raw typing
- WebSocket connections on mobile networks are unreliable — mitigation: auto-reconnect with session persistence
- Provider API cost exposure — mitigation: billing meters with entitlement enforcement
- Container/SSH session security — mitigation: sandboxed containers, no host access, network policy isolation

## Alternatives Considered

- **Native iOS/Android apps**: Rejected — doubles development effort, App Store friction, Sovereign is web-first
- **React Native / Expo**: Rejected — adds a new tech stack; PWA achieves 90% of native with zero new tooling
- **Extend claw-runtime to mobile**: Rejected — Rust CLI is desktop-native; mobile needs a web-based interface that delegates to server-side execution
- **Single provider only (Claude)**: Rejected — users want provider choice; the abstraction already supports it; market differentiation requires multi-provider
- **Separate mobile app codebase**: Rejected — violates monorepo principle; responsive web + PWA is the right approach
