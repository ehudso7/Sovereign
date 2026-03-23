# ADR 0001: System Architecture

## Status

Accepted

## Date

2026-03-23

## Context

SOVEREIGN needs a clear architectural foundation that supports multi-tenancy, durable agent execution, enterprise authentication, policy enforcement, and extensible tool integration. The system must be production-grade from day one, not a prototype that gets "hardened later."

## Decision

### Monorepo with Turborepo + pnpm

We use a single monorepo managed by Turborepo and pnpm workspaces. This gives us:
- Shared types and utilities without publishing packages
- Atomic changes across services
- Single CI pipeline
- Consistent tooling and configuration

### Service Decomposition

The system is split into six applications:
1. **web** — Next.js frontend (App Router)
2. **api** — REST API server
3. **worker-orchestrator** — Temporal worker for agent execution
4. **worker-browser** — Playwright browser automation worker
5. **gateway-mcp** — MCP connector gateway
6. **docs** — Documentation site

### Frontend: Next.js 16+ with App Router

Next.js provides server-side rendering, API routes, and a mature deployment story. The App Router enables server components for reduced client-side JS and better data loading patterns.

### AI Runtime: OpenAI Responses API

All new agentic work uses the Responses API. It supports built-in tools, background execution, webhooks, and is the recommended path for new projects. The Assistants API is deprecated with shutdown scheduled for August 2026.

### Orchestration: Temporal

Agent runs are complex, long-running operations that need:
- Durability across worker restarts
- Pause/resume/cancel semantics
- Timer-based scheduling
- Retry with backoff
- Compensation for cleanup

Temporal provides all of these as infrastructure primitives.

### Auth: WorkOS

WorkOS handles SSO (SAML, OIDC), SCIM provisioning, RBAC, and fine-grained authorization. This eliminates the need to build enterprise auth from scratch.

### Policy: OPA

Open Policy Agent evaluates authorization decisions using policy-as-code. Policies are testable, auditable, and version-controlled.

### Connectors: MCP

The Model Context Protocol is the emerging standard for tool and data integration. Using MCP as the connector standard ensures interoperability with the broader AI ecosystem.

### Browser Automation: Playwright

Playwright provides deterministic cross-browser automation. When deterministic selectors fail (dynamic UIs), screenshot-based model-driven fallback is used.

### Database: PostgreSQL

PostgreSQL is the primary data store. Multi-tenancy is enforced via `org_id` on every table with application-level scoping and database-level row security as defense in depth.

## Consequences

### Positive
- Clear service boundaries from day one
- Enterprise-ready auth without custom implementation
- Durable execution for agent reliability
- Standard connector protocol for extensibility
- Strong multi-tenancy guarantees

### Negative
- Temporal adds operational complexity
- WorkOS is a vendor dependency
- OPA requires policy language knowledge
- MCP is still evolving

### Risks
- Temporal managed service availability
- WorkOS pricing at scale
- MCP spec changes requiring connector updates

## Alternatives Considered

- **Microservices from start**: Rejected — too much overhead for initial team size
- **Custom auth**: Rejected — enterprise SSO/SCIM is complex and security-critical
- **Simple queue instead of Temporal**: Rejected — doesn't provide durability, pause/resume, or compensation
- **Custom connector protocol**: Rejected — MCP is becoming the standard, no reason to invent our own
