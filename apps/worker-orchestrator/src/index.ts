// ---------------------------------------------------------------------------
// Temporal worker orchestrator entry point
// ---------------------------------------------------------------------------

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/run-activities.js";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "sovereign";
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;
const TEMPORAL_TLS_CERT = process.env.TEMPORAL_TLS_CERT;
const TEMPORAL_TLS_KEY = process.env.TEMPORAL_TLS_KEY;
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
        `Worker orchestrator connecting to Temporal (${TEMPORAL_ADDRESS}, namespace: ${TEMPORAL_NAMESPACE})...` +
          (attempt > 1 ? ` [attempt ${attempt}/${MAX_RETRIES}]` : ""),
      );

      const connectionOptions: Parameters<typeof NativeConnection.connect>[0] = {
        address: TEMPORAL_ADDRESS,
      };

      // Temporal Cloud auth: mTLS certs take priority, then API key
      if (TEMPORAL_TLS_CERT && TEMPORAL_TLS_KEY) {
        connectionOptions.tls = {
          clientCertPair: {
            crt: Buffer.from(TEMPORAL_TLS_CERT, "base64"),
            key: Buffer.from(TEMPORAL_TLS_KEY, "base64"),
          },
        };
      } else if (TEMPORAL_API_KEY) {
        connectionOptions.tls = true;
        connectionOptions.apiKey = TEMPORAL_API_KEY;
      }

      const connection = await NativeConnection.connect(connectionOptions);

      const worker = await Worker.create({
        connection,
        namespace: TEMPORAL_NAMESPACE,
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
