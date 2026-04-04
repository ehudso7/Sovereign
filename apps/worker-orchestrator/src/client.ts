// ---------------------------------------------------------------------------
// Temporal client — used by the API server to start/signal/query workflows
// ---------------------------------------------------------------------------

import { Client, Connection } from "@temporalio/client";
import { getTemporalClientConnectionOptions, getTemporalRuntimeConfig } from "./temporal-config.js";

export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "sovereign-runs";

let _client: Client | null = null;

/**
 * Get or create a singleton Temporal client.
 * In development/test, this may fail if Temporal is not running —
 * the run service handles this gracefully.
 */
export async function getTemporalClient(): Promise<Client> {
  if (_client) return _client;

  const temporalConfig = getTemporalRuntimeConfig();
  const connection = await Connection.connect(getTemporalClientConnectionOptions());

  _client = new Client({
    connection,
    namespace: temporalConfig.namespace,
  });

  return _client;
}

/**
 * Check if Temporal is available. Returns false if connection fails.
 */
export async function isTemporalAvailable(): Promise<boolean> {
  try {
    await getTemporalClient();
    return true;
  } catch {
    return false;
  }
}
