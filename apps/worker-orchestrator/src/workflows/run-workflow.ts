// ---------------------------------------------------------------------------
// Temporal workflow: Agent Run Execution
// ---------------------------------------------------------------------------
// Workflow code MUST be deterministic. All I/O goes through activities.

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  CancelledFailure,
} from "@temporalio/workflow";

import type {
  StartRunParams,
  ExecuteAgentParams,
  ExecuteAgentResult,
  RecordStepsParams,
  CompleteRunParams,
  FailRunParams,
  ExecuteToolCallParams,
  ExecuteToolCallResult,
} from "../activities/run-activities.js";

// ---------------------------------------------------------------------------
// Activity proxies (must go through Temporal for durability)
// ---------------------------------------------------------------------------

const activities = proxyActivities<{
  startRun: (params: StartRunParams) => Promise<void>;
  markRunning: (params: StartRunParams) => Promise<void>;
  executeAgent: (params: ExecuteAgentParams) => Promise<ExecuteAgentResult>;
  recordRunSteps: (params: RecordStepsParams) => Promise<void>;
  completeRun: (params: CompleteRunParams) => Promise<void>;
  failRun: (params: FailRunParams) => Promise<void>;
  executeToolCall: (params: ExecuteToolCallParams) => Promise<ExecuteToolCallResult>;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
  },
});

// ---------------------------------------------------------------------------
// Signals and queries
// ---------------------------------------------------------------------------

export const pauseSignal = defineSignal("pause");
export const resumeSignal = defineSignal("resume");
export const cancelSignal = defineSignal("cancel");
export const statusQuery = defineQuery<string>("status");

// ---------------------------------------------------------------------------
// Workflow input
// ---------------------------------------------------------------------------

export interface RunWorkflowInput {
  runId: string;
  orgId: string;
  instructions: string;
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  input: Record<string, unknown>;
  goals: readonly string[];
  executionProvider: string;
}

// ---------------------------------------------------------------------------
// Workflow implementation
// ---------------------------------------------------------------------------

export async function runAgentWorkflow(params: RunWorkflowInput): Promise<void> {
  let paused = false;
  let cancelled = false;
  let currentStatus = "starting";

  // Set up signal handlers
  setHandler(pauseSignal, () => {
    if (currentStatus === "running") {
      paused = true;
      currentStatus = "paused";
    }
  });

  setHandler(resumeSignal, () => {
    if (currentStatus === "paused") {
      paused = false;
      currentStatus = "running";
    }
  });

  setHandler(cancelSignal, () => {
    cancelled = true;
    currentStatus = "cancelling";
  });

  setHandler(statusQuery, () => currentStatus);

  try {
    // 1. Mark run as starting
    await activities.startRun({ runId: params.runId, orgId: params.orgId });
    currentStatus = "starting";

    // Check for early cancellation
    if (cancelled) {
      await activities.failRun({
        runId: params.runId,
        orgId: params.orgId,
        error: { code: "CANCELLED", message: "Run cancelled before execution" },
      });
      return;
    }

    // 2. Mark as running
    await activities.markRunning({ runId: params.runId, orgId: params.orgId });
    currentStatus = "running";

    // Check for pause before execution
    if (paused) {
      await condition(() => !paused || cancelled);
      if (cancelled) {
        await activities.failRun({
          runId: params.runId,
          orgId: params.orgId,
          error: { code: "CANCELLED", message: "Run cancelled while paused" },
        });
        return;
      }
    }

    // 3. Execute agent
    const result = await activities.executeAgent({
      runId: params.runId,
      orgId: params.orgId,
      instructions: params.instructions,
      modelConfig: params.modelConfig,
      input: params.input,
      goals: params.goals,
      executionProvider: params.executionProvider,
    });

    // 4. Record steps
    if (result.steps.length > 0) {
      await activities.recordRunSteps({
        runId: params.runId,
        orgId: params.orgId,
        steps: result.steps,
      });
    }

    // 5. Complete or fail based on result
    if (result.error) {
      await activities.failRun({
        runId: params.runId,
        orgId: params.orgId,
        error: result.error,
      });
    } else {
      await activities.completeRun({
        runId: params.runId,
        orgId: params.orgId,
        output: result.output,
        tokenUsage: result.tokenUsage,
      });
    }

    currentStatus = result.error ? "failed" : "completed";
  } catch (err) {
    if (err instanceof CancelledFailure) {
      // Temporal cancellation — run was cancelled externally
      currentStatus = "cancelled";
      return;
    }

    // Unexpected error
    const errorMessage = err instanceof Error ? err.message : "Unknown workflow error";
    await activities.failRun({
      runId: params.runId,
      orgId: params.orgId,
      error: { code: "WORKFLOW_ERROR", message: errorMessage },
    });
    currentStatus = "failed";
  }
}
