# SOVEREIGN — Architecture

## System Overview

SOVEREIGN is a multi-tenant agent operating system built as a monorepo with clear service boundaries.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  Web App (Next.js)  │  API Consumers  │  Webhooks            │
└──────────┬──────────┴────────┬────────┴──────────────────────┘
           │                   │
┌──────────▼───────────────────▼──────────────────────────────┐
│                      API GATEWAY                             │
│  Authentication │ Rate Limiting │ Request Validation          │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                      API SERVER                              │
│  REST Endpoints │ WebSocket │ Webhook Dispatch                │
│  Auth Middleware │ Tenant Scoping │ Audit Emission            │
└───┬──────┬──────┬──────┬──────┬─────────────────────────────┘
    │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Policy││Memory││Agent ││Conn- ││Bill- │
│Engine││Engine││Studio││ectors││ing   │
│(OPA) ││      ││      ││(MCP) ││      │
└──────┘└──────┘└──┬───┘└──────┘└──────┘
                   │
         ┌─────────▼─────────┐
         │   ORCHESTRATOR    │
         │   (Temporal)      │
         │                   │
         │ Workflows │ Tasks │
         │ Retries │ Timers  │
         └────┬────────┬─────┘
              │        │
     ┌────────▼──┐ ┌───▼────────┐
     │ Worker:   │ │ Worker:    │
     │ General   │ │ Browser    │
     │           │ │ (Playwright│
     └───────────┘ └────────────┘
```

## Service Boundaries

### apps/web — Frontend
- **Tech**: Next.js 16+ with App Router, TypeScript, Tailwind CSS
- **Responsibility**: All user-facing UI
- **Auth**: WorkOS-managed sessions
- **Data**: Fetches from API server only — no direct DB access
- **Deployment**: Vercel or containerized

### apps/api — API Server
- **Tech**: Node.js, Express/Fastify, TypeScript
- **Responsibility**: All business logic, REST endpoints, webhook dispatch
- **Auth**: JWT validation, WorkOS integration
- **Data**: Direct database access via packages/db
- **Tenant Scoping**: All queries scoped to authenticated org
- **Deployment**: Containerized

### apps/worker-orchestrator — Temporal Worker
- **Tech**: Node.js, Temporal SDK, TypeScript
- **Responsibility**: Execute agent workflows, manage run state machines
- **AI Runtime**: OpenAI Responses API (`POST /v1/responses`) for production; local deterministic provider for dev/CI
- **Data**: Temporal persistence + app database for results
- **Deployment**: Containerized, horizontally scalable

### apps/worker-browser — Browser Worker
- **Tech**: Node.js, Playwright, TypeScript
- **Responsibility**: Browser automation sessions
- **Data**: Screenshots, recordings, DOM snapshots to object storage
- **Deployment**: Containerized with browser binaries

### apps/gateway-mcp — MCP Gateway
- **Tech**: Node.js, TypeScript
- **Responsibility**: MCP server registry, connector routing, auth mediation
- **Data**: Connector metadata, credential references
- **Deployment**: Containerized

### apps/docs — Documentation Site
- **Tech**: Next.js or similar static site generator
- **Responsibility**: User-facing documentation
- **Deployment**: Static hosting

## Package Boundaries

### packages/core
- Shared TypeScript types, interfaces, and constants
- Utility functions used across services
- No external service dependencies

### packages/db
- Database client (PostgreSQL)
- Schema definitions and migrations
- Query builders and data access patterns
- Tenant-scoped query helpers

### packages/ui
- Design system components
- Tailwind CSS configuration
- Shared layouts and patterns

### packages/config
- Shared ESLint config
- Shared TypeScript config
- Shared Tailwind config
- Environment variable schemas

### packages/agents
- Agent type definitions
- Agent validation logic
- Agent version management
- Execution context builders

### packages/connectors
- Connector type definitions
- MCP protocol utilities
- Connector registry logic
- Auth flow helpers

### packages/policies
- OPA integration client
- Policy evaluation helpers
- Approval flow logic
- Policy type definitions

### packages/observability
- Structured logging
- Distributed tracing
- Metrics collection
- Alert definitions

### packages/billing
- Usage metering
- Plan definitions
- Invoice generation
- Payment provider integration

### packages/crm
- Account/contact/deal types
- CRM sync adapters
- Pipeline logic

### packages/testing
- Test fixtures and factories
- Database test helpers
- Mock providers
- Integration test utilities

## Data Architecture

### Primary Database: PostgreSQL
- All transactional data
- Tenant isolation via org_id on every table
- Row-level security where applicable
- Connection pooling via PgBouncer

### Object Storage: S3-Compatible
- Browser session recordings
- Run artifacts
- File uploads
- Agent-generated outputs

### Temporal Server
- Workflow state and history
- Task queues
- Timer management
- Signal/query handling

### Cache Layer: Redis
- Session data
- Rate limiting counters
- Feature flags
- Transient state

## Security Architecture

### Authentication Flow
```
Client → WorkOS → JWT → API Middleware → Tenant Context
```

### Authorization Model
```
Request → Tenant Scope → Role Check → Policy Evaluation (OPA) → Allow/Deny
```

### Secret Management
```
Secret Store → Secret Broker → Delegated Token → Agent/Connector
(Never exposed in logs, prompts, or client responses)
```

### Trust Tiers for Connectors
1. **Verified**: Audited, signed, maintained by SOVEREIGN team
2. **Internal**: Org-created, org-scoped, org-reviewed
3. **Untrusted**: Third-party, sandboxed, limited permissions

## Deployment Architecture

### Development
- Docker Compose for all services
- Hot reload for all apps
- Local PostgreSQL, Redis, Temporal
- Seed data for development

### Staging
- Kubernetes or container platform
- Mirrors production topology
- Automated deployment from CI

### Production
- Kubernetes or container platform
- Horizontal autoscaling for workers
- Managed PostgreSQL
- Managed Redis
- CDN for static assets
- WAF and DDoS protection

## Cross-Cutting Concerns

### Multi-Tenancy
- Every database table includes `org_id`
- Every API endpoint scopes queries by authenticated org
- No cross-tenant data access is possible
- Tenant context propagated through all service calls

### Audit Trail
- Every state-changing action emits an audit event
- Audit events include: actor, action, resource, org, timestamp, metadata
- Audit events are append-only
- Audit events are queryable by org admins

### Observability
- Structured JSON logging with correlation IDs
- Distributed tracing across services
- Metrics for latency, throughput, error rates
- Alerting on SLO violations
