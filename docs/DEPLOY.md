# DEPLOY.md — SOVEREIGN Production Deployment Guide

## Architecture Overview

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
│  │       │          │          │           │                  │       │
│  │  ┌────▼────┐ ┌───▼────┐ ┌──▼────────┐                     │       │
│  │  │Postgres │ │ Redis  │ │ Temporal  │                     │       │
│  │  │(Railway)│ │(Railway)│ │(Cloud/Rw.)│                     │       │
│  │  └─────────┘ └────────┘ └───────────┘                     │       │
│  └────────────────────────────────────────────────────────────┘       │
│              │                           │                           │
│  ┌───────────▼──────┐        ┌───────────▼──────────┐                │
│  │  WorkOS          │        │  Cloudflare R2       │                │
│  │  (Auth/SSO)      │        │  (Artifact Storage)  │                │
│  └──────────────────┘        └──────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

> **Canonical references**: See [PLATFORM_MAP.md](./PLATFORM_MAP.md) for topology and [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) for the full variable contract.

---

## Stack

| Layer | Platform | Why |
|-------|----------|-----|
| Frontend | Vercel | Env scopes (Production/Preview/Development), CDN, Next.js native |
| Backend | Railway | Long-running services, standard `DATABASE_URL`/`REDIS_URL` vars |
| Database | Railway Postgres | Co-located with backend, auto-exposed connection vars |
| Cache | Railway Redis | Co-located with backend, auto-exposed `REDIS_URL` |
| Auth | WorkOS | SSO/SCIM/RBAC, production requires HTTPS redirect URIs |
| Storage | Cloudflare R2 | S3-compatible, account endpoint, region `auto` |
| Orchestration | Temporal | Cloud preferred; Railway-hosted as launch shortcut |
| CI/CD | GitHub Actions | Environment secrets, protection rules, artifact uploads |

---

## Cost Summary

| Service | Tier | Monthly |
|---------|------|---------|
| Vercel | Pro | $20 |
| Railway | Pro (4 services + Postgres + Redis) | $30–60 |
| Cloudflare R2 | Pay-as-you-go | ~$5 |
| WorkOS | Free tier | $0 |
| Temporal Cloud | Default namespace | $100 |
| **Total** | | **~$155–185** |

---

## Human Setup Order

Complete in this order or you will waste time.

### Step 1 — GitHub Environments

1. Go to repo **Settings → Environments**
2. Create `staging` — add secrets and variables per [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)
3. Create `production` — same shape, production values, **add required reviewers**

### Step 2 — Railway Project

1. Create project on [railway.app](https://railway.app)
2. Deploy from templates: **Postgres**, **Redis**
3. Create services from GitHub repo:
   - `sovereign-api` (Dockerfile: `infra/docker/Dockerfile.api`, port 3002, healthcheck `/health`)
   - `sovereign-worker-orchestrator` (Dockerfile: `infra/docker/Dockerfile.worker-orchestrator`, no port)
   - `sovereign-worker-browser` (Dockerfile: `infra/docker/Dockerfile.worker-browser`, no port)
   - `sovereign-gateway-mcp` (Dockerfile: `infra/docker/Dockerfile.gateway-mcp`, port 3003, internal only)
4. If not using Temporal Cloud, deploy Temporal from template
5. Set shared variables per [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)
6. Railway auto-exposes: `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `REDIS_URL`, `REDISHOST`, `REDISPORT`

### Step 3 — Vercel Projects

1. Create 4 projects on [vercel.com](https://vercel.com):
   - `sovereign-web-staging` / `sovereign-web-prod` (root: `apps/web`)
   - `sovereign-docs-staging` / `sovereign-docs-prod` (root: `apps/docs`)
2. Configure env vars per environment scope (Preview / Production)
3. Get tokens: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, project IDs

### Step 4 — WorkOS

1. Create `sovereign-staging` and `sovereign-production` environments
2. Set redirect URIs (must be HTTPS for production)
3. Get `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` for each

### Step 5 — Cloudflare R2

1. Create buckets: `sovereign-staging-artifacts`, `sovereign-production-artifacts`
2. Create API tokens (Object Read & Write, scoped to specific bucket)
3. Record: `ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
4. Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### Step 6 — Temporal

- **Temporal Cloud** (preferred): Create namespace, generate mTLS certs
- **Railway-hosted** (launch shortcut): Deploy Temporal template, document as temporary

---

## Deploy Commands

### Via GitHub Actions (recommended)

```bash
# Deploy staging
gh workflow run deploy.yml -f environment=staging

# Deploy production (requires environment protection approval)
gh workflow run deploy.yml -f environment=production
```

### Rollback

```bash
# Rollback via GitHub Actions
gh workflow run rollback.yml -f environment=staging -f reason="describe issue"
```

Railway backend rollback is done through the Railway dashboard (Service → Deployments → Rollback).

---

## Verification

```bash
# API health check
curl https://api-staging.sovereign.app/health

# Web app
curl -s -o /dev/null -w "%{http_code}" https://staging.sovereign.app

# Docs
curl -s -o /dev/null -w "%{http_code}" https://docs-staging.sovereign.app
```

---

## Monitoring

| Service | Where |
|---------|-------|
| API, Workers, Gateway | Railway Dashboard → Service → Logs |
| Web, Docs | Vercel Dashboard → Deployments → Logs |
| Database | Railway Dashboard → Postgres → Metrics |
| Redis | Railway Dashboard → Redis → Metrics |
| Workflows | Temporal Cloud UI or Railway Temporal UI |
| Auth | WorkOS Dashboard → Events |
| Billing | Stripe Dashboard → Events |

---

## Release Evidence

All launch evidence is saved to `docs/release-evidence/YYYY-MM-DD-launch/`. See the folder structure for required artifacts per the operating packet.
