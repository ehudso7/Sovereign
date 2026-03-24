# SOVEREIGN Environment Configuration

## Required Environment Variables

### Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `production`, `staging`, or `development` |
| `DATABASE_URL` | Yes | `postgresql://sovereign:sovereign_dev@localhost:5432/sovereign` | PostgreSQL connection string |
| `DB_MAX_CONNECTIONS` | No | `10` | Max connections in pool |
| `DB_DEBUG` | No | `false` | Enable SQL query logging |
| `PORT` | No | `3002` | API server port |
| `HOST` | No | `0.0.0.0` | API server bind address |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_MODE` | Yes | `local` | `local` (dev) or `workos` (production) |
| `SESSION_SECRET` | Yes | Dev fallback | Cryptographic secret for session tokens (64+ chars in production) |
| `SESSION_TTL_MS` | No | `86400000` | Session lifetime in milliseconds (24h default) |
| `WORKOS_API_KEY` | If `AUTH_MODE=workos` | — | WorkOS API key |
| `WORKOS_CLIENT_ID` | If `AUTH_MODE=workos` | — | WorkOS client ID |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOVEREIGN_SECRET_KEY` | Yes | — | AES-256-GCM key for connector credential encryption (32+ chars) |
| `CORS_ORIGINS` | No | `*` (dev only) | Comma-separated allowed origins |

### Infrastructure

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `TEMPORAL_ADDRESS` | No | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | No | `sovereign` | Temporal namespace |
| `S3_ENDPOINT` | No | `http://localhost:9000` | S3/MinIO endpoint |
| `S3_BUCKET` | No | `sovereign-artifacts` | S3 bucket name |
| `S3_ACCESS_KEY` | If using S3 | — | S3 access key |
| `S3_SECRET_KEY` | If using S3 | — | S3 secret key |

### Billing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | If billing enabled | — | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | If billing enabled | — | Stripe webhook signing secret |

### Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | No | `json` | `json` or `pretty` |

## Production Checklist

Before going live, verify:

1. `NODE_ENV=production`
2. `AUTH_MODE=workos` with valid WorkOS credentials
3. `SESSION_SECRET` is a unique, random 64+ character string (not the dev fallback)
4. `SOVEREIGN_SECRET_KEY` is a unique, random 32+ character string
5. `DATABASE_URL` points to production PostgreSQL (not localhost)
6. `CORS_ORIGINS` is restricted to your production domains
7. `LOG_LEVEL=info` (not debug in production)
8. All `*_SECRET_KEY` vars are stored in a secrets manager, not in code or CI logs

## Local Development

For local development, the defaults are sufficient. Start infrastructure:

```bash
cd infra/docker && docker compose up -d
```

Then set minimal env:

```bash
export DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign
export AUTH_MODE=local
export SOVEREIGN_SECRET_KEY=dev-secret-key-for-local-testing-only-32ch
```
