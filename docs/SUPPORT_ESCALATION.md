# SOVEREIGN Support Escalation Guide

## Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|---------------|------------|
| **P0 — Critical** | Platform down, data loss risk, security breach | < 15 min | Immediate page to on-call |
| **P1 — High** | Major feature broken, significant user impact | < 1 hour | On-call engineer |
| **P2 — Medium** | Degraded performance, workaround exists | < 4 hours | Engineering queue |
| **P3 — Low** | Minor issue, cosmetic, feature request | < 24 hours | Backlog |

## Escalation Paths

### P0 — Platform Down
1. Check API health: `GET /api/v1/health`
2. Check database: `psql -c "SELECT 1;"`
3. Check Temporal: `tctl namespace describe sovereign`
4. Check logs for crash/OOM
5. If database: follow BACKUP_RESTORE.md
6. If application: follow ROLLBACK_PLAN.md
7. If infrastructure: escalate to infrastructure team

### P1 — Feature Broken
1. Identify affected feature via support diagnostics (`GET /api/v1/support/diagnostics`)
2. Check audit trail for recent changes (`GET /api/v1/policies/audit`)
3. Check run failure logs via mission control
4. Reproduce in staging if possible
5. Hot-fix or rollback per ROLLBACK_PLAN.md

### P2/P3 — Degraded / Minor
1. Document issue
2. Check if known issue
3. Add to engineering backlog
4. Communicate timeline to affected users

## Diagnostic Tools

### Support Diagnostics Endpoint
```
GET /api/v1/support/diagnostics
Authorization: Bearer <admin-token>
```

Returns:
- Agent count and status
- Recent run failures
- Connector health
- Alert summary
- Billing status
- Browser session status

**Important**: All sensitive values are redacted in diagnostic output.

### Admin Overview
```
GET /api/v1/admin/overview
Authorization: Bearer <admin-token>
```

Returns:
- Membership count
- Policy count
- Settings summary

### Mission Control
```
GET /api/v1/mission-control/overview
Authorization: Bearer <token>
```

Returns:
- Run metrics (total, success rate, failure rate)
- Active alerts
- Recent failures

## Common Issues

### "User cannot sign in"
1. Check `AUTH_MODE` configuration
2. Verify WorkOS status (if production)
3. Check session table for expired sessions
4. Verify user exists in `users` table and has membership

### "Agent runs are stuck"
1. Check Temporal workers: `tctl workflow list --namespace sovereign`
2. Check for policy blocks: quarantine or deny policies active?
3. Check billing: has the org exceeded plan limits?
4. Check worker logs for errors

### "Connector test fails"
1. Verify connector credentials are configured
2. Check credential encryption key (`SOVEREIGN_SECRET_KEY`)
3. Check external service availability
4. Review connector install status

### "Mission Control shows no data"
1. Verify runs have been created and completed
2. Check database connectivity
3. Check tenant context — user must be in correct org

## Contact

- Engineering on-call: Check rotation schedule
- Infrastructure: Check #infra-alerts channel
- Security: Check #security channel for any active advisories
