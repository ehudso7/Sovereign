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

```bash
# Stop current deployment
pm2 stop sovereign-api sovereign-web sovereign-worker-orchestrator sovereign-worker-browser sovereign-gateway-mcp

# Or with containers:
docker compose down

# Redeploy previous version
git checkout <previous-release-tag>
pnpm install --frozen-lockfile
pnpm build

# Restart services
pm2 start ecosystem.config.js
# Or: docker compose up -d
```

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

If using blue-green deployment:
1. Route traffic back to the blue (previous) environment
2. Verify blue environment health
3. Keep green (failed) environment running for debugging
4. Investigate root cause before retrying

### 4. Worker/Orchestrator Rollback

Temporal workflows are durable. Rolling back the worker:
1. Stop current worker instances
2. Deploy previous worker version
3. Workers will pick up pending workflows automatically
4. Verify no workflow state corruption via Temporal UI

### 5. Post-Rollback Verification

After rolling back:
- [ ] Health check passes: `curl /api/v1/health`
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
