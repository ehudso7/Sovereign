// ---------------------------------------------------------------------------
// Temporal client — used by the API server to start/signal/query workflows
// ---------------------------------------------------------------------------

import { Client, Connection } from "@temporalio/client";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "sovereign";
export const TASK_QUEUE = "sovereign-runs";

let _client: Client | null = null;

/**
 * Get or create a singleton Temporal client.
 * In development/test, this may fail if Temporal is not running —
 * the run service handles this gracefully.
 */
export async function getTemporalClient(): Promise<Client> {
  if (_client) return _client;

  const connection = await Connection.connect({
    address: TEMPORAL_ADDRESS,
  });

  _client = new Client({
    connection,
    namespace: TEMPORAL_NAMESPACE,
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
