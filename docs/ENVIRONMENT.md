# SOVEREIGN Environment Configuration

> **Canonical variable contract**: See [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) for the full per-platform matrix.

## Required Environment Variables

### Core

| Variable             | Required | Default                                                         | Description                                               |
| -------------------- | -------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `NODE_ENV`           | Yes      | `development`                                                   | `production`, `test`, or `development`                    |
| `DATABASE_URL`       | Yes      | `postgresql://sovereign:sovereign_dev@localhost:5432/sovereign` | PostgreSQL connection string                              |
| `TEST_DATABASE_URL`  | No       | —                                                               | Dedicated PostgreSQL connection for integration/E2E tests |
| `DB_MAX_CONNECTIONS` | No       | `10`                                                            | Max connections in pool                                   |
| `DB_DEBUG`           | No       | `false`                                                         | Enable SQL query logging                                  |
| `PORT`               | No       | `3002`                                                          | API server port                                           |
| `HOST`               | No       | `0.0.0.0`                                                       | API server bind address                                   |
| `APP_BASE_URL`       | No       | —                                                               | Frontend URL (e.g. `https://app.sovereignos.dev`)         |
| `API_BASE_URL`       | No       | —                                                               | API public URL (e.g. `https://api.sovereignos.dev`)       |

### Authentication

| Variable              | Required              | Default      | Description                                                       |
| --------------------- | --------------------- | ------------ | ----------------------------------------------------------------- |
| `AUTH_MODE`           | Yes                   | `local`      | `local` (dev) or `workos` (production)                            |
| `SESSION_SECRET`      | Yes                   | Dev fallback | Cryptographic secret for session tokens (64+ chars in production) |
| `SESSION_TTL_MS`      | No                    | `86400000`   | Session lifetime in milliseconds (24h default)                    |
| `WORKOS_API_KEY`      | If `AUTH_MODE=workos` | —            | WorkOS API key                                                    |
| `WORKOS_CLIENT_ID`    | If `AUTH_MODE=workos` | —            | WorkOS client ID                                                  |
| `WORKOS_REDIRECT_URI` | If `AUTH_MODE=workos` | —            | OAuth callback URL                                                |

### Security

| Variable               | Required | Default        | Description                                                     |
| ---------------------- | -------- | -------------- | --------------------------------------------------------------- |
| `SOVEREIGN_SECRET_KEY` | Yes      | —              | AES-256-GCM key for connector credential encryption (32+ chars) |
| `CORS_ALLOWED_ORIGINS` | No       | `*` (dev only) | Comma-separated allowed origins                                 |

### Infrastructure

| Variable               | Required   | Default                  | Description                                 |
| ---------------------- | ---------- | ------------------------ | ------------------------------------------- |
| `REDIS_URL`            | No         | `redis://localhost:6379` | Redis connection string                     |
| `TEMPORAL_ADDRESS`     | No         | `localhost:7233`         | Temporal server address                     |
| `TEMPORAL_NAMESPACE`   | No         | `sovereign`              | Temporal namespace                          |
| `R2_ENDPOINT`          | Yes (prod) | `http://localhost:9000`  | Cloudflare R2 / MinIO endpoint              |
| `R2_BUCKET`            | Yes (prod) | `sovereign-dev`          | R2 bucket name                              |
| `R2_REGION`            | No         | `auto`                   | R2 region (always `auto` for Cloudflare R2) |
| `R2_ACCESS_KEY_ID`     | Yes (prod) | —                        | R2 S3-compatible access key                 |
| `R2_SECRET_ACCESS_KEY` | Yes (prod) | —                        | R2 S3-compatible secret key                 |

### Billing

| Variable                | Required           | Default | Description                   |
| ----------------------- | ------------------ | ------- | ----------------------------- |
| `STRIPE_SECRET_KEY`     | If billing enabled | —       | Stripe API key                |
| `STRIPE_WEBHOOK_SECRET` | If billing enabled | —       | Stripe webhook signing secret |

### Observability

| Variable     | Required | Default | Description                      |
| ------------ | -------- | ------- | -------------------------------- |
| `LOG_LEVEL`  | No       | `info`  | `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | No       | `json`  | `json` or `pretty`               |

## Production Enforcement

The API server **refuses to start** in production mode (`NODE_ENV=production`) if:

- `SESSION_SECRET` is not set — prevents accidental use of dev fallback
- `SOVEREIGN_SECRET_KEY` is not set — prevents running without encryption key

This is enforced at startup in `apps/api/src/index.ts`. There is no way to bypass this.

## Production Checklist

Before going live, verify:

1. `NODE_ENV=production`
2. `AUTH_MODE=workos` with valid WorkOS credentials
3. `SESSION_SECRET` is a unique, random 64+ character string (enforced at startup)
4. `SOVEREIGN_SECRET_KEY` is a unique, random 32+ character string
5. `DATABASE_URL` points to Railway Postgres (not localhost)
6. `CORS_ALLOWED_ORIGINS` is restricted to your production domains
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

## Local Integration Tests

Use a dedicated test DB connection contract:

```bash
export TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign
export DATABASE_URL="$TEST_DATABASE_URL"
pnpm test:integration
```

`TEST_DATABASE_URL` is preferred for test infrastructure. `DATABASE_URL` remains a supported fallback.
