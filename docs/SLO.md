# SOVEREIGN Service Level Objectives (SLOs)

## API Availability

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% (monthly) | Health check success rate |
| API availability | 99.5% (monthly) | Non-5xx response rate |

## API Latency

| Endpoint Category | p50 | p95 | p99 |
|-------------------|-----|-----|-----|
| Health check | < 10ms | < 50ms | < 100ms |
| Auth (login/me) | < 100ms | < 300ms | < 500ms |
| Agent CRUD | < 100ms | < 300ms | < 500ms |
| Run creation | < 200ms | < 500ms | < 1s |
| Run listing | < 100ms | < 300ms | < 500ms |
| Mission Control overview | < 200ms | < 500ms | < 1s |
| Memory search | < 200ms | < 500ms | < 1s |
| Connector operations | < 200ms | < 500ms | < 1s |
| Billing/usage queries | < 100ms | < 300ms | < 500ms |

## Run Engine

| Metric | Target |
|--------|--------|
| Run queue wait time | < 30s (p95) |
| Run start-to-completion | < 5 min for simple tasks (p95) |
| Run success rate | > 95% (excluding user-cancelled) |
| Failed run retry rate | 100% (auto-retry once on transient failure) |

## Data Integrity

| Metric | Target |
|--------|--------|
| Audit event capture rate | 100% of state-changing operations |
| Tenant isolation violations | 0 |
| Secret exposure incidents | 0 |

## Operational

| Metric | Target |
|--------|--------|
| Deployment success rate | > 95% |
| Rollback completion time | < 5 minutes |
| Incident response (P0) | < 15 minutes to acknowledge |
| Backup success rate | 100% |
| Recovery point objective (RPO) | < 24 hours (daily backup), < 5 min (WAL) |
| Recovery time objective (RTO) | < 1 hour |

## Day-1 Alert Thresholds

| Alert | Condition | Severity |
|-------|-----------|----------|
| API down | Health check fails 3x in 1 min | P0 — Critical |
| Error rate spike | > 5% 5xx responses in 5 min | P1 — High |
| Latency spike | p95 > 2s for 5 min | P1 — High |
| Database pool exhaustion | Available connections < 2 | P1 — High |
| Run queue backlog | > 100 queued runs for 10 min | P2 — Medium |
| Disk usage | > 85% on any volume | P2 — Medium |
| Failed backup | Backup job fails | P1 — High |
| Certificate expiry | < 14 days to expiration | P2 — Medium |

## Monitoring

These SLOs should be monitored via:
- Application-level health checks (`GET /api/v1/health`)
- Structured JSON logs with request latency
- PostgreSQL connection pool metrics
- Temporal workflow metrics (queue depth, execution time)
- Alert events in the SOVEREIGN alert system itself
