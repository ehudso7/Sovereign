# SOVEREIGN Rollback Plan

## Rollback Triggers

Initiate rollback if any of the following occur after a deployment:

- API health check fails for > 2 minutes
- Error rate exceeds 5% of requests
- P0/P1 incident within 30 minutes of deploy
- Database migration fails mid-apply
- Auth flow broken for any user

## Rollback Procedure

### 1. Application Rollback

Frontend rollback:

1. Promote the last known good Vercel deployment for `apps/web` and `apps/docs`.
2. Use `.github/workflows/rollback.yml` or run `vercel promote <deployment-url>`.

Backend rollback:

1. Open Railway and select the target environment.
2. For each backend service (`sovereign-api`, `sovereign-worker-orchestrator`, `sovereign-worker-browser`, `sovereign-gateway-mcp`), open `Deployments`.
3. Roll back each service to the last known good deployment.
4. Verify `GET /health` returns `200` after the rollback.

### 2. Database Migration Rollback

All migrations are designed to be reversible.

```bash
# Check current migration version
pnpm --filter @sovereign/db migrate:status

# Roll back the last migration
pnpm --filter @sovereign/db migrate:down

# Verify schema state
pnpm --filter @sovereign/db migrate:status
```

**Critical**: Always verify data integrity after rolling back a migration.

### 3. Zero-Downtime Rollback (Blue-Green)

Vercel handles traffic switching when promoting a previous deployment. Railway rollback is per-service and should be performed in this order:

1. `sovereign-gateway-mcp`
2. `sovereign-worker-browser`
3. `sovereign-worker-orchestrator`
4. `sovereign-api`

### 4. Worker/Orchestrator Rollback

Temporal workflows are durable. Rolling back the worker:

1. Stop current worker instances
2. Deploy previous worker version
3. Workers will pick up pending workflows automatically
4. Verify no workflow state corruption via Temporal UI

### 5. Post-Rollback Verification

After rolling back:

- [ ] Health check passes: `curl <api-base-url>/health`
- [ ] Auth flow works (sign in, sign out)
- [ ] Agent listing returns data
- [ ] Run creation works
- [ ] Mission control overview loads
- [ ] No new error spikes in logs
- [ ] Database connections stable

## Rollback Communication

1. Post in #incidents channel: "Rolling back deployment <version>"
2. Update status page if public-facing
3. Notify on-call engineer
4. File incident report after stabilization

## Prevention

- Always deploy to staging first
- Run full E2E suite against staging before production
- Use feature flags for risky changes
- Keep deployments small and frequent
- Maintain the ability to roll back within 5 minutes
