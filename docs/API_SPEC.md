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

### GET /api/v1/auth/authorize
**Public**. WorkOS mode only. Starts the hosted AuthKit sign-in flow, issues a signed PKCE/state cookie, and redirects the browser to WorkOS.
Query: `returnTo?: string`, `loginHint?: string`, `screenHint?: "sign-in" | "sign-up"`

### POST /api/v1/auth/login
**Public**. Local mode only. Authenticate user with the repo’s local session flow.
Body: `{ email: string, password?: string, orgId?: string }`

### POST /api/v1/auth/bootstrap
**Public**. Local mode only. Create the first user, first org, and first session on an empty installation.
Body: `{ email: string, name: string, orgName: string, orgSlug: string }`
Rejects with `409 BOOTSTRAP_NOT_ALLOWED` once any user already exists.

### GET /api/v1/auth/callback
**Public**. WorkOS mode only. Handles the AuthKit callback, syncs the WorkOS user into the local user table, auto-accepts matching pending invitations, stores the session in secure cookies, and redirects back to the web app. Empty-install bootstrap continues through a bootstrap token.

### POST /api/v1/auth/workos/bootstrap
**Public**. WorkOS mode only. Completes first-workspace setup after a successful WorkOS callback on an empty installation.
Body: `{ token: string, orgName: string, orgSlug: string }`

### POST /api/v1/auth/session
**Public**. Exchange a bearer session token into secure browser cookies for the web client.
Body: `{ sessionToken: string }`

### POST /api/v1/auth/logout
Invalidate current session. Emits `auth.sign_out` audit event. In WorkOS mode, the response may include `logoutUrl` so the frontend can also terminate the hosted WorkOS session.

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

**Status: Implemented in Phase 6**

### GET /api/v1/connectors
List the connector catalog. Filterable by `?category=` and `?trustTier=`.
- Auth: Bearer token required
- Permission: `connector:read` (all roles)

### GET /api/v1/connectors/installed
List installed connectors for the current org.
- Auth: Bearer token required
- Permission: `connector:read` (all roles)

### GET /api/v1/connectors/:connectorId
Get connector catalog detail.
- Auth: Bearer token required
- Permission: `connector:read`

### GET /api/v1/connectors/:connectorId/scopes
List scopes/capabilities for a connector.
- Auth: Bearer token required
- Permission: `connector:read`

### POST /api/v1/connectors/:connectorId/install
Install a connector for the current org. Grants default scopes.
- Auth: Bearer token required
- Permission: `connector:install` (org_owner, org_admin)
- Returns 409 if already installed

### PATCH /api/v1/connectors/:connectorId/configure
Configure connector settings and/or credentials.
- Auth: Bearer token required
- Permission: `connector:configure` (org_owner, org_admin)
- Body: `{ config?: Record<string, unknown>, credentials?: { type: string, data: string } }`
- Credentials are stored encrypted (base64 in dev, real encryption in prod)
- Credentials are never returned in API responses

### POST /api/v1/connectors/:connectorId/test
Test connector connectivity by executing the first available tool.
- Auth: Bearer token required
- Permission: `connector:test` (org_owner, org_admin)
- Returns success/failure with test results

### POST /api/v1/connectors/:connectorId/revoke
Revoke (uninstall) a connector. Deletes credentials and install record.
- Auth: Bearer token required
- Permission: `connector:revoke` (org_owner, org_admin)

### Connector Trust Tiers
- **verified**: Audited, maintained by SOVEREIGN team
- **internal**: Org-created, org-reviewed
- **untrusted**: Third-party, sandboxed

### Connector Auth Modes
- **none**: No authentication required
- **api_key**: Requires API key credential
- **oauth2**: OAuth2 flow (stub for future)

## Skill Endpoints

**Status: Implemented in Phase 6**

### GET /api/v1/skills
List the skill catalog. Filterable by `?trustTier=`.
- Auth: Bearer token required
- Permission: `skill:read` (all roles)

### GET /api/v1/skills/installed
List installed skills for the current org.
- Auth: Bearer token required
- Permission: `skill:read` (all roles)

### GET /api/v1/skills/:skillId
Get skill detail.
- Auth: Bearer token required
- Permission: `skill:read`

### POST /api/v1/skills/:skillId/install
Install a skill for the current org.
- Auth: Bearer token required
- Permission: `skill:install` (org_owner, org_admin)
- Returns 409 if already installed

### POST /api/v1/skills/:skillId/uninstall
Uninstall a skill.
- Auth: Bearer token required
- Permission: `skill:uninstall` (org_owner, org_admin)

## Memory Endpoints (Phase 8 — implemented)

### POST /api/v1/memories
Create a new memory. Auth: memory:write.
Body: `{ scopeType, scopeId, kind, title, summary, content, metadata?, sourceRunId?, sourceAgentId?, expiresAt? }`

### GET /api/v1/memories
List memories. Auth: memory:read. Query: `?scopeType=&scopeId=&kind=&status=`

### GET /api/v1/memories/search
Search memories by text. Auth: memory:read. Query: `?q=&scopeType=&scopeId=&kind=&maxResults=`

### GET /api/v1/memories/:memoryId
Get memory detail. Auth: memory:read.

### PATCH /api/v1/memories/:memoryId
Update memory. Auth: memory:write. Body: `{ title?, summary?, content?, metadata? }`

### POST /api/v1/memories/:memoryId/redact
Redact memory content. Auth: memory:redact.

### POST /api/v1/memories/:memoryId/expire
Expire memory. Auth: memory:redact.

### POST /api/v1/memories/:memoryId/delete
Soft-delete memory. Auth: memory:delete.

### POST /api/v1/memories/:memoryId/promote
Promote episodic → procedural. Auth: memory:write.

### GET /api/v1/memories/:memoryId/links
Get memory links. Auth: memory:read.

## Mission Control Endpoints (Phase 9 — implemented)

### GET /api/v1/mission-control/overview
Get overview metrics (run counts, avg queue wait, avg duration, failure rate, token usage, cost, tool/browser/memory counts, open alerts, recent failures).
- Auth: observability:read

### GET /api/v1/mission-control/runs
List runs with filters. Query: `?status=&agentId=&projectId=&dateFrom=&dateTo=&limit=`
- Auth: observability:read

### GET /api/v1/mission-control/runs/:runId
Get run detail with steps, browser sessions, tool usage, memory usage, timeline, timing.
- Auth: observability:read

### GET /api/v1/mission-control/runs/:runId/timeline
Get ordered step timeline for a run.
- Auth: observability:read

### GET /api/v1/mission-control/runs/:runId/steps
Get steps for a run.
- Auth: observability:read

### GET /api/v1/mission-control/runs/:runId/linked-browser-sessions
Get browser sessions linked to a run.
- Auth: observability:read

### GET /api/v1/mission-control/alerts
List alerts. Query: `?status=&severity=&conditionType=&limit=`
- Auth: observability:read

### POST /api/v1/mission-control/alerts/:alertId/acknowledge
Acknowledge an open alert.
- Auth: observability:alerts

## Policy Endpoints (Phase 10 — implemented)

### GET /api/v1/policies
List policies. Auth: policy:read. Query: `?status=&scopeType=&policyType=`

### POST /api/v1/policies
Create a policy. Auth: policy:write.
Body: `{ name, description?, policyType, enforcementMode, scopeType, scopeId?, rules?, priority? }`

### GET /api/v1/policies/:policyId
Get policy detail. Auth: policy:read.

### PATCH /api/v1/policies/:policyId
Update policy. Auth: policy:write.
Body: `{ name?, description?, rules?, priority?, enforcementMode? }`

### POST /api/v1/policies/:policyId/disable
Disable a policy. Auth: policy:write.

### POST /api/v1/policies/:policyId/enable
Enable a disabled policy. Auth: policy:write.

### POST /api/v1/policies/evaluate
Test policy evaluation. Auth: policy:read.
Body: `{ subjectType, subjectId?, actionType, context? }`
Returns: `{ decision, policyId, reason, approvalId?, policyDecisionId }`

## Approval Endpoints (Phase 10 — implemented)

### GET /api/v1/approvals
List approvals. Auth: approval:read. Query: `?status=&subjectType=&limit=`

### GET /api/v1/approvals/:approvalId
Get approval detail. Auth: approval:read.

### POST /api/v1/approvals/:approvalId/approve
Approve a pending request. Auth: approval:decide.
Body: `{ note? }`

### POST /api/v1/approvals/:approvalId/deny
Deny a pending request. Auth: approval:decide.
Body: `{ note? }`

## Quarantine Endpoints (Phase 10 — implemented)

### GET /api/v1/quarantine
List quarantine records. Auth: quarantine:read. Query: `?status=&subjectType=`

### POST /api/v1/quarantine
Quarantine a subject. Auth: quarantine:manage.
Body: `{ subjectType, subjectId, reason }`

### POST /api/v1/quarantine/:recordId/release
Release from quarantine. Auth: quarantine:manage.
Body: `{ note? }`

## Audit Endpoints (Phase 10 — implemented)

### GET /api/v1/audit
Query audit events. Auth: audit:read. Query: `?action=&resourceType=&resourceId=&actorId=&limit=`

### GET /api/v1/audit/:eventId
Get audit event detail. Auth: audit:read.

## Browser Session Endpoints (Phase 7 — implemented)

### POST /api/v1/browser-sessions
Create a new browser session linked to a run.
- Auth: browser:control
- Body: `{ runId: uuid, browserType?: "chromium" | "firefox" | "webkit" }`
- Response: 201 `{ data: BrowserSession }`

### GET /api/v1/browser-sessions
List browser sessions for the org.
- Auth: browser:read
- Query: `?runId=uuid&status=string`
- Response: 200 `{ data: BrowserSession[] }`

### GET /api/v1/browser-sessions/:sessionId
Get browser session details.
- Auth: browser:read
- Response: 200 `{ data: BrowserSession }`

### GET /api/v1/browser-sessions/:sessionId/artifacts
List artifact keys for a browser session.
- Auth: browser:read
- Response: 200 `{ data: string[] }`

### POST /api/v1/browser-sessions/:sessionId/takeover
Request human takeover of a browser session. Transitions active → human_control.
- Auth: browser:takeover
- Response: 200 `{ data: BrowserSession }`

### POST /api/v1/browser-sessions/:sessionId/release
Release human takeover. Transitions human_control → active.
- Auth: browser:takeover
- Response: 200 `{ data: BrowserSession }`

### POST /api/v1/browser-sessions/:sessionId/close
Close a browser session. Transitions through closing → closed.
- Auth: browser:control
- Response: 200 `{ data: BrowserSession }`

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
