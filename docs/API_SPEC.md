# SOVEREIGN — API Specification

## Overview

All API endpoints are served from `apps/api` under the base path `/api/v1`.

All requests require authentication via Bearer token (JWT) unless marked as public.
All responses use JSON format.
All mutations emit audit events.
All queries are tenant-scoped to the authenticated user's organization.

## Common Headers

```
Authorization: Bearer <jwt>
Content-Type: application/json
X-Request-Id: <uuid>  (optional, auto-generated if missing)
```

## Common Response Format

```json
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

## Authentication Endpoints

### POST /api/v1/auth/login
**Public**. Authenticate user. In local mode: email-based login. In WorkOS mode: initiate OAuth flow.
Body: `{ email: string, password?: string, orgId?: string }`

### POST /api/v1/auth/callback
**Public**. Handle WorkOS auth callback.
Body: `{ code: string, state?: string }`

### POST /api/v1/auth/logout
Invalidate current session. Emits `auth.sign_out` audit event.

### GET /api/v1/auth/me
Get current user, org context, role, and session info.

### POST /api/v1/auth/switch-org
Switch the session to a different organization context. Requires membership in the target org.
Body: `{ orgId: string }`

### GET /api/v1/auth/sessions
List all active sessions for the current user in the current org.

### DELETE /api/v1/auth/sessions/:sessionId
Revoke a specific session. Emits `auth.session_revoked` audit event.

## Organization Endpoints

### GET /api/v1/orgs
List organizations for the current user.

### POST /api/v1/orgs
Create a new organization.

### GET /api/v1/orgs/:orgId
Get organization details.

### PATCH /api/v1/orgs/:orgId
Update organization settings.

### POST /api/v1/orgs/:orgId/invitations
Invite a user to the organization.

### GET /api/v1/orgs/:orgId/members
List organization members.

### PATCH /api/v1/orgs/:orgId/members/:userId
Update member role.

### DELETE /api/v1/orgs/:orgId/members/:userId
Remove member from organization.

## Project Endpoints

### GET /api/v1/projects
List projects in the current org.

### POST /api/v1/projects
Create a new project.

### GET /api/v1/projects/:projectId
Get project details.

### PATCH /api/v1/projects/:projectId
Update project.

### DELETE /api/v1/projects/:projectId
Archive project.

## Agent Endpoints

**Status: Implemented in Phase 4**

### GET /api/v1/agents
List agents for the current org. Filterable by `?projectId=` and `?status=draft|published|archived`.
- Auth: Bearer token required
- Permission: `agent:read` (all roles)

### POST /api/v1/agents
Create a new agent in draft status.
- Auth: Bearer token required
- Permission: `agent:create` (org_owner, org_admin)
- Body: `{ name, slug, projectId, description? }`
- Validation: Zod schema, slug must match `^[a-z0-9-]+$`

### GET /api/v1/agents/:agentId
Get agent details by ID.
- Auth: Bearer token required
- Permission: `agent:read`

### PATCH /api/v1/agents/:agentId
Update agent metadata (name, description). Rejects updates to archived agents (403 FORBIDDEN).
- Auth: Bearer token required
- Permission: `agent:update` (org_owner, org_admin)
- Body: `{ name?, description? }`

### DELETE /api/v1/agents/:agentId
Archive agent. Unpublishes all published versions first.
- Auth: Bearer token required
- Permission: `agent:archive` (org_owner, org_admin)

### GET /api/v1/agents/:agentId/versions
List all versions for an agent, sorted by version descending.
- Auth: Bearer token required
- Permission: `agent:read`

### GET /api/v1/agents/:agentId/versions/:versionId
Get a specific agent version with full configuration.
- Auth: Bearer token required
- Permission: `agent:read`

### POST /api/v1/agents/:agentId/versions
Create a new draft agent version. Version number auto-increments. New versions are created blank (not cloned from previous).
- Auth: Bearer token required
- Permission: `agent:update` (org_owner, org_admin)
- Body: `{ instructions?, goals?, tools?, budget?, approvalRules?, memoryConfig?, schedule?, modelConfig? }`
- Default modelConfig: `{ provider: "openai", model: "gpt-4o", temperature: 0.7, maxTokens: 4096 }`

### PATCH /api/v1/agents/:agentId/versions/:versionId
Update a draft version. Published versions are immutable (403 FORBIDDEN).
- Auth: Bearer token required
- Permission: `agent:update` (org_owner, org_admin)
- Body: same fields as POST

### POST /api/v1/agents/:agentId/versions/:versionId/publish
Publish a version. Validates instructions and modelConfig are present. Unpublishes any previously published version (single-published-version enforcement). Sets agent status to "published".
- Auth: Bearer token required
- Permission: `agent:publish` (org_owner, org_admin)
- Rejects: archived agents (403), empty instructions (400), missing model config (400)

### POST /api/v1/agents/:agentId/unpublish
Unpublish all versions for an agent. Sets agent status back to "draft".
- Auth: Bearer token required
- Permission: `agent:publish` (org_owner, org_admin)

### Agent Studio Behavior Rules
- **Published versions are immutable**: Once published, a version cannot be edited. Create a new version instead.
- **Drafts are created blank**: New versions start empty, not cloned from the previous version.
- **Single published version**: Only one version per agent can be published at a time. Publishing a new version automatically unpublishes the previous one.
- **Archived agents**: Cannot be updated, cannot have versions published. Archiving unpublishes all versions.
- **Unpublish**: Returns agent to draft status and marks all versions as unpublished.

## Run Endpoints

**Status: Implemented in Phase 5**

### POST /api/v1/agents/:agentId/runs
Start a new run for a published agent version.
- Auth: Bearer token required
- Permission: `run:create` (org_owner, org_admin, org_member)
- Body: `{ input?: Record<string, unknown> }`
- Requires agent to have a published version. Rejects draft/unpublished/archived agents.
- Creates run in "queued" status, dispatches to Temporal workflow.
- Returns 201 with run data.

### GET /api/v1/agents/:agentId/runs
List runs for a specific agent. Returns only runs belonging to the specified agent within the current org.
- Auth: Bearer token required
- Permission: `run:read` (all roles)
- Returns 404 if agent does not exist or does not belong to the org.

### GET /api/v1/runs
List runs for the current org (all agents). Filterable by `?agentId=`, `?status=`, `?projectId=`.
- Auth: Bearer token required
- Permission: `run:read` (all roles)
- Note: For per-agent listing, prefer `GET /api/v1/agents/:agentId/runs`. This endpoint provides org-wide listing with optional filters.

### GET /api/v1/runs/:runId
Get run details by ID.
- Auth: Bearer token required
- Permission: `run:read`

### GET /api/v1/runs/:runId/steps
Get ordered step records for a run.
- Auth: Bearer token required
- Permission: `run:read`

### POST /api/v1/runs/:runId/pause
Pause a running run. Only valid when status is "running".
- Auth: Bearer token required
- Permission: `run:control` (org_owner, org_admin)

### POST /api/v1/runs/:runId/resume
Resume a paused run. Only valid when status is "paused".
- Auth: Bearer token required
- Permission: `run:control` (org_owner, org_admin)

### POST /api/v1/runs/:runId/cancel
Cancel a run. Valid from "queued", "running", or "paused" status.
- Auth: Bearer token required
- Permission: `run:control` (org_owner, org_admin)

### Run State Machine
States: queued → starting → running → completed/failed
- queued → starting → running (normal flow)
- running → paused (pause), paused → running (resume)
- queued/running/paused → cancelling → cancelled
- completed, failed, cancelled are terminal states
- Invalid transitions return 400 BAD_REQUEST

### Run Behavior Rules
- **Published versions only**: Runs can only be created for agents with a published version.
- **Draft/archived rejection**: Agents in draft or archived status cannot be executed.
- **Durable execution**: Runs are persisted via Temporal workflows and survive worker restarts.
- **Execution providers**: "local" (deterministic dev/CI) or "openai" (production via OpenAI Responses API — `POST /v1/responses`).
- **Audit trail**: All state transitions emit audit events.

### GET /api/v1/runs/:runId/steps
Get run steps.

### GET /api/v1/runs/:runId/artifacts
List run artifacts.

### GET /api/v1/runs/:runId/artifacts/:artifactId
Download a run artifact.

## Approval Endpoints

### GET /api/v1/approvals
List pending approvals.

### POST /api/v1/approvals/:approvalId/approve
Approve an action.

### POST /api/v1/approvals/:approvalId/deny
Deny an action.

## Connector Endpoints

### GET /api/v1/connectors
List available connectors.

### POST /api/v1/connectors
Register a connector.

### GET /api/v1/connectors/:connectorId
Get connector details.

### PATCH /api/v1/connectors/:connectorId
Update connector.

### DELETE /api/v1/connectors/:connectorId
Remove connector.

### POST /api/v1/connectors/:connectorId/test
Test connector connectivity.

### POST /api/v1/connectors/:connectorId/credentials
Set connector credentials.

### DELETE /api/v1/connectors/:connectorId/credentials
Revoke connector credentials.

### GET /api/v1/connectors/:connectorId/scopes
List connector scopes.

## Memory Endpoints

### GET /api/v1/memory
Query memory entries (by scope, lane, search).

### GET /api/v1/memory/:entryId
Get a specific memory entry.

### DELETE /api/v1/memory/:entryId
Delete/redact a memory entry.

### GET /api/v1/memory/admin
Admin view of memory (for review/redaction).

## Policy Endpoints

### GET /api/v1/policies
List policies.

### POST /api/v1/policies
Create a policy.

### GET /api/v1/policies/:policyId
Get policy details.

### PATCH /api/v1/policies/:policyId
Update policy.

### DELETE /api/v1/policies/:policyId
Delete policy.

### POST /api/v1/policies/evaluate
Test policy evaluation.

## Audit Endpoints

### GET /api/v1/audit
Query audit events (filterable by resource, actor, action, time range).

### GET /api/v1/audit/:eventId
Get audit event details.

## Browser Session Endpoints

### GET /api/v1/browser-sessions
List browser sessions.

### GET /api/v1/browser-sessions/:sessionId
Get browser session details.

### GET /api/v1/browser-sessions/:sessionId/recording
Get session recording.

### POST /api/v1/browser-sessions/:sessionId/takeover
Request live takeover of a browser session.

## CRM Endpoints

### Accounts
- GET /api/v1/accounts
- POST /api/v1/accounts
- GET /api/v1/accounts/:accountId
- PATCH /api/v1/accounts/:accountId
- DELETE /api/v1/accounts/:accountId

### Contacts
- GET /api/v1/contacts
- POST /api/v1/contacts
- GET /api/v1/contacts/:contactId
- PATCH /api/v1/contacts/:contactId
- DELETE /api/v1/contacts/:contactId

### Deals
- GET /api/v1/deals
- POST /api/v1/deals
- GET /api/v1/deals/:dealId
- PATCH /api/v1/deals/:dealId
- DELETE /api/v1/deals/:dealId

### Tasks
- GET /api/v1/tasks
- POST /api/v1/tasks
- GET /api/v1/tasks/:taskId
- PATCH /api/v1/tasks/:taskId
- DELETE /api/v1/tasks/:taskId

## Billing Endpoints

### GET /api/v1/billing
Get billing account details.

### GET /api/v1/billing/usage
Get usage summary (filterable by date range).

### GET /api/v1/billing/invoices
List invoices.

### GET /api/v1/billing/invoices/:invoiceId
Get invoice details.

## Observability Endpoints

### GET /api/v1/dashboard/stats
Get dashboard statistics.

### GET /api/v1/dashboard/costs
Get cost breakdown.

### GET /api/v1/dashboard/health
Get system health status.

## Webhook Events

The following webhook events can be configured per org:

- `run.started`
- `run.completed`
- `run.failed`
- `run.paused`
- `approval.requested`
- `approval.decided`
- `connector.connected`
- `connector.disconnected`
- `alert.triggered`

## Rate Limiting

- Standard: 100 requests/minute per org
- Run creation: 20 requests/minute per org
- Auth endpoints: 10 requests/minute per IP

## Pagination

All list endpoints support cursor-based pagination:

```
GET /api/v1/runs?cursor=<cursor>&limit=50
```

Response includes:
```json
{
  "data": [...],
  "meta": {
    "next_cursor": "...",
    "has_more": true
  }
}
```
