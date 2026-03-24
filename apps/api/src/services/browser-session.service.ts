// ---------------------------------------------------------------------------
// Browser Session service — Phase 7 browser action plane
// ---------------------------------------------------------------------------

import {
  ok,
  err,
  AppError,
  isValidBrowserTransition,
  isBrowserTerminal,
  RISKY_BROWSER_ACTIONS,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  RunId,
  BrowserSessionId,
  BrowserSession,
  BrowserSessionStatus,
  BrowserAction,
  Result,
  AuditEmitter,
  PolicyDecisionResult,
} from "@sovereign/core";
import type { BrowserSessionRepo, RunRepo } from "@sovereign/db";
import type { PgPolicyService } from "./policy.service.js";

export class PgBrowserSessionService {
  private _policyService: PgPolicyService | null = null;

  constructor(
    private readonly sessionRepo: BrowserSessionRepo,
    private readonly runRepo: RunRepo,
    private readonly audit: AuditEmitter,
  ) {}

  /**
   * Attach a policy service for runtime enforcement of browser actions.
   * When attached, risky actions are evaluated via the policy engine
   * in addition to session metadata flags.
   */
  setPolicyService(policyService: PgPolicyService): void {
    this._policyService = policyService;
  }

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  async createSession(
    runId: RunId,
    orgId: OrgId,
    createdBy: UserId,
    browserType?: string,
  ): Promise<Result<BrowserSession>> {
    try {
      const run = await this.runRepo.getById(runId, orgId);
      if (!run) {
        return err(AppError.notFound("Run", runId));
      }

      const session = await this.sessionRepo.create({
        orgId,
        runId,
        agentId: run.agentId,
        browserType,
        createdBy,
      });

      await this.audit.emit({
        orgId,
        actorId: createdBy,
        actorType: "user",
        action: "browser.session_created",
        resourceType: "browser_session",
        resourceId: session.id,
        metadata: { runId, agentId: run.agentId, browserType: browserType ?? "chromium" },
      });

      return ok(session);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create browser session"));
    }
  }

  // ---------------------------------------------------------------------------
  // getSession
  // ---------------------------------------------------------------------------

  async getSession(sessionId: BrowserSessionId, orgId: OrgId): Promise<Result<BrowserSession>> {
    const session = await this.sessionRepo.getById(sessionId, orgId);
    if (!session) return err(AppError.notFound("BrowserSession", sessionId));
    return ok(session);
  }

  // ---------------------------------------------------------------------------
  // listSessions
  // ---------------------------------------------------------------------------

  async listSessions(
    orgId: OrgId,
    filters?: { runId?: RunId; status?: BrowserSessionStatus },
  ): Promise<Result<BrowserSession[]>> {
    const sessions = await this.sessionRepo.listForOrg(orgId, filters);
    return ok(sessions);
  }

  // ---------------------------------------------------------------------------
  // listSessionsForRun
  // ---------------------------------------------------------------------------

  async listSessionsForRun(runId: RunId, orgId: OrgId): Promise<Result<BrowserSession[]>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const sessions = await this.sessionRepo.listForRun(runId, orgId);
    return ok(sessions);
  }

  // ---------------------------------------------------------------------------
  // requestTakeover
  // ---------------------------------------------------------------------------

  async requestTakeover(
    sessionId: BrowserSessionId,
    orgId: OrgId,
    actorId: UserId,
  ): Promise<Result<BrowserSession>> {
    const session = await this.sessionRepo.getById(sessionId, orgId);
    if (!session) return err(AppError.notFound("BrowserSession", sessionId));

    if (!isValidBrowserTransition(session.status, "takeover_requested")) {
      return err(
        AppError.badRequest(
          `Cannot request takeover for session with status "${session.status}". Session must be "active".`,
        ),
      );
    }

    const updated = await this.sessionRepo.updateStatus(sessionId, orgId, "takeover_requested", {
      humanTakeover: true,
      takeoverBy: actorId,
    });
    if (!updated) return err(AppError.internal("Failed to update browser session"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "browser.takeover_requested",
      resourceType: "browser_session",
      resourceId: sessionId,
      metadata: { previousStatus: session.status },
    });

    // Auto-transition to human_control
    const controlled = await this.sessionRepo.updateStatus(sessionId, orgId, "human_control");
    if (!controlled) return ok(updated);

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "browser.takeover_started",
      resourceType: "browser_session",
      resourceId: sessionId,
      metadata: {},
    });

    return ok(controlled);
  }

  // ---------------------------------------------------------------------------
  // releaseTakeover
  // ---------------------------------------------------------------------------

  async releaseTakeover(
    sessionId: BrowserSessionId,
    orgId: OrgId,
    actorId: UserId,
  ): Promise<Result<BrowserSession>> {
    const session = await this.sessionRepo.getById(sessionId, orgId);
    if (!session) return err(AppError.notFound("BrowserSession", sessionId));

    if (session.status !== "human_control" && session.status !== "takeover_requested") {
      return err(
        AppError.badRequest(
          `Cannot release takeover for session with status "${session.status}". Session must be in "human_control" or "takeover_requested".`,
        ),
      );
    }

    const updated = await this.sessionRepo.updateStatus(sessionId, orgId, "active", {
      humanTakeover: false,
      takeoverBy: null,
    });
    if (!updated) return err(AppError.internal("Failed to release takeover"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "browser.takeover_released",
      resourceType: "browser_session",
      resourceId: sessionId,
      metadata: { previousStatus: session.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // closeSession
  // ---------------------------------------------------------------------------

  async closeSession(
    sessionId: BrowserSessionId,
    orgId: OrgId,
    actorId: UserId,
  ): Promise<Result<BrowserSession>> {
    const session = await this.sessionRepo.getById(sessionId, orgId);
    if (!session) return err(AppError.notFound("BrowserSession", sessionId));

    if (isBrowserTerminal(session.status)) {
      return err(
        AppError.badRequest(`Session is already in terminal state "${session.status}".`),
      );
    }

    // Transition through closing -> closed
    const closing = await this.sessionRepo.updateStatus(sessionId, orgId, "closing", {
      endedAt: toISODateString(new Date()),
    });
    if (!closing) return err(AppError.internal("Failed to close browser session"));

    const closed = await this.sessionRepo.updateStatus(sessionId, orgId, "closed", {
      humanTakeover: false,
      takeoverBy: null,
    });
    if (!closed) return ok(closing);

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "browser.session_closed",
      resourceType: "browser_session",
      resourceId: sessionId,
      metadata: { previousStatus: session.status },
    });

    return ok(closed);
  }

  // ---------------------------------------------------------------------------
  // checkActionPolicy — policy gate for risky browser actions
  // ---------------------------------------------------------------------------

  async checkActionPolicy(
    action: BrowserAction,
    sessionId: BrowserSessionId,
    orgId: OrgId,
    actorId: UserId,
  ): Promise<Result<{ allowed: boolean; policyDecision?: PolicyDecisionResult }>> {
    const isRisky = (RISKY_BROWSER_ACTIONS as readonly string[]).includes(action.type);

    if (!isRisky) {
      return ok({ allowed: true });
    }

    // 1. Policy engine evaluation (if policy service is attached)
    if (this._policyService) {
      const evalResult = await this._policyService.evaluate({
        orgId,
        subjectType: "browser_session",
        subjectId: sessionId,
        actionType: `browser.${action.type}`,
        requestedBy: actorId,
        context: { sessionId, actionType: action.type },
      });

      if (evalResult.ok) {
        const { decision } = evalResult.value;
        if (decision === "deny" || decision === "quarantined" || decision === "require_approval") {
          await this.audit.emit({
            orgId,
            actorId,
            actorType: "user",
            action: "browser.action_blocked",
            resourceType: "browser_session",
            resourceId: sessionId,
            metadata: { actionType: action.type, reason: "policy_denied", policyDecision: decision },
          });
          return ok({ allowed: false, policyDecision: decision });
        }
        // Policy says allow — proceed with session metadata check below
      }
    }

    // 2. Session metadata fallback: risky actions denied unless metadata allows them
    const session = await this.sessionRepo.getById(sessionId, orgId);
    if (!session) return err(AppError.notFound("BrowserSession", sessionId));

    const allowRisky = session.metadata?.allowRiskyActions === true;

    if (!allowRisky) {
      await this.audit.emit({
        orgId,
        actorId,
        actorType: "user",
        action: "browser.action_blocked",
        resourceType: "browser_session",
        resourceId: sessionId,
        metadata: { actionType: action.type, reason: "policy_denied" },
      });
      return ok({ allowed: false });
    }

    // Emit upload/download audit events when allowed
    if (action.type === "download_file") {
      await this.audit.emit({
        orgId,
        actorId,
        actorType: "user",
        action: "browser.downloaded",
        resourceType: "browser_session",
        resourceId: sessionId,
        metadata: { url: action.url },
      });
    }
    if (action.type === "upload_file") {
      await this.audit.emit({
        orgId,
        actorId,
        actorType: "user",
        action: "browser.uploaded",
        resourceType: "browser_session",
        resourceId: sessionId,
        metadata: { filePath: action.filePath },
      });
    }

    return ok({ allowed: true });
  }
}
