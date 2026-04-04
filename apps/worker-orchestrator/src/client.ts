// ---------------------------------------------------------------------------
// Temporal client — used by the API server to start/signal/query workflows
// ---------------------------------------------------------------------------

import { Client, Connection } from "@temporalio/client";
import { getTemporalClientConnectionOptions, getTemporalRuntimeConfig } from "./temporal-config.js";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "sovereign";
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;
const TEMPORAL_TLS_CERT = process.env.TEMPORAL_TLS_CERT;
const TEMPORAL_TLS_KEY = process.env.TEMPORAL_TLS_KEY;
export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "sovereign-runs";

let _client: Client | null = null;

/**
 * Get or create a singleton Temporal client.
 * In development/test, this may fail if Temporal is not running —
 * the run service handles this gracefully.
 */
export async function getTemporalClient(): Promise<Client> {
  if (_client) return _client;

  const connectionOptions: Parameters<typeof Connection.connect>[0] = {
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

  const connection = await Connection.connect(connectionOptions);

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
