import { Connection } from "@temporalio/client";
import { NativeConnection } from "@temporalio/worker";

type TemporalClientConnectionOptions = NonNullable<Parameters<typeof Connection.connect>[0]>;
type TemporalWorkerConnectionOptions = NonNullable<Parameters<typeof NativeConnection.connect>[0]>;

export interface TemporalRuntimeConfig {
  rawAddress: string;
  address: string;
  namespace: string;
  apiKey?: string;
  tlsCert?: Buffer;
  tlsKey?: Buffer;
  usesCloudEndpoint: boolean;
  usesRailwayPublicEndpoint: boolean;
  basicAuthUser?: string;
  basicAuthPassword?: string;
}

function readOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeTemporalAddress(address: string): string {
  return address
    .trim()
    .replace(/^(https?:\/\/)/i, "")
    .replace(/\/+$/, "");
}

function decodePemEnv(name: string, value: string): Buffer {
  const normalized = value.trim().replace(/\\n/g, "\n");

  if (normalized.includes("BEGIN ")) {
    return Buffer.from(normalized, "utf8");
  }

  const decoded = Buffer.from(normalized, "base64").toString("utf8");
  if (!decoded.includes("BEGIN ")) {
    throw new Error(`${name} must be a PEM block or a base64-encoded PEM block.`);
  }

  return Buffer.from(decoded, "utf8");
}

export function isTemporalCloudAddress(address: string): boolean {
  return /\.tmprl\.cloud(?::\d+)?$/i.test(address);
}

export function isRailwayPublicAddress(address: string): boolean {
  return /\.up\.railway\.app(?::\d+)?$/i.test(address);
}

export function getTemporalRuntimeConfig(env: NodeJS.ProcessEnv = process.env): TemporalRuntimeConfig {
  const rawAddress = env.TEMPORAL_ADDRESS ?? "localhost:7233";
  let address = normalizeTemporalAddress(rawAddress);
  const namespace = env.TEMPORAL_NAMESPACE?.trim() || "sovereign";
  const apiKey = readOptionalEnv(env.TEMPORAL_API_KEY);
  const tlsCertValue = readOptionalEnv(env.TEMPORAL_TLS_CERT);
  const tlsKeyValue = readOptionalEnv(env.TEMPORAL_TLS_KEY);
  const basicAuthUser = readOptionalEnv(env.TEMPORAL_BASIC_AUTH_USER);
  const basicAuthPassword = readOptionalEnv(env.TEMPORAL_BASIC_AUTH_PASSWORD);

  if (Boolean(tlsCertValue) !== Boolean(tlsKeyValue)) {
    throw new Error("TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY must be set together.");
  }

  const isRailwayPublic = isRailwayPublicAddress(address);

  // Railway public URLs proxy gRPC over HTTPS (port 443), not the default 7233.
  if (isRailwayPublic && !/:(\d+)$/.test(address)) {
    address = `${address}:443`;
  }

  return {
    rawAddress,
    address,
    namespace,
    apiKey,
    tlsCert: tlsCertValue ? decodePemEnv("TEMPORAL_TLS_CERT", tlsCertValue) : undefined,
    tlsKey: tlsKeyValue ? decodePemEnv("TEMPORAL_TLS_KEY", tlsKeyValue) : undefined,
    usesCloudEndpoint: isTemporalCloudAddress(address),
    usesRailwayPublicEndpoint: isRailwayPublic,
    basicAuthUser,
    basicAuthPassword,
  };
}

function buildTlsConfig(config: TemporalRuntimeConfig): TemporalClientConnectionOptions["tls"] {
  if (config.tlsCert && config.tlsKey) {
    return {
      clientCertPair: {
        crt: config.tlsCert,
        key: config.tlsKey,
      },
    };
  }

  // TLS is required for Temporal Cloud, Railway public URLs, and API key auth
  if (config.usesCloudEndpoint || config.usesRailwayPublicEndpoint || config.apiKey) {
    return true;
  }

  return undefined;
}

function buildMetadata(config: TemporalRuntimeConfig): Record<string, string> | undefined {
  if (config.basicAuthUser && config.basicAuthPassword) {
    const credentials = Buffer.from(`${config.basicAuthUser}:${config.basicAuthPassword}`).toString("base64");
    return { authorization: `Basic ${credentials}` };
  }
  return undefined;
}

export function getTemporalClientConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): TemporalClientConnectionOptions {
  const config = getTemporalRuntimeConfig(env);
  const tls = buildTlsConfig(config);
  const metadata = buildMetadata(config);

  return {
    address: config.address,
    ...(tls ? { tls } : {}),
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function getTemporalWorkerConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): TemporalWorkerConnectionOptions {
  const config = getTemporalRuntimeConfig(env);
  const tls = buildTlsConfig(config);
  const metadata = buildMetadata(config);

  return {
    address: config.address,
    ...(tls ? { tls } : {}),
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function formatTemporalConnectionHints(error: unknown, config: TemporalRuntimeConfig): string[] {
  const message = error instanceof Error ? error.message : String(error);
  const hints = new Set<string>();

  if (config.rawAddress !== config.address) {
    hints.add(
      `Normalized TEMPORAL_ADDRESS from "${config.rawAddress}" to "${config.address}". Use bare host:port with no protocol or path.`,
    );
  }

  if (/dns error|lookup address|name or service not known|enotfound/i.test(message)) {
    hints.add(
      `TEMPORAL_ADDRESS "${config.address}" did not resolve in DNS.`,
    );

    if (/\.railway\.internal/i.test(config.address)) {
      hints.add(
        "Railway internal DNS (*.railway.internal) only works between services in the SAME Railway project. " +
        "If Temporal runs in a separate infra project, use its public Railway URL instead: " +
        "TEMPORAL_ADDRESS=<service>.up.railway.app (port 443 is added automatically, TLS is enabled automatically).",
      );
    } else if (config.usesCloudEndpoint) {
      hints.add(
        "Verify the exact namespace endpoint from Temporal Cloud connection info — the hostname itself must be provisioned.",
      );
    } else {
      hints.add(
        "If using Railway-hosted Temporal in the same project, use `<service-name>.railway.internal:7233`. " +
        "If Temporal is in a different Railway project, use its public URL: `<service>.up.railway.app`.",
      );
    }
  }

  if (config.usesCloudEndpoint && !config.apiKey && !(config.tlsCert && config.tlsKey)) {
    hints.add(
      "Temporal Cloud requires TLS. Set TEMPORAL_API_KEY or both TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY.",
    );
  }

  if (config.usesRailwayPublicEndpoint && !config.basicAuthUser) {
    hints.add(
      "If the Railway Temporal proxy requires basic auth, set TEMPORAL_BASIC_AUTH_USER and TEMPORAL_BASIC_AUTH_PASSWORD.",
    );
  }

  if (config.apiKey && config.tlsCert && config.tlsKey) {
    hints.add("Both TEMPORAL_API_KEY and mTLS certs are configured. This is valid, but make sure the namespace is set up for the auth mode you expect.");
  }

  return [...hints];
}
