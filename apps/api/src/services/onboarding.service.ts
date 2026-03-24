// ---------------------------------------------------------------------------
// Onboarding, Docs, Support, Admin Service — Phase 13
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  OrgId, UserId, Result, AuditEmitter,
} from "@sovereign/core";
import type {
  AgentRepo, RunRepo, ConnectorInstallRepo,
  BillingAccountRepo, PolicyRepo, MembershipRepo, ProjectRepo,
  AlertEventRepo, BrowserSessionRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Onboarding types
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  category: "setup" | "configure" | "verify";
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  dismissed: boolean;
}

// ---------------------------------------------------------------------------
// Docs types
// ---------------------------------------------------------------------------

export interface DocsCategory {
  slug: string;
  title: string;
  articles: DocsArticle[];
}

export interface DocsArticle {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Support Diagnostics types
// ---------------------------------------------------------------------------

export interface SupportDiagnostics {
  orgId: string;
  generatedAt: string;
  platform: {
    agentCount: number;
    publishedAgentCount: number;
    runCount: number;
    failedRunCount: number;
    connectorCount: number;
    browserSessionCount: number;
    alertCount: number;
    openAlertCount: number;
  };
  billing: {
    plan: string;
    status: string;
    billingEmail: string | null;
  } | null;
  recentFailedRuns: { id: string; agentId: string; status: string; error: string | null; createdAt: string }[];
  recentAlerts: { id: string; severity: string; title: string; status: string; createdAt: string }[];
  onboarding: OnboardingProgress;
}

// ---------------------------------------------------------------------------
// Admin Overview types
// ---------------------------------------------------------------------------

export interface AdminOverview {
  orgId: string;
  memberCount: number;
  projectCount: number;
  agentCount: number;
  runCount: number;
  connectorCount: number;
  policyCount: number;
  billingPlan: string | null;
  billingStatus: string | null;
}

export interface AdminMember {
  userId: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface AdminSettingsSummary {
  orgName: string;
  orgSlug: string;
  plan: string;
  memberCount: number;
  projectCount: number;
  activePolicyCount: number;
  connectorInstallCount: number;
  billingEmail: string | null;
}

// ---------------------------------------------------------------------------
// Docs content (static, derived from actual product)
// ---------------------------------------------------------------------------

const DOCS_CATALOG: DocsCategory[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    articles: [
      { slug: "getting-started-overview", title: "Welcome to SOVEREIGN", summary: "Introduction to the SOVEREIGN agent operating system.", content: "SOVEREIGN is a multi-tenant agent operating system for creating, configuring, running, and governing AI agents. This guide will help you get set up.\n\n## Quick Start\n1. Create your organization\n2. Create a project\n3. Create and publish an agent\n4. Run your first agent\n5. Install connectors for external tools\n\n## Key Concepts\n- **Agents**: AI entities with instructions, tools, and goals\n- **Runs**: Executions of agents with inputs and outputs\n- **Connectors**: External tool integrations (MCP standard)\n- **Policies**: Governance rules for agent behavior\n- **Memory**: Persistent knowledge for agents", category: "getting-started" },
      { slug: "getting-started-setup", title: "Initial Setup", summary: "Complete your organization setup.", content: "## Organization Setup\n1. Sign in to your account\n2. Check the onboarding checklist at /onboarding\n3. Create your first project\n4. Set up billing if needed\n\n## Required Steps\n- Create at least one agent with instructions\n- Publish a version of your agent\n- Run the agent to verify it works\n- Install any connectors your agents need", category: "getting-started" },
    ],
  },
  {
    slug: "agents",
    title: "Agents",
    articles: [
      { slug: "agents-overview", title: "Agent Overview", summary: "How agents work in SOVEREIGN.", content: "## What is an Agent?\nAn agent is an AI entity configured with instructions, tools, goals, and budget controls.\n\n## Agent Lifecycle\n1. **Draft**: Create and configure\n2. **Published**: Ready to run\n3. **Archived**: Retired from use\n\n## Agent Versions\nAgents support versioning. Only one version can be published at a time. Published versions are immutable.\n\n## Configuration\n- **Instructions**: What the agent should do\n- **Tools**: Which connectors/tools it can use\n- **Budget**: Token and cost limits\n- **Memory**: How the agent remembers things\n- **Model**: Which AI model to use", category: "agents" },
    ],
  },
  {
    slug: "runs",
    title: "Runs",
    articles: [
      { slug: "runs-overview", title: "Run Overview", summary: "How agent executions work.", content: "## What is a Run?\nA run is a single execution of a published agent. Runs track status, inputs, outputs, steps, and costs.\n\n## Run States\n- **queued**: Waiting to start\n- **running**: In progress\n- **paused**: Temporarily stopped\n- **completed**: Successfully finished\n- **failed**: Ended with error\n- **cancelled**: Stopped by user\n\n## Run Steps\nEach run records individual steps: LLM calls, tool calls, and system events.\n\n## Billing\nRuns consume agent_runs meter usage. Plan limits are enforced at creation.", category: "runs" },
    ],
  },
  {
    slug: "connectors",
    title: "Connectors",
    articles: [
      { slug: "connectors-overview", title: "Connector Overview", summary: "How to connect external tools.", content: "## What are Connectors?\nConnectors provide external tool access for agents via the MCP standard.\n\n## Trust Tiers\n- **Verified**: Audited and signed by SOVEREIGN team\n- **Internal**: Created by your organization\n- **Untrusted**: Third-party, sandboxed\n\n## Setup\n1. Browse the connector catalog\n2. Install a connector\n3. Configure credentials (encrypted with AES-256-GCM)\n4. Test the connection\n5. Assign to agents via tool configuration", category: "connectors" },
    ],
  },
  {
    slug: "browser",
    title: "Browser Sessions",
    articles: [
      { slug: "browser-overview", title: "Browser Automation", summary: "Managed browser sessions for agents.", content: "## Browser Sessions\nAgents can control browser sessions via Playwright for web automation.\n\n## Actions\nnavigate, click, type, select, wait_for_selector, extract_text, screenshot, upload_file, download_file\n\n## Risky Actions\nupload_file and download_file are policy-gated and require approval if configured.\n\n## Human Takeover\nOperators can take over browser sessions for manual intervention.", category: "browser" },
    ],
  },
  {
    slug: "memory",
    title: "Memory",
    articles: [
      { slug: "memory-overview", title: "Memory Engine", summary: "How agents remember things.", content: "## Memory Types\n- **Semantic**: Facts and knowledge\n- **Episodic**: Run-specific experiences\n- **Procedural**: Learned procedures\n\n## Memory Lifecycle\n- Active → Redacted/Expired/Deleted\n- Content deduplication via SHA-256\n- Scope-aware: org, project, agent, user\n\n## Governance\nMemory can be redacted, expired, or deleted. All operations are audited.", category: "memory" },
    ],
  },
  {
    slug: "mission-control",
    title: "Mission Control",
    articles: [
      { slug: "mission-control-overview", title: "Observability", summary: "Monitor your agents and platform.", content: "## Mission Control\nReal-time monitoring for agent runs, browser sessions, and platform health.\n\n## Features\n- Run status overview\n- Alert management\n- Cost and token tracking\n- Browser session monitoring\n- Tool usage analytics", category: "mission-control" },
    ],
  },
  {
    slug: "policies",
    title: "Policies & Safety",
    articles: [
      { slug: "policies-overview", title: "Policy Engine", summary: "Govern agent behavior with policies.", content: "## Policy Engine\nPolicies control what agents can do.\n\n## Evaluation Order\nquarantine > deny > require_approval > allow\n\n## Policy Types\n- Access control\n- Deny rules\n- Approval requirements\n- Quarantine\n- Budget caps\n- Content filters\n\n## Approvals\nActions requiring approval are blocked until explicitly approved or denied.\n\n## Quarantine\nQuarantined subjects are blocked from all risky execution.", category: "policies" },
    ],
  },
  {
    slug: "revenue",
    title: "Revenue Workspace",
    articles: [
      { slug: "revenue-overview", title: "Revenue Workspace", summary: "Manage accounts, contacts, deals.", content: "## Revenue Workspace\nManage your sales pipeline with accounts, contacts, deals, and tasks.\n\n## Features\n- Account/contact/deal/task CRUD\n- Meeting notes and context\n- AI outreach draft generation\n- CRM sync with external systems\n- Policy-gated sync actions", category: "revenue" },
    ],
  },
  {
    slug: "billing",
    title: "Billing",
    articles: [
      { slug: "billing-overview", title: "Billing & Usage", summary: "Plans, usage, and invoices.", content: "## Plans\n- **Free**: 50 runs, 100K tokens, basic limits\n- **Team** ($99/mo): 1K runs, 5M tokens, overage allowed\n- **Enterprise** ($499/mo): Unlimited\n\n## Usage Meters\nagent_runs, llm_tokens, connector_calls, browser_sessions, storage_bytes\n\n## Enforcement\nFree plan blocks at limits. Team plan allows overage with charges. Enterprise is unlimited.\n\n## Invoices\nView current period usage, invoice preview, and history.", category: "billing" },
    ],
  },
];

function getAllArticles(): DocsArticle[] {
  return DOCS_CATALOG.flatMap(c => c.articles);
}

function getArticleBySlug(slug: string): DocsArticle | undefined {
  return getAllArticles().find(a => a.slug === slug);
}

// ---------------------------------------------------------------------------
// PgOnboardingService
// ---------------------------------------------------------------------------

export class PgOnboardingService {
  constructor(
    private readonly agentRepo: AgentRepo,
    private readonly runRepo: RunRepo,
    private readonly connectorInstallRepo: ConnectorInstallRepo,
    private readonly billingAccountRepo: BillingAccountRepo,
    private readonly policyRepo: PolicyRepo,
    private readonly membershipRepo: MembershipRepo,
    private readonly projectRepo: ProjectRepo,
    private readonly alertEventRepo: AlertEventRepo,
    private readonly browserSessionRepo: BrowserSessionRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async getProgress(orgId: OrgId): Promise<Result<OnboardingProgress>> {
    try {
      const [agents, runs, connectors, billing, policies, projects] = await Promise.all([
        this.agentRepo.listForOrg(orgId),
        this.runRepo.listForOrg(orgId),
        this.connectorInstallRepo.listForOrg(orgId),
        this.billingAccountRepo.getByOrgId(orgId),
        this.policyRepo.listForOrg(orgId),
        this.projectRepo.listForOrg(orgId),
      ]);

      const publishedAgents = agents.filter(a => a.status === "published");
      const completedRuns = runs.filter(r => r.status === "completed");

      const steps: OnboardingStep[] = [
        { key: "org_created", label: "Organization created", description: "Your organization is set up.", completed: true, category: "setup" },
        { key: "project_created", label: "Create a project", description: "Projects organize your agents and work.", completed: projects.length > 0, category: "setup" },
        { key: "agent_created", label: "Create an agent", description: "Build your first AI agent.", completed: agents.length > 0, category: "setup" },
        { key: "agent_published", label: "Publish an agent version", description: "Publish a version so it can run.", completed: publishedAgents.length > 0, category: "setup" },
        { key: "run_completed", label: "Complete a run", description: "Run your agent and see results.", completed: completedRuns.length > 0, category: "verify" },
        { key: "connector_installed", label: "Install a connector", description: "Connect external tools for your agents.", completed: connectors.length > 0, category: "configure" },
        { key: "billing_setup", label: "Review billing", description: "Check your plan and usage limits.", completed: billing !== null, category: "configure" },
        { key: "policy_reviewed", label: "Review policies", description: "Set up governance rules for your agents.", completed: policies.length > 0, category: "configure" },
      ];

      const completedCount = steps.filter(s => s.completed).length;
      return ok({
        steps,
        completedCount,
        totalCount: steps.length,
        percentComplete: Math.round((completedCount / steps.length) * 100),
        dismissed: false,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  /**
   * Dismiss onboarding guidance. Does NOT fake-complete any prerequisite.
   * Steps are always derived from real platform state.
   */
  async dismissOnboarding(orgId: OrgId, userId: UserId): Promise<Result<void>> {
    try {
      await this.audit.emit({
        orgId, actorId: userId, actorType: "user",
        action: "onboarding.dismissed", resourceType: "onboarding",
      });
      return ok(undefined);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Docs
  // =========================================================================

  async listDocs(): Promise<Result<DocsCategory[]>> {
    return ok(DOCS_CATALOG);
  }

  async getDoc(slug: string): Promise<Result<DocsArticle>> {
    const article = getArticleBySlug(slug);
    if (!article) return err(AppError.notFound("Doc", slug));
    return ok(article);
  }

  // =========================================================================
  // Support Diagnostics
  // =========================================================================

  async getDiagnostics(orgId: OrgId, userId: UserId): Promise<Result<SupportDiagnostics>> {
    try {
      const [agents, runs, connectors, billing, alerts, browserSessions, onboarding] = await Promise.all([
        this.agentRepo.listForOrg(orgId),
        this.runRepo.listForOrg(orgId),
        this.connectorInstallRepo.listForOrg(orgId),
        this.billingAccountRepo.getByOrgId(orgId),
        this.alertEventRepo.listForOrg(orgId, { limit: 10 }),
        this.browserSessionRepo.listForOrg(orgId),
        this.getProgress(orgId),
      ]);

      const publishedAgents = agents.filter(a => a.status === "published");
      const failedRuns = runs.filter(r => r.status === "failed");
      const openAlerts = alerts.filter(a => a.status === "open");

      await this.audit.emit({
        orgId, actorId: userId, actorType: "user",
        action: "support.diagnostics_viewed", resourceType: "support",
      });

      return ok({
        orgId,
        generatedAt: new Date().toISOString(),
        platform: {
          agentCount: agents.length,
          publishedAgentCount: publishedAgents.length,
          runCount: runs.length,
          failedRunCount: failedRuns.length,
          connectorCount: connectors.length,
          browserSessionCount: browserSessions.length,
          alertCount: alerts.length,
          openAlertCount: openAlerts.length,
        },
        billing: billing ? {
          plan: billing.plan,
          status: billing.status,
          billingEmail: billing.billingEmail,
        } : null,
        recentFailedRuns: failedRuns.slice(0, 5).map(r => ({
          id: r.id, agentId: r.agentId, status: r.status,
          error: r.error?.message ?? null, createdAt: r.createdAt,
        })),
        recentAlerts: alerts.slice(0, 5).map(a => ({
          id: a.id, severity: a.severity, title: a.title,
          status: a.status, createdAt: a.createdAt,
        })),
        onboarding: onboarding.ok ? onboarding.value : { steps: [], completedCount: 0, totalCount: 0, percentComplete: 0, dismissed: false },
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Admin Overview
  // =========================================================================

  async getAdminOverview(orgId: OrgId, userId: UserId): Promise<Result<AdminOverview>> {
    try {
      const [agents, runs, connectors, billing, policies, memberships] = await Promise.all([
        this.agentRepo.listForOrg(orgId),
        this.runRepo.listForOrg(orgId),
        this.connectorInstallRepo.listForOrg(orgId),
        this.billingAccountRepo.getByOrgId(orgId),
        this.policyRepo.listForOrg(orgId),
        this.membershipRepo.listForOrg(orgId),
      ]);

      await this.audit.emit({
        orgId, actorId: userId, actorType: "user",
        action: "admin.overview_viewed", resourceType: "admin",
      });

      return ok({
        orgId,
        memberCount: memberships.length,
        projectCount: 0, // derived from projects if needed
        agentCount: agents.length,
        runCount: runs.length,
        connectorCount: connectors.length,
        policyCount: policies.length,
        billingPlan: billing?.plan ?? null,
        billingStatus: billing?.status ?? null,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getAdminMemberships(orgId: OrgId): Promise<Result<AdminMember[]>> {
    try {
      const memberships = await this.membershipRepo.listForOrg(orgId);
      return ok(memberships.map(m => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAt: m.createdAt,
      })));
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getSettingsSummary(orgId: OrgId): Promise<Result<AdminSettingsSummary>> {
    try {
      const [billing, policies, connectors, memberships, projects] = await Promise.all([
        this.billingAccountRepo.getByOrgId(orgId),
        this.policyRepo.listForOrg(orgId, { status: "active" }),
        this.connectorInstallRepo.listForOrg(orgId),
        this.membershipRepo.listForOrg(orgId),
        this.projectRepo.listForOrg(orgId),
      ]);

      return ok({
        orgName: "Organization", // from session context
        orgSlug: "",
        plan: billing?.plan ?? "free",
        memberCount: memberships.length,
        projectCount: projects.length,
        activePolicyCount: policies.length,
        connectorInstallCount: connectors.length,
        billingEmail: billing?.billingEmail ?? null,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }
}
