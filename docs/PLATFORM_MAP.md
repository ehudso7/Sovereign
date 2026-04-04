# PLATFORM_MAP.md — SOVEREIGN Deployment Topology

> **Source of truth** for which services run where. Do not freestyle.

## Stack Overview

| Layer | Platform | Services |
|-------|----------|----------|
| Frontend | **Vercel** | `apps/web`, `apps/docs` |
| Backend | **Railway** | `apps/api`, `apps/worker-orchestrator`, `apps/worker-browser`, `apps/gateway-mcp` |
| Database | **Railway Postgres** | PostgreSQL 16 |
| Cache | **Railway Redis** | Redis 7 |
| Auth | **WorkOS** | SSO, SCIM, RBAC |
| Object Storage | **Cloudflare R2** | S3-compatible artifact storage |
| Orchestration | **Temporal** | Temporal Cloud or Railway-hosted Temporal |
| CI/CD | **GitHub Actions** | CI, deploy, smoke, rollback, release evidence |

---

## Vercel Projects

| Project | App | Environment | Branch Target |
|---------|-----|-------------|---------------|
| `sovereign-web-staging` | `apps/web` | Staging | Preview deploys / staging branch |
| `sovereign-web-prod` | `apps/web` | Production | `main` production deploy |
| `sovereign-docs-staging` | `apps/docs` | Staging | Preview deploys / staging branch |
| `sovereign-docs-prod` | `apps/docs` | Production | `main` production deploy |

Vercel supports Production, Preview, Development, and custom environment scopes for env vars.

---

## Railway Services

### Staging Environment

| Service | App | Port | Healthcheck | Dockerfile |
|---------|-----|------|-------------|------------|
| `api-staging` | `apps/api` | 3002 | `/health` | `infra/docker/Dockerfile.api` |
| `worker-orchestrator-staging` | `apps/worker-orchestrator` | — (background) | — | `infra/docker/Dockerfile.worker-orchestrator` |
| `worker-browser-staging` | `apps/worker-browser` | — (background) | — | `infra/docker/Dockerfile.worker-browser` |
| `gateway-mcp-staging` | `apps/gateway-mcp` | 3003 (internal) | — | `infra/docker/Dockerfile.gateway-mcp` |
| `postgres-staging` | Railway template | 5432 | pg_isready | — |
| `redis-staging` | Railway template | 6379 | redis-cli ping | — |
| `temporal-staging` | Railway template (if not using Temporal Cloud) | 7233 | — | — |

### Production Environment

Clone staging topology or use Railway environment separation. Same service names with `-production` suffix.

Railway exposes standard connection vars:
- **Postgres**: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `DATABASE_URL`
- **Redis**: `REDISHOST`, `REDISPORT`, `REDISUSER`, `REDISPASSWORD`, `REDIS_URL`

---

## WorkOS

| Environment | Redirect URI | Logout Redirect URI |
|-------------|-------------|---------------------|
| `sovereign-staging` | `https://api-staging.sovereignos.dev/api/v1/auth/callback` | `https://staging.sovereignos.dev` |
| `sovereign-production` | `https://api.sovereignos.dev/api/v1/auth/callback` | `https://app.sovereignos.dev` |

> Production redirect URIs **must** be HTTPS. WorkOS does not allow `http` or `localhost` in production.

---

## Cloudflare R2

| Bucket | Environment | Endpoint |
|--------|-------------|----------|
| `sovereign-staging-artifacts` | Staging | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `sovereign-production-artifacts` | Production | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

- R2 is S3-compatible — uses `@aws-sdk/client-s3`
- Region is always `auto` (`us-east-1` alias works for compatibility)
- Endpoint pattern: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## GitHub Environments

| Environment | Secrets | Protection Rules |
|-------------|---------|-----------------|
| `staging` | Deploy tokens, staging service credentials | None (auto-deploy OK) |
| `production` | Deploy tokens, production service credentials | **Required reviewers** |

Environment-specific secrets are only exposed to jobs that reference that environment. Non-sensitive config uses GitHub Actions variables.

---

## Temporal

| Option | Address | Config |
|--------|---------|--------|
| **Temporal Cloud** (preferred) | `<namespace>.tmprl.cloud:7233` | mTLS certificates required |
| **Railway-hosted** (launch shortcut) | Railway internal networking | Accepted temporary architecture |

If using Railway-hosted Temporal, document this as a temporary choice with a clear migration path to Temporal Cloud.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                    │
├──────────────┬──────────────┬────────────────────────────────────────┤
│              │              │                                        │
│  ┌───────────▼──────┐  ┌───▼────────────┐                           │
│  │  Vercel CDN       │  │  Vercel CDN    │                           │
│  │  apps/web         │  │  apps/docs     │                           │
│  │  (Next.js)        │  │  (Next.js)     │                           │
│  └───────────┬───────┘  └────────────────┘                           │
│              │ API calls                                             │
│  ┌───────────▼───────────────────────────────────────────────┐       │
│  │                     Railway                                │       │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐      │       │
│  │  │ API      │  │ Worker       │  │ Worker           │      │       │
│  │  │ :3002    │  │ Orchestrator │  │ Browser          │      │       │
│  │  │ Fastify  │  │ Temporal     │  │ Playwright       │      │       │
│  │  └────┬─────┘  └──────┬───────┘  └──────┬──────────┘      │       │
│  │       │               │                  │                 │       │
│  │  ┌────▼───────────────▼──────────────────▼──────────┐      │       │
│  │  │ Gateway MCP :3003 (internal)                      │      │       │
│  │  └──────────────────────────────────────────────────┘      │       │
│  │       │               │                  │                 │       │
│  │  ┌────▼────┐    ┌─────▼─────┐    ┌───────▼────────┐       │       │
│  │  │Postgres │    │  Redis    │    │  Temporal      │       │       │
│  │  │ (Rail.) │    │  (Rail.)  │    │  (Cloud/Rail.) │       │       │
│  │  └─────────┘    └───────────┘    └────────────────┘       │       │
│  └────────────────────────────────────────────────────────────┘       │
│              │                           │                           │
│  ┌───────────▼──────┐        ┌───────────▼──────────┐                │
│  │  WorkOS          │        │  Cloudflare R2       │                │
│  │  (Auth/SSO)      │        │  (Artifact Storage)  │                │
│  └──────────────────┘        └──────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Human Setup Order

Complete these in order:

1. **GitHub Environments** — Create `staging` and `production` with secrets/variables
2. **Railway Project** — Deploy Postgres, Redis, API, workers, gateway, (Temporal if needed)
3. **Vercel Projects** — Link `apps/web` and `apps/docs`, configure env scopes
4. **WorkOS** — Set redirect/logout URIs for staging and production
5. **Cloudflare R2** — Create buckets and S3 API credentials
6. **Temporal** — Use Cloud if available, otherwise Railway-hosted

---

## Cost Estimate

| Service | Tier | Monthly |
|---------|------|---------|
| Vercel | Pro | $20 |
| Railway | Pro (4 services + Postgres + Redis) | $30–60 |
| Cloudflare R2 | Pay-as-you-go | ~$5 |
| WorkOS | Free tier | $0 |
| Temporal Cloud | Default namespace | $100 |
| **Total** | | **~$155–185** |
