// ---------------------------------------------------------------------------
// Temporal worker orchestrator entry point
// ---------------------------------------------------------------------------

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/run-activities.js";
import {
  formatTemporalConnectionHints,
  getTemporalRuntimeConfig,
  getTemporalWorkerConnectionOptions,
} from "./temporal-config.js";

const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "sovereign-runs";
const temporalConfig = getTemporalRuntimeConfig();

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const start = async () => {
  let attempt = 0;

  // Retry indefinitely — Railway (or any orchestrator) will keep the process
  // alive, and exiting only causes a "Crashed" status with restart churn.
  while (true) {
    attempt++;
    try {
      console.warn(
        `Worker orchestrator connecting to Temporal (${temporalConfig.address}, namespace: ${temporalConfig.namespace})...` +
          (attempt > 1 ? ` [attempt ${attempt}]` : ""),
      );

      const connection = await NativeConnection.connect(getTemporalWorkerConnectionOptions());

      const worker = await Worker.create({
        connection,
        namespace: temporalConfig.namespace,
        taskQueue: TASK_QUEUE,
        workflowsPath: new URL("./workflows/run-workflow.js", import.meta.url).pathname,
        activities,
      });

      console.warn("Worker orchestrator started. Polling for tasks...");
      attempt = 0; // Reset on successful connection
      await worker.run();
      return; // Clean exit
    } catch (err) {
      const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, Math.min(attempt - 1, 5)), MAX_DELAY_MS);

      console.warn(
        `Worker orchestrator connection failed (attempt ${attempt}), retrying in ${backoff / 1000}s...`,
        err instanceof Error ? err.message : err,
      );
      for (const hint of formatTemporalConnectionHints(err, temporalConfig)) {
        console.warn(`Worker orchestrator hint: ${hint}`);
      }
      await delay(backoff);
    }
  }
};

const shutdown = async () => {
  console.warn("Worker orchestrator shutting down...");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  console.error("Failed to start worker orchestrator:", err);
  process.exit(1);
});
