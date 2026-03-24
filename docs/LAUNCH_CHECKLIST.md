# SOVEREIGN Launch Checklist

## Pre-Launch Verification

### Infrastructure
- [ ] PostgreSQL 16+ running with connection pooling configured
- [ ] Redis 7+ running for caching and rate limiting
- [ ] Temporal server running with sovereign namespace
- [ ] MinIO/S3 storage configured for artifacts
- [ ] DNS and TLS certificates provisioned
- [ ] Load balancer / reverse proxy configured
- [ ] Health check endpoints verified: `GET /api/v1/health`

### Environment Configuration
- [ ] All required env vars set (see ENVIRONMENT.md)
- [ ] `AUTH_MODE` set to `workos` for production
- [ ] `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` configured
- [ ] `SESSION_SECRET` set to a cryptographically random 64+ char string
- [ ] `DATABASE_URL` pointing to production PostgreSQL
- [ ] `SOVEREIGN_SECRET_KEY` set for connector credential encryption (32+ chars)
- [ ] `NODE_ENV=production`
- [ ] `DB_MAX_CONNECTIONS` tuned for expected load (default: 10)

### Database
- [ ] All migrations applied: `pnpm db:migrate`
- [ ] RLS policies verified on all org-scoped tables
- [ ] Connection pooling configured (pgBouncer or native)
- [ ] Backup schedule configured (see BACKUP_RESTORE.md)
- [ ] Point-in-time recovery (PITR) enabled

### Security
- [ ] WorkOS SSO configured and tested
- [ ] SCIM provisioning configured if needed
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting enabled (100 req/min per org)
- [ ] CSP, HSTS, X-Frame-Options headers verified
- [ ] Connector credentials encrypted at rest (AES-256-GCM)
- [ ] Audit trail verified: all state-changing operations logged
- [ ] Secret redaction verified in support/admin outputs
- [ ] Error responses do not leak internal details

### Application
- [ ] Production build passes: `pnpm build`
- [ ] Lint passes: `pnpm lint`
- [ ] Type check passes: `pnpm typecheck`
- [ ] Unit tests pass: `pnpm test`
- [ ] Integration tests pass: `pnpm test:integration`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] API server starts and responds to health checks
- [ ] Web frontend builds and serves
- [ ] Worker orchestrator connects to Temporal
- [ ] Browser worker starts (if browser automation enabled)
- [ ] MCP gateway starts

### Operational Readiness
- [ ] Deployment runbook reviewed (docs/RUNBOOKS/deployment.md)
- [ ] Rollback plan documented and tested (ROLLBACK_PLAN.md)
- [ ] Incident response plan reviewed (docs/RUNBOOKS/incident-response.md)
- [ ] Backup/restore tested (BACKUP_RESTORE.md)
- [ ] On-call rotation established
- [ ] Monitoring/alerting configured for SLOs
- [ ] Log aggregation configured

## Post-Launch (First 24 Hours)
- [ ] Verify real user auth flow works
- [ ] Verify org creation and project setup
- [ ] Verify agent creation and run execution
- [ ] Monitor error rates and latency
- [ ] Verify audit events flowing correctly
- [ ] Check database connection pool utilization
- [ ] Verify billing metering produces correct usage events

## Post-Launch (First Week)
- [ ] Review audit log for anomalies
- [ ] Check billing accuracy against actual usage
- [ ] Review support diagnostics for any issues
- [ ] Verify backup/restore drill
- [ ] Review and tune rate limits based on actual traffic
