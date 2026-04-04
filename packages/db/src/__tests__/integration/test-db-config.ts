type ParsedPostgresUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const LOCAL_DOCKER_TEST_DATABASE_URL =
  "postgresql://sovereign:sovereign_dev@localhost:5432/sovereign";

function normalizeConnectionString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  const unwrapped = quoted ? trimmed.slice(1, -1).trim() : trimmed;
  return unwrapped || null;
}

function formatMissingEnvMessage(): string {
  return [
    "Integration tests require a PostgreSQL connection string.",
    "Set TEST_DATABASE_URL to the maintenance database used for create/drop operations.",
    "DATABASE_URL is accepted as a fallback, but TEST_DATABASE_URL is preferred so test infrastructure stays explicit.",
    `For the local Docker stack, use ${LOCAL_DOCKER_TEST_DATABASE_URL}.`,
  ].join(" ");
}

export function parsePostgresUrl(url: string): ParsedPostgresUrl {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(
      `Invalid PostgreSQL connection string: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Expected a PostgreSQL URL, received protocol "${parsed.protocol}".`);
  }

  const database = parsed.pathname.replace(/^\/+/, "");
  if (!parsed.hostname || !parsed.username || !parsed.password || !database) {
    throw new Error(
      "PostgreSQL URL must include host, username, password, and database name for integration tests.",
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(database),
  };
}

export function resolveIntegrationDatabaseConfig(): {
  connectionString: string;
  parsed: ParsedPostgresUrl;
  source: "TEST_DATABASE_URL" | "DATABASE_URL";
} {
  const testDatabaseUrl = normalizeConnectionString(process.env.TEST_DATABASE_URL);
  const databaseUrl = normalizeConnectionString(process.env.DATABASE_URL);
  const connectionString = testDatabaseUrl ?? databaseUrl;

  if (!connectionString) {
    throw new Error(formatMissingEnvMessage());
  }

  return {
    connectionString,
    parsed: parsePostgresUrl(connectionString),
    source: testDatabaseUrl ? "TEST_DATABASE_URL" : "DATABASE_URL",
  };
}

export function buildPostgresUrl(
  parsed: ParsedPostgresUrl,
  overrides: Partial<ParsedPostgresUrl> = {},
): string {
  const url = new URL("postgresql://placeholder");

  url.hostname = overrides.host ?? parsed.host;
  url.port = String(overrides.port ?? parsed.port);
  url.username = overrides.user ?? parsed.user;
  url.password = overrides.password ?? parsed.password;
  url.pathname = `/${overrides.database ?? parsed.database}`;

  return url.toString();
}
