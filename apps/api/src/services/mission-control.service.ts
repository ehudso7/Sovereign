// ---------------------------------------------------------------------------
// Mission Control service — Phase 9 observability
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  RunId,
  AlertEventId,
  Result,
  Run,
  RunStep,
  AlertEvent,
  AlertRule,
  AuditEmitter,
} from "@sovereign/core";
import type {
  RunRepo,
  RunStepRepo,
  BrowserSessionRepo,
  AlertRuleRepo,
  AlertEventRepo,
  AuditRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewMetrics {
  runs: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    cancelled: number;
    paused: number;
  };
  avgQueueWaitMs: number | null;
  avgDurationMs: number | null;
  failureRate: number | null;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  estimatedCostCents: number;
  runsWithTools: number;
  runsWithBrowser: number;
  runsWithMemory: number;
  openAlerts: number;
  recentFailures: Run[];
}

export interface RunDetail {
  run: Run;
  steps: RunStep[];
  browserSessions: Array<{
    id: string;
    status: string;
    browserType: string;
    currentUrl: string | null;
    humanTakeover: boolean;
    createdAt: string;
    endedAt: string | null;
  }>;
  toolUsage: Array<{ toolName: string; count: number; totalLatencyMs: number }>;
  memoryUsage: {
    memoriesRetrieved: number;
    memoriesWritten: number;
  };
  timeline: RunStep[];
  queueWaitMs: number | null;
  durationMs: number | null;
}

export interface RunListFilters {
  status?: string;
  agentId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasBrowser?: boolean;
  hasTool?: boolean;
  hasMemory?: boolean;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MissionControlService {
  constructor(
    private readonly runRepo: RunRepo,
    private readonly runStepRepo: RunStepRepo,
    private readonly browserSessionRepo: BrowserSessionRepo,
    private readonly alertRuleRepo: AlertRuleRepo,
    private readonly alertEventRepo: AlertEventRepo,
    private readonly auditRepo: AuditRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------

  async getOverview(orgId: OrgId): Promise<Result<OverviewMetrics>> {
    const runs = await this.runRepo.listForOrg(orgId);

    // Counts by status
    const statusCounts = { total: runs.length, completed: 0, failed: 0, running: 0, queued: 0, cancelled: 0, paused: 0 };
    for (const r of runs) {
      if (r.status === "completed") statusCounts.completed++;
      else if (r.status === "failed") statusCounts.failed++;
      else if (r.status === "running" || r.status === "starting") statusCounts.running++;
      else if (r.status === "queued") statusCounts.queued++;
      else if (r.status === "cancelled" || r.status === "cancelling") statusCounts.cancelled++;
      else if (r.status === "paused") statusCounts.paused++;
    }

    // Queue wait: createdAt → startedAt
    const queueWaits: number[] = [];
    const durations: number[] = [];
    let totalInput = 0;
    let totalOutput = 0;
    let totalTokens = 0;
    let totalCostCents = 0;

    for (const r of runs) {
      if (r.startedAt && r.createdAt) {
        const wait = new Date(r.startedAt).getTime() - new Date(r.createdAt).getTime();
        if (wait >= 0) queueWaits.push(wait);
      }
      if (r.startedAt && r.completedAt) {
        const dur = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
        if (dur >= 0) durations.push(dur);
      }
      if (r.tokenUsage) {
        totalInput += r.tokenUsage.inputTokens || 0;
        totalOutput += r.tokenUsage.outputTokens || 0;
        totalTokens += r.tokenUsage.totalTokens || 0;
      }
      if (r.costCents) totalCostCents += r.costCents;
    }

    const avgQueueWaitMs = queueWaits.length > 0
      ? Math.round(queueWaits.reduce((a, b) => a + b, 0) / queueWaits.length)
      : null;
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const failureRate = statusCounts.total > 0
      ? Math.round((statusCounts.failed / statusCounts.total) * 10000) / 100
      : null;

    // Tool/browser/memory usage counts — derived from steps and linked sessions
    let runsWithTools = 0;
    let runsWithBrowser = 0;
    const browserSessionRunIds = new Set<string>();

    // Check browser sessions
    const browserSessions = await this.browserSessionRepo.listForOrg(orgId);
    for (const bs of browserSessions) {
      browserSessionRunIds.add(bs.runId);
    }
    runsWithBrowser = browserSessionRunIds.size;

    // For tool count, check runs that have tool_call steps — use audit events for efficiency
    const toolAuditEvents = await this.auditRepo.query(orgId, { action: "run.tool_used" });
    const runIdsWithTools = new Set(toolAuditEvents.map((e) => e.resourceId));
    runsWithTools = runIdsWithTools.size;

    // Memory usage — count distinct runs that had memory.retrieved_for_run
    const memAuditEvents = await this.auditRepo.query(orgId, { action: "memory.retrieved_for_run" });
    const runIdsWithMemory = new Set(
      memAuditEvents.map((e) => (e.metadata?.runId as string | undefined) ?? e.resourceId).filter(Boolean),
    );
    const runsWithMemory = runIdsWithMemory.size;

    // Alert count
    const alertCounts = await this.alertEventRepo.countByStatus(orgId);
    const openAlerts = (alertCounts["open"] ?? 0);

    // Recent failures (last 10)
    const recentFailures = runs
      .filter((r) => r.status === "failed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return ok({
      runs: statusCounts,
      avgQueueWaitMs,
      avgDurationMs,
      failureRate,
      tokenUsage: { inputTokens: totalInput, outputTokens: totalOutput, totalTokens },
      estimatedCostCents: totalCostCents,
      runsWithTools,
      runsWithBrowser,
      runsWithMemory,
      openAlerts,
      recentFailures,
    });
  }

  // -------------------------------------------------------------------------
  // Run list with filters
  // -------------------------------------------------------------------------

  async listRuns(orgId: OrgId, filters: RunListFilters = {}): Promise<Result<Run[]>> {
    const baseFilters: { agentId?: string; projectId?: string; status?: string } = {};
    if (filters.agentId) baseFilters.agentId = filters.agentId;
    if (filters.projectId) baseFilters.projectId = filters.projectId;
    if (filters.status) baseFilters.status = filters.status;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let runs = await this.runRepo.listForOrg(orgId, baseFilters as any);

    // Date range filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      runs = runs.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      runs = runs.filter((r) => new Date(r.createdAt).getTime() <= to);
    }

    // Sort by creation desc
    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      runs = runs.slice(0, filters.limit);
    }

    return ok(runs);
  }

  // -------------------------------------------------------------------------
  // Run detail with timeline
  // -------------------------------------------------------------------------

  async getRunDetail(runId: RunId, orgId: OrgId): Promise<Result<RunDetail>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    // Steps (ordered timeline)
    const steps = await this.runStepRepo.listForRun(runId);
    const timeline = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

    // Browser sessions linked to this run
    const allSessions = await this.browserSessionRepo.listForOrg(orgId, { runId });
    const browserSessions = allSessions.map((s) => ({
      id: s.id,
      status: s.status,
      browserType: s.browserType,
      currentUrl: s.currentUrl,
      humanTakeover: s.humanTakeover,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
    }));

    // Tool usage aggregation from steps
    const toolMap = new Map<string, { count: number; totalLatencyMs: number }>();
    for (const step of steps) {
      if (step.type === "tool_call" && step.toolName) {
        const existing = toolMap.get(step.toolName) ?? { count: 0, totalLatencyMs: 0 };
        existing.count++;
        existing.totalLatencyMs += step.latencyMs ?? 0;
        toolMap.set(step.toolName, existing);
      }
    }
    const toolUsage = Array.from(toolMap.entries()).map(([toolName, data]) => ({
      toolName,
      ...data,
    }));

    // Memory usage — check audit events for this run
    const memRetrievedEvents = await this.auditRepo.query(orgId, { action: "memory.retrieved_for_run" });
    const memCreatedEvents = await this.auditRepo.query(orgId, { action: "memory.created" });
    const memoriesRetrieved = memRetrievedEvents.filter(
      (e) => e.metadata?.scopeId === run.agentId,
    ).length;
    const memoriesWritten = memCreatedEvents.filter(
      (e) => e.metadata?.sourceRunId === runId,
    ).length;

    // Timing calculations
    let queueWaitMs: number | null = null;
    let durationMs: number | null = null;
    if (run.startedAt && run.createdAt) {
      queueWaitMs = new Date(run.startedAt).getTime() - new Date(run.createdAt).getTime();
    }
    if (run.startedAt && run.completedAt) {
      durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
    }

    return ok({
      run,
      steps,
      browserSessions,
      toolUsage,
      memoryUsage: { memoriesRetrieved, memoriesWritten },
      timeline,
      queueWaitMs,
      durationMs,
    });
  }

  // -------------------------------------------------------------------------
  // Run timeline
  // -------------------------------------------------------------------------

  async getRunTimeline(runId: RunId, orgId: OrgId): Promise<Result<RunStep[]>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const steps = await this.runStepRepo.listForRun(runId);
    return ok([...steps].sort((a, b) => a.stepNumber - b.stepNumber));
  }

  // -------------------------------------------------------------------------
  // Run steps
  // -------------------------------------------------------------------------

  async getRunSteps(runId: RunId, orgId: OrgId): Promise<Result<RunStep[]>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const steps = await this.runStepRepo.listForRun(runId);
    return ok(steps);
  }

  // -------------------------------------------------------------------------
  // Linked browser sessions
  // -------------------------------------------------------------------------

  async getLinkedBrowserSessions(runId: RunId, orgId: OrgId): Promise<Result<unknown[]>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const sessions = await this.browserSessionRepo.listForOrg(orgId, { runId });
    return ok(sessions.map((s) => ({
      id: s.id,
      status: s.status,
      browserType: s.browserType,
      currentUrl: s.currentUrl,
      humanTakeover: s.humanTakeover,
      artifactKeys: s.artifactKeys,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
    })));
  }

  // -------------------------------------------------------------------------
  // Alerts
  // -------------------------------------------------------------------------

  async listAlerts(
    orgId: OrgId,
    filters?: { status?: string; severity?: string; conditionType?: string; limit?: number },
  ): Promise<Result<AlertEvent[]>> {
    const events = await this.alertEventRepo.listForOrg(orgId, filters);
    return ok(events);
  }

  async acknowledgeAlert(
    alertId: AlertEventId,
    orgId: OrgId,
    userId: UserId,
  ): Promise<Result<AlertEvent>> {
    const event = await this.alertEventRepo.acknowledge(alertId, orgId, userId);
    if (!event) return err(AppError.notFound("AlertEvent", alertId));

    await this.audit.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "alert.acknowledged",
      resourceType: "alert_event",
      resourceId: alertId,
      metadata: { conditionType: event.conditionType },
    });

    return ok(event);
  }

  // -------------------------------------------------------------------------
  // Alert rules
  // -------------------------------------------------------------------------

  async listAlertRules(orgId: OrgId): Promise<Result<AlertRule[]>> {
    const rules = await this.alertRuleRepo.listForOrg(orgId);
    return ok(rules);
  }

  async createAlertRule(input: {
    orgId: OrgId;
    name: string;
    description?: string;
    conditionType: string;
    thresholdMinutes?: number;
    enabled?: boolean;
    createdBy: UserId;
  }): Promise<Result<AlertRule>> {
    const rule = await this.alertRuleRepo.create(input);
    return ok(rule);
  }

  // -------------------------------------------------------------------------
  // Generate alerts from current state (called on overview or separately)
  // -------------------------------------------------------------------------

  async generateAlerts(orgId: OrgId): Promise<void> {
    // Check for failed runs that don't already have alerts
    const runs = await this.runRepo.listForOrg(orgId, { status: "failed" as unknown as undefined });
    const existingAlerts = await this.alertEventRepo.listForOrg(orgId, { conditionType: "run_failed" });
    const alertedRunIds = new Set(existingAlerts.map((a) => a.resourceId));

    for (const run of runs) {
      if (run.status === "failed" && !alertedRunIds.has(run.id)) {
        await this.alertEventRepo.create({
          orgId,
          severity: "warning",
          title: `Run failed: ${run.id.slice(0, 8)}`,
          message: run.error?.message ?? "Run failed without error message",
          conditionType: "run_failed",
          resourceType: "run",
          resourceId: run.id,
          metadata: { agentId: run.agentId, projectId: run.projectId },
        });
      }
    }

    // Check for stuck runs (queued or running for over 30 min)
    const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
    const now = Date.now();
    const allRuns = await this.runRepo.listForOrg(orgId);
    const stuckAlerts = await this.alertEventRepo.listForOrg(orgId, { conditionType: "run_stuck" });
    const stuckAlertedRunIds = new Set(stuckAlerts.filter((a) => a.status === "open").map((a) => a.resourceId));

    for (const run of allRuns) {
      if ((run.status === "queued" || run.status === "running") && !stuckAlertedRunIds.has(run.id)) {
        const age = now - new Date(run.createdAt).getTime();
        if (age > STUCK_THRESHOLD_MS) {
          await this.alertEventRepo.create({
            orgId,
            severity: "critical",
            title: `Run stuck in ${run.status}: ${run.id.slice(0, 8)}`,
            message: `Run has been in "${run.status}" state for ${Math.round(age / 60000)} minutes`,
            conditionType: "run_stuck",
            resourceType: "run",
            resourceId: run.id,
            metadata: { agentId: run.agentId, status: run.status },
          });
        }
      }
    }

    // Check for failed browser sessions
    const browserSessions = await this.browserSessionRepo.listForOrg(orgId, { status: "failed" });
    const browserAlerts = await this.alertEventRepo.listForOrg(orgId, { conditionType: "browser_failed" });
    const browserAlertedIds = new Set(browserAlerts.map((a) => a.resourceId));

    for (const bs of browserSessions) {
      if (!browserAlertedIds.has(bs.id)) {
        await this.alertEventRepo.create({
          orgId,
          severity: "warning",
          title: `Browser session failed: ${bs.id.slice(0, 8)}`,
          message: `Browser session for run ${bs.runId.slice(0, 8)} failed`,
          conditionType: "browser_failed",
          resourceType: "browser_session",
          resourceId: bs.id,
          metadata: { runId: bs.runId },
        });
      }
    }
  }
}
