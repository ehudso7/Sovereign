# SOVEREIGN — Security Policy

## Principles

1. **Defense in depth**: Multiple layers of security controls
2. **Least privilege**: Minimum necessary permissions at every layer
3. **Zero trust for connectors**: Third-party tools are untrusted by default
4. **Secrets never leak**: Not in logs, prompts, responses, or client-side code
5. **Audit everything**: Every security-relevant action is recorded
6. **Tenant isolation is absolute**: No cross-tenant data access possible

## Authentication

### User Authentication
- Managed via WorkOS
- Supports: Email/password, Google OAuth, SAML SSO, OIDC
- JWT tokens with short expiry (15 minutes)
- Refresh tokens with rotation
- Session management with forced logout capability

### API Authentication
- Bearer JWT tokens
- API keys for service-to-service communication (scoped per org)
- Webhook signatures for outbound verification

### SCIM Provisioning
- WorkOS SCIM integration for enterprise directory sync
- Automatic user provisioning and deprovisioning
- Group-to-role mapping

## Authorization

### Role-Based Access Control (RBAC)
| Role | Scope | Capabilities |
|------|-------|-------------|
| owner | org | Full access, billing, member management |
| admin | org | Member management, all project access |
| member | org | Assigned project access |
| viewer | project | Read-only access to project resources |

### Fine-Grained Authorization (FGA)
- WorkOS FGA for resource-level permissions
- Evaluated at API middleware layer
- Cacheable with short TTL

### Policy-Based Access Control
- OPA for dynamic policy evaluation
- Policies cover: tool access, action approval, budget limits
- Policy decisions are logged and auditable

## Data Security

### Encryption
- **At rest**: AES-256 for database, object storage
- **In transit**: TLS 1.3 for all connections
- **Secrets**: Encrypted with org-specific keys before storage
- **Backups**: Encrypted with separate backup keys

### Tenant Isolation
- `org_id` required on every database table
- All queries filtered by authenticated org_id
- Database-level row security policies as defense in depth
- Object storage keys prefixed by org_id
- No shared state between tenants

### Secret Management
- Secrets stored encrypted in `connector_credentials`
- Secret broker service mediates all access
- Delegated tokens issued per-run with minimum scope
- Secrets never appear in:
  - Application logs
  - AI model prompts
  - API responses
  - Browser console
  - Error messages

## Connector Security

### Trust Tiers
| Tier | Source | Review | Permissions |
|------|--------|--------|-------------|
| verified | SOVEREIGN team | Audited, signed | Full tool access |
| internal | Org-created | Org-reviewed | Org-scoped access |
| untrusted | Third-party | Unreviewed | Sandboxed, limited |

### Connector Rules
- All connectors require explicit scope grants
- Untrusted connectors cannot access secrets directly
- All connector invocations are logged
- Connector auth tokens are short-lived and scoped
- MCP servers are treated as third parties with independent retention policies

## Agent Security

### Execution Guardrails
- Budget caps enforced per-run
- Approval policies for destructive actions
- Quarantine mode for misbehaving agents
- No agent can escalate its own permissions
- All agent actions traced and attributable

### Browser Session Security
- Browser sessions run in isolated containers
- No persistent state between sessions
- Secrets injected via secure channel, never in page context
- Session recordings stored encrypted
- Live takeover requires authenticated approval

### Memory Security
- Memory writes require provenance (source run + step)
- Memory reads scoped to org/project/agent/user
- Cross-tenant memory access impossible
- Admin review and redaction capability
- Expiration policies enforced

## API Security

### Input Validation
- All inputs validated at API boundary
- Schema validation for all request bodies
- Parameter sanitization for query strings
- File upload restrictions (type, size)

### Rate Limiting
- Per-org rate limits on all endpoints
- Stricter limits on auth and run-creation endpoints
- Per-IP rate limits on public endpoints
- Graduated response (429 → temporary block → alert)

### CORS
- Restricted to known origins
- No wildcard origins in production
- Credentials require explicit origin match

### Headers
- Strict CSP headers
- HSTS enabled
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## Infrastructure Security

### Network
- VPC isolation for all services
- Private subnets for databases and workers
- WAF for public endpoints
- DDoS protection at edge

### Container Security
- Minimal base images
- No root processes
- Read-only filesystems where possible
- Resource limits enforced

### CI/CD Security
- No secrets in code or CI config
- Secrets injected via CI secret store
- Dependency scanning on every PR
- Container image scanning before deploy

## Incident Response

### Classification
| Severity | Description | Response Time |
|----------|-------------|---------------|
| P0 | Data breach, tenant isolation failure | Immediate |
| P1 | Auth bypass, privilege escalation | < 1 hour |
| P2 | Data exposure, policy bypass | < 4 hours |
| P3 | Minor vulnerability, non-critical | < 24 hours |

### Process
1. Detect and classify
2. Contain and isolate
3. Investigate root cause
4. Remediate
5. Post-incident review
6. Update security controls

## Compliance Alignment

- SOC 2 Type II controls mapped
- GDPR data subject rights supported
- Data retention policies configurable per org
- Audit trail retention: minimum 1 year
- Right to deletion supported (with audit preservation)

## Security Review Cadence

- Dependency audit: weekly (automated)
- Access review: monthly
- Penetration testing: quarterly
- Architecture security review: per major release
- Incident drill: quarterly
