# DEPLOY.md — SOVEREIGN Production Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERNET                                     │
├──────────────┬──────────────┬───────────────────────────────────────┤
│              │              │                                       │
│  ┌───────────▼──────┐  ┌───▼────────────┐                          │
│  │  Vercel CDN       │  │  Vercel CDN    │                          │
│  │  apps/web         │  │  apps/docs     │                          │
│  │  (Next.js)        │  │  (Next.js)     │                          │
│  └───────────┬───────┘  └────────────────┘                          │
│              │ API calls                                            │
│  ┌───────────▼──────────────────────────────────────────────┐       │
│  │                    Railway                                │       │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐     │       │
│  │  │ API      │  │ Worker       │  │ Worker           │     │       │
│  │  │ :3002    │  │ Orchestrator │  │ Browser          │     │       │
│  │  │ Fastify  │  │ Temporal     │  │ Playwright       │     │       │
│  │  └────┬─────┘  └──────┬───────┘  └──────┬──────────┘     │       │
│  │       │               │                  │                │       │
│  │  ┌────▼───────────────▼──────────────────▼──────────┐     │       │
│  │  │ Gateway MCP :3003                                 │     │       │
│  │  └──────────────────────────────────────────────────┘     │       │
│  └───────────────────────────────────────────────────────────┘       │
│              │              │              │           │             │
│  ┌───────────▼──┐  ┌───────▼──────┐  ┌───▼────┐  ┌──▼──────────┐  │
│  │ Neon         │  │ Temporal     │  │ Upstash│  │ Cloudflare  │  │
│  │ PostgreSQL   │  │ Cloud        │  │ Redis  │  │ R2          │  │
│  └──────────────┘  └──────────────┘  └────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Cost Summary

| Service              | Tier              | Monthly   |
|----------------------|-------------------|-----------|
| Vercel               | Pro               | $20       |
| Railway              | Pro (4 services)  | $25–50    |
| Neon                 | Launch            | $19       |
| Upstash              | Pay-as-you-go     | ~$5       |
| Temporal Cloud       | Default namespace | $100      |
| Cloudflare R2        | Pay-as-you-go     | ~$5       |
| WorkOS               | Free tier         | $0        |
| **Total**            |                   | **~$175–200** |

---

## Step 1: Database — Neon PostgreSQL

### Create Account & Project

1. Go to [neon.tech](https://neon.tech) and sign up
2. Click **"New Project"**
3. Settings:
   - **Name**: `sovereign-prod`
   - **Region**: `US East (Ohio)` — closest to your Railway region
   - **PostgreSQL version**: `16`
4. Click **"Create Project"**

### Get Connection Strings

1. After creation, you'll see the **Connection Details** page
2. Copy two connection strings:

**Pooled (for API — default port 5432):**
```
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Direct (for migrations only — port 5433):**
```
DATABASE_URL_DIRECT=postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech:5433/neondb?sslmode=require
```

### Where to Save

- `DATABASE_URL` → Railway shared variable (all services)
- `DATABASE_URL_DIRECT` → GitHub Secret (for CI/CD migrations)

### Enable Connection Pooling

1. Go to **Settings → Compute** in Neon dashboard
2. Connection pooling is ON by default (PgBouncer)
3. Default pool size: 64 — suitable for launch

---

## Step 2: Redis — Upstash

### Create Account & Database

1. Go to [upstash.com](https://upstash.com) and sign up
2. Click **"Create Database"**
3. Settings:
   - **Name**: `sovereign-prod`
   - **Region**: `US-East-1`
   - **Type**: `Regional` (cheaper) or `Global` (multi-region)
   - **TLS**: Enabled (default)
   - **Eviction**: Disabled
4. Click **"Create"**

### Get Connection String

1. After creation, click on the database
2. Go to **REST API** tab (or Redis tab for native connection)
3. Copy the **Redis URL**:

```
REDIS_URL=rediss://default:XXXXXXXXXXXX@us1-xxxxx-xxxxx.upstash.io:6379
```

> Note the `rediss://` (double s) — this enables TLS.

### Where to Save

- `REDIS_URL` → Railway shared variable (all services)

---

## Step 3: Object Storage — Cloudflare R2

### Create Account & Bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage** in left sidebar
3. Click **"Create Bucket"**
4. Settings:
   - **Name**: `sovereign-prod`
   - **Location hint**: `Eastern North America (ENAM)`
5. Click **"Create Bucket"**

### Create API Token

1. In R2 page, click **"Manage R2 API Tokens"**
2. Click **"Create API Token"**
3. Settings:
   - **Token name**: `sovereign-prod-rw`
   - **Permissions**: `Object Read & Write`
   - **Bucket scope**: `sovereign-prod` (specific bucket only)
   - **TTL**: No expiration (or set rotation schedule)
4. Click **"Create API Token"**
5. Copy the credentials:

```
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=XXXXXXXXXXXXXXXXXXXX
S3_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
S3_BUCKET=sovereign-prod
S3_REGION=auto
```

### Where to Save

- All `S3_*` vars → Railway shared variable (API + workers)

---

## Step 4: Auth — WorkOS

### Create Account & Organization

1. Go to [workos.com](https://workos.com) and sign up
2. In the Dashboard, go to **"API Keys"**
3. Copy:

```
WORKOS_API_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX
WORKOS_CLIENT_ID=client_XXXXXXXXXXXXXXXXXXXX
```

### Configure SSO (when ready)

1. Go to **Authentication → SSO**
2. Add redirect URIs:
   - `https://your-app.vercel.app/api/auth/callback`
   - `https://sovereign.yourdomain.com/api/auth/callback`
3. Configure SAML/OIDC providers as needed

### Where to Save

- `WORKOS_API_KEY` → Railway shared variable (API service)
- `WORKOS_CLIENT_ID` → Railway shared variable (API service) + Vercel env var (web)

---

## Step 5: Orchestration — Temporal Cloud

### Create Account & Namespace

1. Go to [cloud.temporal.io](https://cloud.temporal.io) and sign up
2. Click **"Create Namespace"**
3. Settings:
   - **Name**: `sovereign-prod`
   - **Region**: `us-east-1`
   - **Retention**: `30 days`
4. Click **"Create"**

### Generate mTLS Certificates

1. In namespace page, go to **"Certificates"**
2. Click **"Add Client Certificate"**
3. Either upload your own CA or use Temporal's:

```bash
# Generate cert (if self-managing):
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 \
  -nodes -keyout sovereign.key -out sovereign.pem \
  -subj "/CN=sovereign-prod"
```

4. Upload `sovereign.pem` to Temporal Cloud
5. Base64-encode for env vars:

```bash
TEMPORAL_TLS_CERT=$(cat sovereign.pem | base64 -w0)
TEMPORAL_TLS_KEY=$(cat sovereign.key | base64 -w0)
```

### Get Connection Info

```
TEMPORAL_ADDRESS=sovereign-prod.xxxxx.tmprl.cloud:7233
TEMPORAL_NAMESPACE=sovereign-prod
```

### Where to Save

- All `TEMPORAL_*` vars → Railway shared variable (worker-orchestrator)

---

## Step 6: AI — OpenAI

### Get API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to **API Keys**
3. Click **"Create new secret key"**
4. Copy:

```
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXX
```

### Where to Save

- `OPENAI_API_KEY` → Railway shared variable (worker-orchestrator)

---

## Step 7: Billing — Stripe

### Get API Keys

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Developers → API Keys**
3. Copy the **Secret key** (starts with `sk_live_`):

```
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX
```

### Set Up Webhook

1. Go to **Developers → Webhooks**
2. Click **"Add Endpoint"**
3. Settings:
   - **URL**: `https://your-api.railway.app/api/v1/billing/webhook`
   - **Events**: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. After creation, reveal the **Signing Secret**:

```
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXX
```

### Where to Save

- `STRIPE_SECRET_KEY` → Railway shared variable (API)
- `STRIPE_WEBHOOK_SECRET` → Railway shared variable (API)

---

## Step 8: Generate Secrets

Generate two critical secrets locally:

```bash
# Session secret (JWT signing)
openssl rand -base64 48
# → Copy as SESSION_SECRET

# Sovereign encryption key (connector credential encryption)
openssl rand -base64 48
# → Copy as SOVEREIGN_SECRET_KEY
```

> **CRITICAL**: Back up `SOVEREIGN_SECRET_KEY` securely (e.g., 1Password, AWS Secrets Manager).
> If lost, ALL encrypted connector credentials become unrecoverable.

### Where to Save

- `SESSION_SECRET` → Railway shared variable (API)
- `SOVEREIGN_SECRET_KEY` → Railway shared variable (API + workers)

---

## Step 9: Deploy Backend — Railway

### Create Project

1. Go to [railway.app](https://railway.app) and sign up
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Connect your `ehudso7/Sovereign` repository
4. Railway will detect the monorepo

### Create Services (4 total)

For each service, click **"New Service"** → **"GitHub Repo"** → select the same repo:

#### Service 1: sovereign-api
- **Settings → Build**:
  - Dockerfile Path: `infra/docker/Dockerfile.api`
  - Watch paths: `apps/api/**, packages/**/`
- **Settings → Deploy**:
  - Port: `3002`
  - Health Check Path: `/health`
  - Restart Policy: On Failure
- **Settings → Networking**:
  - Generate domain: `sovereign-api-prod.up.railway.app`

#### Service 2: sovereign-worker-orchestrator
- **Settings → Build**:
  - Dockerfile Path: `infra/docker/Dockerfile.worker-orchestrator`
  - Watch paths: `apps/worker-orchestrator/**, packages/**/`
- **Settings → Deploy**:
  - No port (background worker)
  - Restart Policy: On Failure

#### Service 3: sovereign-worker-browser
- **Settings → Build**:
  - Dockerfile Path: `infra/docker/Dockerfile.worker-browser`
  - Watch paths: `apps/worker-browser/**, packages/**/`
- **Settings → Deploy**:
  - No port (background worker)
  - Restart Policy: On Failure

#### Service 4: sovereign-gateway-mcp
- **Settings → Build**:
  - Dockerfile Path: `infra/docker/Dockerfile.gateway-mcp`
  - Watch paths: `apps/gateway-mcp/**, packages/**/`
- **Settings → Deploy**:
  - Port: `3003`
  - Restart Policy: On Failure
  - Internal networking only (not public)

### Set Shared Variables

In Railway, go to **Project Settings → Shared Variables** and add all variables from `.env.production.example`. This shares them across all services.

### Get Railway Deploy Token

1. Go to **Account Settings → Tokens**
2. Create a new token: `github-deploy`
3. Copy as `RAILWAY_TOKEN`

---

## Step 10: Deploy Frontend — Vercel

### Create Projects

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **"Add New Project"** → Import `ehudso7/Sovereign`

#### Project 1: sovereign-web
- **Framework**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm build --filter=@sovereign/web...`
- **Install Command**: `pnpm install --frozen-lockfile`
- **Output Directory**: `.next`

#### Project 2: sovereign-docs
- **Framework**: Next.js
- **Root Directory**: `apps/docs`
- **Build Command**: `pnpm build --filter=@sovereign/docs...`
- **Install Command**: `pnpm install --frozen-lockfile`
- **Output Directory**: `.next`

### Set Environment Variables (Vercel Dashboard)

For the **web** project:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://sovereign-api-prod.up.railway.app` |
| `NEXT_PUBLIC_WORKOS_CLIENT_ID` | Your WorkOS client ID |

### Get Vercel Tokens

1. Go to **Settings → Tokens** → Create token → Copy as `VERCEL_TOKEN`
2. Go to **Settings → General** → Copy **Team ID** as `VERCEL_ORG_ID`
3. For each project, go to **Project Settings → General** → Copy **Project ID**:
   - `VERCEL_WEB_PROJECT_ID`
   - `VERCEL_DOCS_PROJECT_ID`

---

## Step 11: GitHub Secrets

Go to your repo **Settings → Secrets and variables → Actions** and add:

| Secret | Source | Purpose |
|--------|--------|---------|
| `DATABASE_URL` | Neon (pooled) | CI migrations |
| `RAILWAY_TOKEN` | Railway account | Deploy backend |
| `VERCEL_TOKEN` | Vercel account | Deploy frontend |
| `VERCEL_ORG_ID` | Vercel team settings | Vercel auth |
| `VERCEL_WEB_PROJECT_ID` | Vercel web project | Deploy web |
| `VERCEL_DOCS_PROJECT_ID` | Vercel docs project | Deploy docs |

---

## Step 12: Run Initial Migration

```bash
# Set direct connection string (bypasses pooler)
export DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech:5433/neondb?sslmode=require"

pnpm db:migrate
```

---

## Step 13: Verify Deployment

```bash
# API health check
curl https://sovereign-api-prod.up.railway.app/health

# Web app
open https://sovereign-web.vercel.app

# Docs
open https://sovereign-docs.vercel.app
```

---

## All Environment Variables — Complete Reference

### Railway Shared Variables (all 4 services)

| Variable | Source | Required |
|----------|--------|----------|
| `NODE_ENV` | `production` | Yes |
| `LOG_LEVEL` | `info` | Yes |
| `DATABASE_URL` | Neon pooled connection string | Yes |
| `REDIS_URL` | Upstash Redis URL | Yes |
| `WORKOS_API_KEY` | WorkOS Dashboard → API Keys | Yes |
| `WORKOS_CLIENT_ID` | WorkOS Dashboard → API Keys | Yes |
| `SESSION_SECRET` | `openssl rand -base64 48` | Yes |
| `TEMPORAL_ADDRESS` | Temporal Cloud namespace connection | Yes |
| `TEMPORAL_NAMESPACE` | Temporal Cloud namespace name | Yes |
| `TEMPORAL_TLS_CERT` | Base64 mTLS cert | Yes |
| `TEMPORAL_TLS_KEY` | Base64 mTLS key | Yes |
| `S3_BUCKET` | Cloudflare R2 bucket name | Yes |
| `S3_REGION` | `auto` | Yes |
| `S3_ENDPOINT` | Cloudflare R2 endpoint URL | Yes |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 API token | Yes |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 API token | Yes |
| `OPENAI_API_KEY` | OpenAI platform | Yes |
| `SOVEREIGN_SECRET_KEY` | `openssl rand -base64 48` | Yes |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Yes |

### Vercel Environment Variables (web project)

| Variable | Source | Required |
|----------|--------|----------|
| `NEXT_PUBLIC_API_URL` | Railway API public URL | Yes |
| `NEXT_PUBLIC_WORKOS_CLIENT_ID` | WorkOS Dashboard | Yes |

### GitHub Actions Secrets

| Secret | Source | Required |
|--------|--------|----------|
| `DATABASE_URL` | Neon pooled connection string | Yes |
| `RAILWAY_TOKEN` | Railway Account → Tokens | Yes |
| `VERCEL_TOKEN` | Vercel Settings → Tokens | Yes |
| `VERCEL_ORG_ID` | Vercel Settings → General → Team ID | Yes |
| `VERCEL_WEB_PROJECT_ID` | Vercel web project → Settings → Project ID | Yes |
| `VERCEL_DOCS_PROJECT_ID` | Vercel docs project → Settings → Project ID | Yes |

---

## Custom Domain Setup

### Vercel (Web + Docs)
1. Vercel Dashboard → Project → **Settings → Domains**
2. Add: `app.sovereign.yourdomain.com`
3. Add CNAME record: `app.sovereign.yourdomain.com` → `cname.vercel-dns.com`

### Railway (API)
1. Railway Dashboard → Service → **Settings → Networking → Custom Domain**
2. Add: `api.sovereign.yourdomain.com`
3. Add CNAME record: `api.sovereign.yourdomain.com` → provided Railway CNAME

---

## Monitoring & Logs

| Service | Where to Monitor |
|---------|-----------------|
| API, Workers | Railway Dashboard → Service → Logs |
| Web, Docs | Vercel Dashboard → Deployments → Logs |
| Database | Neon Dashboard → Monitoring |
| Redis | Upstash Console → Analytics |
| Workflows | Temporal Cloud → Workflows |
| Billing | Stripe Dashboard → Events |

---

## Rollback

### Vercel
```bash
# List deployments
vercel ls --token=$VERCEL_TOKEN
# Promote a previous deployment
vercel promote <deployment-url> --token=$VERCEL_TOKEN
```

### Railway
```bash
# Railway auto-keeps last 10 deployments
# Rollback via dashboard: Service → Deployments → click "Rollback"
```

### Database
```bash
# Neon supports branch-based rollback
# Create a branch before risky migrations:
# Neon Dashboard → Branches → Create Branch (point-in-time restore)
```
