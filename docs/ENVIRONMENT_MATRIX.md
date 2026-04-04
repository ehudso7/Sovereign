# ENVIRONMENT_MATRIX.md — SOVEREIGN Variable Contract

> **Canonical variable names.** Do not freestyle secret names.

---

## Consistent Variable Names

### GitHub / CI Secrets

| Variable | Scope | Description |
|----------|-------|-------------|
| `VERCEL_TOKEN` | Both | Vercel deploy token |
| `VERCEL_ORG_ID` | Both | Vercel team/org ID |
| `VERCEL_PROJECT_ID_WEB_STAGING` | staging | Vercel project ID for web staging |
| `VERCEL_PROJECT_ID_WEB_PRODUCTION` | production | Vercel project ID for web production |
| `VERCEL_PROJECT_ID_DOCS_STAGING` | staging | Vercel project ID for docs staging |
| `VERCEL_PROJECT_ID_DOCS_PRODUCTION` | production | Vercel project ID for docs production |
| `RAILWAY_TOKEN` | Both | Railway deploy token |
| `WORKOS_API_KEY_STAGING` | staging | WorkOS API key (staging) |
| `WORKOS_API_KEY_PRODUCTION` | production | WorkOS API key (production) |
| `WORKOS_CLIENT_ID_STAGING` | staging | WorkOS client ID (staging) |
| `WORKOS_CLIENT_ID_PRODUCTION` | production | WorkOS client ID (production) |
| `R2_ACCESS_KEY_ID_STAGING` | staging | Cloudflare R2 access key (staging) |
| `R2_SECRET_ACCESS_KEY_STAGING` | staging | Cloudflare R2 secret key (staging) |
| `R2_ACCESS_KEY_ID_PRODUCTION` | production | Cloudflare R2 access key (production) |
| `R2_SECRET_ACCESS_KEY_PRODUCTION` | production | Cloudflare R2 secret key (production) |
| `SOVEREIGN_SECRET_KEY_STAGING` | staging | Credential encryption key (staging) |
| `SOVEREIGN_SECRET_KEY_PRODUCTION` | production | Credential encryption key (production) |

### GitHub / CI Variables (non-secret)

| Variable | staging | production |
|----------|---------|------------|
| `APP_ENV` | `staging` | `production` |
| `AUTH_MODE` | `workos` | `workos` |
| `APP_BASE_URL_STAGING` | `https://staging.sovereign.app` | — |
| `APP_BASE_URL_PRODUCTION` | — | `https://app.sovereign.app` |
| `API_BASE_URL_STAGING` | `https://api-staging.sovereign.app` | — |
| `API_BASE_URL_PRODUCTION` | — | `https://api.sovereign.app` |
| `DOCS_BASE_URL_STAGING` | `https://docs-staging.sovereign.app` | — |
| `DOCS_BASE_URL_PRODUCTION` | — | `https://docs.sovereign.app` |
| `R2_BUCKET_STAGING` | `sovereign-staging-artifacts` | — |
| `R2_BUCKET_PRODUCTION` | — | `sovereign-production-artifacts` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | same |
| `R2_REGION` | `auto` | `auto` |

---

## A. Vercel — `apps/web`

Set in Vercel dashboard per environment scope (Preview / Production).

### Non-secret

| Variable | Staging | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_APP_ENV` | `staging` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://staging.sovereign.app` | `https://app.sovereign.app` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api-staging.sovereign.app` | `https://api.sovereign.app` |
| `NEXT_PUBLIC_AUTH_MODE` | `workos` | `workos` |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | `https://api-staging.sovereign.app/api/v1/auth/callback` | `https://api.sovereign.app/api/v1/auth/callback` |

### Secrets (if needed at build/runtime)

| Variable | Description |
|----------|-------------|
| `WORKOS_CLIENT_ID` | WorkOS client ID (server-side) |
| `SESSION_SECRET` | Session signing key (if web has server components) |

---

## B. Vercel — `apps/docs`

| Variable | Staging | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_DOCS_ENV` | `staging` | `production` |

Docs typically needs no secrets.

---

## C. Railway — Shared Backend Variables

Set these for **all** Railway backend services: `api`, `worker-orchestrator`, `worker-browser`, `gateway-mcp`.

### Secrets

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Railway Postgres | Auto-provided by Railway Postgres addon |
| `REDIS_URL` | Railway Redis | Auto-provided by Railway Redis addon |
| `SOVEREIGN_SECRET_KEY` | Generated | AES-256-GCM key for credential encryption (32+ chars) |
| `WORKOS_API_KEY` | WorkOS dashboard | WorkOS API key |
| `WORKOS_CLIENT_ID` | WorkOS dashboard | WorkOS client ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | R2 S3-compatible secret key |
| `TEMPORAL_ADDRESS` | Temporal Cloud or Railway | Temporal gRPC address |
| `TEMPORAL_NAMESPACE` | Temporal Cloud or Railway | Temporal namespace name |
| `SESSION_SECRET` | Generated | JWT/session signing secret (64+ chars) |
| `OPENAI_API_KEY` | OpenAI platform | AI runtime API key |
| `STRIPE_SECRET_KEY` | Stripe dashboard | Billing API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook | Webhook signing secret |

### Non-secret

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Runtime mode |
| `AUTH_MODE` | `workos` | Auth provider |
| `APP_ENV` | `staging` or `production` | Logical environment |
| `APP_BASE_URL` | `https://staging.sovereign.app` | Frontend URL |
| `API_BASE_URL` | `https://api-staging.sovereign.app` | API public URL |
| `CORS_ALLOWED_ORIGINS` | `https://staging.sovereign.app` | Comma-separated allowed CORS origins |
| `R2_BUCKET` | `sovereign-staging-artifacts` | R2 bucket name |
| `R2_REGION` | `auto` | Always `auto` for R2 |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | R2 S3-compatible endpoint |
| `WORKOS_REDIRECT_URI` | `https://api-staging.sovereign.app/api/v1/auth/callback` | OAuth callback |
| `WORKOS_LOGOUT_REDIRECT_URI` | `https://staging.sovereign.app` | Post-logout redirect |
| `WORKOS_LOGIN_ENDPOINT` | `/api/v1/auth/login` | Login initiation path |
| `LOG_LEVEL` | `info` | Log verbosity |

---

## D. Railway — Service-Specific Extras

### API (`apps/api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | HTTP listen port |
| `HOST` | `0.0.0.0` | Bind address |

### Worker-Orchestrator (`apps/worker-orchestrator`)

| Variable | Description |
|----------|-------------|
| `TEMPORAL_TASK_QUEUE` | Task queue name (default: `sovereign-main`) |
| `WORKER_MAX_CONCURRENT_ACTIVITIES` | Max concurrent activity executions |
| `WORKER_MAX_CONCURRENT_WORKFLOWS` | Max concurrent workflow executions |

### Worker-Browser (`apps/worker-browser`)

| Variable | Description |
|----------|-------------|
| `BROWSER_ARTIFACT_RETENTION_DAYS` | Days to retain browser session artifacts |

### Gateway-MCP (`apps/gateway-mcp`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | HTTP listen port |
| `GATEWAY_INTERNAL_AUTH_TOKEN` | — | Internal service-to-service auth token |

---

## E. WorkOS Dashboard Config

Set these in the WorkOS dashboard for each environment:

| Setting | Staging | Production |
|---------|---------|------------|
| Redirect URI | `https://api-staging.sovereign.app/api/v1/auth/callback` | `https://api.sovereign.app/api/v1/auth/callback` |
| Logout Redirect URI | `https://staging.sovereign.app` | `https://app.sovereign.app` |
| Login Endpoint | `https://staging.sovereign.app/api/v1/auth/login` | `https://app.sovereign.app/api/v1/auth/login` |

---

## F. Cloudflare R2 Config

| Setting | Staging | Production |
|---------|---------|------------|
| Bucket name | `sovereign-staging-artifacts` | `sovereign-production-artifacts` |
| Endpoint | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | same |
| Region | `auto` | `auto` |
| API token permissions | Object Read & Write | Object Read & Write |
| Bucket scope | Specific bucket only | Specific bucket only |

---

## G. Temporal Config

### Temporal Cloud

| Variable | Example |
|----------|---------|
| `TEMPORAL_ADDRESS` | `sovereign-prod.xxxxx.tmprl.cloud:7233` |
| `TEMPORAL_NAMESPACE` | `sovereign-prod` |
| `TEMPORAL_TLS_CERT` | Base64-encoded mTLS cert |
| `TEMPORAL_TLS_KEY` | Base64-encoded mTLS key |

### Railway-hosted Temporal (launch shortcut)

| Variable | Example |
|----------|---------|
| `TEMPORAL_ADDRESS` | Railway internal address (e.g. `temporal.railway.internal:7233`) |
| `TEMPORAL_NAMESPACE` | `default` |

---

## H. Local Test Contract (`.env.test.example`)

```
TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@127.0.0.1:5432/sovereign
DATABASE_URL=postgresql://sovereign:sovereign_dev@127.0.0.1:5432/sovereign
REDIS_URL=redis://127.0.0.1:6379
SOVEREIGN_SECRET_KEY=test-secret-key-for-testing-32chars!!
```

This is the **local truth contract**, not the staging/prod truth contract.

---

## Rules

1. **Never** put real secret values in committed files
2. **Always** use the exact variable names from this document
3. Local test env is separate from staging/prod
4. GitHub environment secrets are only exposed to jobs referencing that environment
5. Vercel env changes apply to new deployments only
6. Railway Postgres/Redis auto-expose `DATABASE_URL` and `REDIS_URL`
7. WorkOS production redirect URIs must be HTTPS
8. R2 region is always `auto`
