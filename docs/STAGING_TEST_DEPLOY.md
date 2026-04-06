# Staging Test Deployment — Full E2E Testing Guide

Deploy Sovereign to a public URL where any tester (human or AI) can authenticate,
exercise every feature, and provide in-depth reporting — no Docker required.

## Architecture

```
Tester (browser/Codex)
       │
       ▼
┌──────────────┐     ┌──────────────────────────┐
│ Vercel       │────▶│ Railway                  │
│ Next.js Web  │     │ ┌──────────────────────┐ │
│ (staging)    │     │ │ API Server (:3002)    │ │
└──────────────┘     │ │ AUTH_MODE=local       │ │
                     │ └──────────┬───────────┘ │
                     │            │             │
                     │ ┌──────────▼───────────┐ │
                     │ │ PostgreSQL 16        │ │
                     │ │ (Railway addon)      │ │
                     │ └──────────────────────┘ │
                     │ ┌──────────────────────┐ │
                     │ │ Redis 7              │ │
                     │ │ (Railway addon)      │ │
                     │ └──────────────────────┘ │
                     └──────────────────────────┘
```

> Temporal and browser workers are optional for basic E2E testing.
> The core platform (auth, agents, connectors, memory, policies, CRM, billing,
> terminal) works without them.

---

## Step 1: Railway Setup (Backend + DB + Redis)

### Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** service (auto-provisions, gives you `DATABASE_URL`)
3. Add a **Redis** service (auto-provisions, gives you `REDIS_URL`)
4. Add a **Service** from GitHub repo `ehudso7/sovereign`

### Configure the API Service

**Source:** GitHub repo, branch `claude/mobile-terminal-ai-agents-Bcycc`

**Build command:**
```bash
pnpm install --frozen-lockfile && pnpm turbo build --filter=@sovereign/api...
```

**Start command:**
```bash
node apps/api/dist/index.js
```

**Root directory:** `/` (monorepo root)

**Environment variables:**
```bash
NODE_ENV=production
PORT=3002
AUTH_MODE=local
SOVEREIGN_ALLOW_LOCAL_AUTH=true
SESSION_SECRET=<generate: openssl rand -hex 32>
SOVEREIGN_SECRET_KEY=<generate: openssl rand -hex 32>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
APP_BASE_URL=https://<your-vercel-url>
API_BASE_URL=https://<your-railway-api-url>
CORS_ALLOWED_ORIGINS=https://<your-vercel-url>
LOG_LEVEL=info

# Optional — for real AI agent testing
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
```

### Run Migrations

In Railway service settings, add a **deploy command** or run once via Railway CLI:
```bash
railway run pnpm db:migrate
```

### Seed Test Data

```bash
railway run pnpm db:seed
```

This creates: demo org, admin user (admin@demo.local), 3 agents, CRM data,
billing account, policies, and audit trail.

---

## Step 2: Vercel Setup (Frontend)

### Deploy Web App

1. Import the GitHub repo into Vercel
2. Set **Framework Preset** to Next.js
3. Set **Root Directory** to `apps/web`
4. Set **Build Command** to:
   ```bash
   cd ../.. && pnpm install --frozen-lockfile && pnpm --filter=@sovereign/core build && pnpm --filter=@sovereign/ui build && pnpm --filter=@sovereign/web build
   ```
5. Set **Output Directory** to `.next`

### Environment Variables (Vercel)

```bash
NEXT_PUBLIC_API_BASE_URL=https://<your-railway-api-url>
NEXT_PUBLIC_AUTH_MODE=local
```

---

## Step 3: Verify Deployment

### Health Check
```bash
curl https://<your-railway-api-url>/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Web App
```
https://<your-vercel-url>
# Should show landing page with Sign In + Request Access buttons
```

---

## Step 4: Testing Guide for Tester

### First-Time Setup

1. Open `https://<your-vercel-url>`
2. Click **Sign In**
3. Enter email: `admin@demo.local` (seeded user)
4. Click **Sign In** → Dashboard loads with pre-populated data

### Alternative: Bootstrap Fresh Account

1. Open `https://<your-vercel-url>/auth/sign-in`
2. Click **"New installation? Bootstrap first account"**
3. Fill: email, name, org name, org slug
4. Click **Bootstrap Account** → Creates fresh org + admin

### Feature Test Matrix

| Module | URL Path | What to Test |
|--------|----------|-------------|
| **Dashboard** | `/dashboard` | Stat cards, recent runs, activity feed, projects |
| **Agents** | `/agents` | List 3 seeded agents, create new, edit, publish, archive |
| **Agent Detail** | `/agents/<id>` | Version history, model config, tool selection |
| **Runs** | `/runs` | List runs, create run (needs AI key + Temporal), view steps |
| **Connectors** | `/connectors` | Install Echo connector, test it, configure credentials, revoke |
| **Skills** | `/skills` | Install Research Assistant skill, uninstall |
| **Browser** | `/browser-sessions` | List sessions (empty without browser worker) |
| **Terminal** | `/terminal` | Terminal tab + AI Agent tab, provider/model switching |
| **Terminal Detail** | `/terminal/<id>` | Per-session terminal + AI chat |
| **Memory** | `/memories` | Create semantic/episodic/procedural, search, redact, promote |
| **Mission Control** | `/mission-control` | Overview metrics, alerts, run monitoring |
| **Policies** | `/policies` | View seeded policy, create deny/allow/require_approval rules |
| **Approvals** | `/approvals` | Approve/deny pending actions |
| **Quarantine** | `/quarantine` | Quarantine/release agents or connectors |
| **Audit Log** | `/audit` | Full event trail from all actions |
| **Revenue** | `/revenue` | 2 accounts, 2 contacts, 1 deal, create notes, generate outreach |
| **Billing** | `/billing` | Team plan active, usage meters, invoice preview |
| **Onboarding** | `/onboarding` | Checklist derived from real data (progresses as you test) |
| **Docs** | `/docs` | In-app documentation (10 categories, 12 articles) |
| **Support** | `/support` | Platform diagnostics summary |
| **Admin** | `/admin` | Org overview, member list, settings |
| **Settings** | `/settings` | Org settings, project management |

### Multi-Tenant Isolation Test

1. Bootstrap a second account (different email + org slug)
2. Verify data from first org is invisible
3. Verify audit trails are separate
4. Switch between orgs using the org switcher

### Mobile Terminal Test

1. Open `/terminal` on a mobile device or Chrome DevTools mobile view
2. Test tab switching (Terminal / AI Agent)
3. Test quick action buttons (Git Status, Run Tests, etc.)
4. Test AI chat with provider switching
5. Verify PWA install prompt appears

---

## Cost Estimate

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway (API + Postgres + Redis) | Hobby/Pro | $5-20 |
| Vercel (Web) | Hobby (free) | $0 |
| **Total for test staging** | | **$5-20/month** |

> AI provider API keys are optional. Without them, the agent chat falls back
> to LocalExecutionProvider (deterministic responses).

---

## Tear Down

When testing is complete:
1. Delete the Railway project (removes API + DB + Redis)
2. Delete the Vercel project (removes frontend)
3. Revoke any AI provider API keys used for testing
