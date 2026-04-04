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

const temporalConfig = getTemporalRuntimeConfig();
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "sovereign-runs";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const start = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.warn(
        `Worker orchestrator connecting to Temporal (${temporalConfig.address}, namespace: ${temporalConfig.namespace})...` +
          (attempt > 1 ? ` [attempt ${attempt}/${MAX_RETRIES}]` : ""),
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
      await worker.run();
      return; // Clean exit
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);

      if (isLastAttempt) {
        console.error(`Worker orchestrator failed after ${MAX_RETRIES} attempts:`, err);
        process.exit(1);
      }

      console.warn(
        `Worker orchestrator connection failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoff / 1000}s...`,
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
