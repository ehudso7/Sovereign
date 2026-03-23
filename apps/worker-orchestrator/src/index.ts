// ---------------------------------------------------------------------------
// Temporal worker orchestrator entry point
// ---------------------------------------------------------------------------

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/run-activities.js";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "sovereign";
const TASK_QUEUE = "sovereign-runs";

const start = async () => {
  console.warn(`Worker orchestrator starting (${TEMPORAL_ADDRESS}, namespace: ${TEMPORAL_NAMESPACE})...`);

  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL("./workflows/run-workflow.js", import.meta.url).pathname,
    activities,
  });

  console.warn("Worker orchestrator started. Polling for tasks...");
  await worker.run();
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
