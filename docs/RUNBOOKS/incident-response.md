# Runbook: Incident Response

## Severity Classification

| Severity | Examples | Response Time |
|----------|---------|---------------|
| P0 | Data breach, tenant isolation failure, auth bypass | Immediate |
| P1 | Privilege escalation, data exposure | < 1 hour |
| P2 | Policy bypass, non-critical vulnerability | < 4 hours |
| P3 | Minor bug, cosmetic issue | < 24 hours |

## Initial Response

1. **Detect**: Alert fires or report received
2. **Classify**: Determine severity level
3. **Communicate**: Notify on-call and stakeholders per severity
4. **Contain**: Isolate affected systems if needed

## P0 Response

1. Page on-call engineer immediately
2. Open incident channel
3. If data breach: isolate affected tenant data
4. If auth bypass: rotate all session tokens
5. If tenant isolation: disable affected endpoints
6. Begin root cause analysis
7. Deploy fix or hotfix
8. Verify fix in production
9. Write post-incident report within 24 hours

## Worker Failure Recovery

1. Check Temporal UI for workflow status
2. If worker crashed: Temporal will auto-retry on new worker
3. If workflow stuck: check for signal/query handler errors
4. If persistent failure: cancel workflow, investigate root cause

## Database Recovery

1. Check connection pool status
2. If connection exhaustion: restart affected service, investigate leak
3. If data corruption: stop writes, assess damage, restore from backup
4. If migration failure: run down migration, fix issue, retry

## Deployment Rollback

1. Identify failing release version
2. Run: `deploy rollback <service> <previous-version>`
3. Verify rollback via health checks
4. Investigate failure before re-deploying
