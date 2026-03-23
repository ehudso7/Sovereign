/**
 * @sovereign/observability
 *
 * Structured logging, metrics, and tracing utilities for the Sovereign platform.
 * Designed as a thin abstraction layer over concrete observability backends
 * (e.g., Pino, OpenTelemetry, Datadog).
 */

import type { OrgId, TenantContext } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// ---------------------------------------------------------------------------
// Log record
// ---------------------------------------------------------------------------

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly orgId?: OrgId;
  readonly service?: string;
  readonly context?: Record<string, unknown>;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

// ---------------------------------------------------------------------------
// Logger interface
// ---------------------------------------------------------------------------

export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: unknown, context?: Record<string, unknown>): void;
  /** Return a child logger with additional bound context. */
  child(bindings: Record<string, unknown>): Logger;
  /** Return a logger pre-bound to a TenantContext. */
  forTenant(ctx: TenantContext): Logger;
}

// ---------------------------------------------------------------------------
// Logger configuration
// ---------------------------------------------------------------------------

export interface LoggerConfig {
  /** Minimum log level to emit. @default "info" */
  level?: LogLevel;
  /** Name of the service / package emitting logs. */
  service?: string;
  /** Whether to pretty-print output (dev only). @default false */
  pretty?: boolean;
}

// ---------------------------------------------------------------------------
// Console logger implementation
// ---------------------------------------------------------------------------

class ConsoleLogger implements Logger {
  private readonly bindings: Record<string, unknown>;
  private readonly minLevel: number;
  private readonly service: string;

  constructor(config: LoggerConfig = {}, bindings: Record<string, unknown> = {}) {
    this.minLevel = LOG_LEVEL_RANK[config.level ?? "info"];
    this.service = config.service ?? "sovereign";
    this.bindings = bindings;
  }

  private emit(
    level: LogLevel,
    message: string,
    extra: Record<string, unknown> = {}
  ): void {
    if (LOG_LEVEL_RANK[level] < this.minLevel) return;

    const record: LogRecord = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...(this.bindings as Partial<LogRecord>),
      context: Object.keys(extra).length ? extra : undefined,
    };

    const output = JSON.stringify(record);

    if (level === "error" || level === "fatal") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.emit("trace", message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorContext =
      error instanceof Error
        ? { error: { name: error.name, message: error.message, stack: error.stack } }
        : error !== undefined
        ? { error }
        : {};
    this.emit("error", message, { ...errorContext, ...context });
  }

  fatal(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorContext =
      error instanceof Error
        ? { error: { name: error.name, message: error.message, stack: error.stack } }
        : error !== undefined
        ? { error }
        : {};
    this.emit("fatal", message, { ...errorContext, ...context });
  }

  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger(
      { level: levelFromRank(this.minLevel), service: this.service },
      { ...this.bindings, ...bindings }
    );
  }

  forTenant(ctx: TenantContext): Logger {
    return this.child({
      orgId: ctx.orgId,
      userId: ctx.userId,
      traceId: ctx.traceId,
    });
  }
}

function levelFromRank(rank: number): LogLevel {
  return (
    (Object.entries(LOG_LEVEL_RANK).find(([, r]) => r === rank)?.[0] as LogLevel) ??
    "info"
  );
}

// ---------------------------------------------------------------------------
// Factory & singleton
// ---------------------------------------------------------------------------

let _rootLogger: Logger | null = null;

/**
 * Create a configured logger instance.
 * Use `initLogger` once at application startup, then import `getLogger` everywhere.
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  return new ConsoleLogger(config);
}

/** Initialise (or replace) the process-wide root logger. */
export function initLogger(config: LoggerConfig = {}): Logger {
  _rootLogger = createLogger(config);
  return _rootLogger;
}

/** Return the root logger, initialising with defaults if not yet set up. */
export function getLogger(): Logger {
  if (!_rootLogger) {
    _rootLogger = createLogger();
  }
  return _rootLogger;
}

// ---------------------------------------------------------------------------
// Metrics (stub types – wire up OpenTelemetry / Prometheus as needed)
// ---------------------------------------------------------------------------

export type MetricUnit =
  | "count"
  | "bytes"
  | "milliseconds"
  | "seconds"
  | "percent";

export interface MetricLabels {
  readonly [key: string]: string | number | boolean;
}

export interface MetricsClient {
  increment(name: string, value?: number, labels?: MetricLabels): void;
  gauge(name: string, value: number, labels?: MetricLabels): void;
  histogram(name: string, value: number, unit: MetricUnit, labels?: MetricLabels): void;
  timing(name: string, durationMs: number, labels?: MetricLabels): void;
}

/** No-op metrics client used in tests or when metrics are disabled. */
export const noopMetrics: MetricsClient = {
  increment: () => undefined,
  gauge: () => undefined,
  histogram: () => undefined,
  timing: () => undefined,
};

// ---------------------------------------------------------------------------
// Span / tracing helpers (stub types)
// ---------------------------------------------------------------------------

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: "ok" | "error", message?: string): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span;
}
