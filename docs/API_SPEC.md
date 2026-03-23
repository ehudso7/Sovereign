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
**Public**. Initiate login via WorkOS.

### POST /api/v1/auth/callback
**Public**. Handle WorkOS auth callback.

### POST /api/v1/auth/logout
Invalidate current session.

### GET /api/v1/auth/me
Get current user and org context.

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

### GET /api/v1/agents
List agents (filterable by project).

### POST /api/v1/agents
Create a new agent.

### GET /api/v1/agents/:agentId
Get agent details.

### PATCH /api/v1/agents/:agentId
Update agent.

### DELETE /api/v1/agents/:agentId
Archive agent.

### GET /api/v1/agents/:agentId/versions
List agent versions.

### POST /api/v1/agents/:agentId/versions
Create a new agent version.

### POST /api/v1/agents/:agentId/versions/:versionId/publish
Publish an agent version.

### POST /api/v1/agents/:agentId/versions/:versionId/unpublish
Unpublish an agent version.

## Run Endpoints

### GET /api/v1/runs
List runs (filterable by agent, project, status).

### POST /api/v1/runs
Start a new run.

### GET /api/v1/runs/:runId
Get run details.

### POST /api/v1/runs/:runId/pause
Pause a running run.

### POST /api/v1/runs/:runId/resume
Resume a paused run.

### POST /api/v1/runs/:runId/cancel
Cancel a run.

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
