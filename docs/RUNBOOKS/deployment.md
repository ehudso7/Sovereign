# Runbook: Deployment

## Pre-Deployment Checklist

- [ ] All CI checks passing on main
- [ ] E2E tests passing
- [ ] No P0/P1 open issues
- [ ] Database migrations reviewed
- [ ] Environment variables confirmed
- [ ] Rollback plan documented

## Deployment Process

### Staging

1. Merge PR to main
2. CI pipeline runs full suite
3. Auto-deploy to staging
4. Smoke test critical paths
5. Sign off on staging

### Production

1. Tag release: `git tag v<version>`
2. Push tag: `git push origin v<version>`
3. CI builds production artifacts
4. Deploy to production with rolling update
5. Monitor health checks for 15 minutes
6. Verify key metrics in dashboards

## Rollback

1. Identify the last known good version
2. Deploy previous version tag
3. Verify rollback via health checks
4. If database migration involved: run down migration first
5. Notify stakeholders

## Environment Variables

See `packages/config/src/env.ts` for all required environment variables and their validation schemas.

## Database Migrations

- Run migrations before deploying new code
- Ensure migrations are backward-compatible (old code can run with new schema)
- If destructive migration needed: deploy in two phases
  1. Deploy code that works with both schemas
  2. Run migration
  3. Deploy code that assumes new schema
