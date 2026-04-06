// ---------------------------------------------------------------------------
// PTY Bridge — wraps command execution with sanitization and isolation
// ---------------------------------------------------------------------------

import { exec } from "node:child_process";
import { resolve } from "node:path";

/** Default command execution timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Commands (or patterns) that are blocked for safety.
 * Each entry is tested as a case-insensitive regex against the full command.
 */
export const BLOCKED_COMMANDS: readonly string[] = [
  "rm\\s+-rf\\s+/\\s*$",
  "rm\\s+-rf\\s+/\\*",
  "rm\\s+-rf\\s+--no-preserve-root",
  "mkfs\\.",
  "dd\\s+if=.*of=/dev/",
  ":(){ :|:& };:",
  "chmod\\s+-R\\s+777\\s+/\\s*$",
  "chown\\s+-R\\s+.*\\s+/\\s*$",
  "shutdown",
  "reboot",
  "halt",
  "init\\s+[06]",
  "systemctl\\s+(poweroff|reboot|halt)",
  "kill\\s+-9\\s+-1",
  "killall\\s+-9",
  "\\bformat\\b.*c:",
  "wget.*\\|\\s*(sh|bash)",
  "curl.*\\|\\s*(sh|bash)",
] as const;

/** Pre-compiled regex patterns for command blocking. */
const BLOCKED_PATTERNS: readonly RegExp[] = BLOCKED_COMMANDS.map(
  (pattern) => new RegExp(pattern, "i"),
);

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * PtyBridge wraps command execution in a child process with:
 * - Command sanitization (blocks dangerous patterns)
 * - Working directory tracking
 * - Environment variable isolation per session
 * - Execution timeout protection
 */
export class PtyBridge {
  private cwd: string;
  private readonly env: Map<string, string>;
  private readonly timeoutMs: number;

  constructor(options?: { cwd?: string; timeoutMs?: number }) {
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.env = new Map();
  }

  /** Get the current working directory. */
  getCwd(): string {
    return this.cwd;
  }

  /** Set the current working directory. */
  setCwd(dir: string): void {
    this.cwd = resolve(this.cwd, dir);
  }

  /** Set an environment variable for this session. */
  setEnv(key: string, value: string): void {
    this.env.set(key, value);
  }

  /** Get a snapshot of session-specific environment variables. */
  getEnvSnapshot(): Readonly<Record<string, string>> {
    const snapshot: Record<string, string> = {};
    for (const [key, value] of this.env) {
      snapshot[key] = value;
    }
    return snapshot;
  }

  /**
   * Execute a command string with sanitization and timeout protection.
   *
   * - Rejects blocked commands before execution.
   * - Handles `cd` as a special case to update the working directory.
   * - Handles `export KEY=VALUE` to set session env vars.
   * - All other commands run via child_process.exec.
   */
  async execute(command: string): Promise<ExecResult> {
    const trimmed = command.trim();

    if (!trimmed) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }

    // Check blocked commands
    const blocked = this.isBlocked(trimmed);
    if (blocked) {
      return {
        stdout: "",
        stderr: `Blocked: command matched security policy`,
        exitCode: 126,
      };
    }

    // Handle `cd` as a built-in
    if (trimmed === "cd" || trimmed.startsWith("cd ")) {
      return this.handleCd(trimmed);
    }

    // Handle `export KEY=VALUE` to set env vars
    const exportMatch = /^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (exportMatch) {
      const key = exportMatch[1];
      const value = exportMatch[2];
      if (key) {
        this.env.set(key, value ?? "");
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    }

    return this.execInShell(trimmed);
  }

  /** Check if a command matches any blocked pattern. */
  isBlocked(command: string): boolean {
    return BLOCKED_PATTERNS.some((pattern) => pattern.test(command));
  }

  /** Handle `cd` directory changes. */
  private handleCd(command: string): ExecResult {
    const parts = command.split(/\s+/);
    const target = parts[1] ?? process.env.HOME ?? "/";

    try {
      this.cwd = resolve(this.cwd, target);
      return { stdout: "", stderr: "", exitCode: 0 };
    } catch {
      return { stdout: "", stderr: `cd: no such file or directory: ${target}`, exitCode: 1 };
    }
  }

  /** Execute a command in a child shell process. */
  private execInShell(command: string): Promise<ExecResult> {
    // Build env with session overrides
    const mergedEnv: Record<string, string | undefined> = { ...process.env };
    for (const [key, value] of this.env) {
      mergedEnv[key] = value;
    }

    return new Promise<ExecResult>((resolvePromise) => {
      exec(
        command,
        {
          cwd: this.cwd,
          timeout: this.timeoutMs,
          env: mergedEnv,
          maxBuffer: 1024 * 1024, // 1MB
          shell: "/bin/sh",
        },
        (error, stdout, stderr) => {
          if (error && "killed" in error && error.killed) {
            resolvePromise({
              stdout: stdout ?? "",
              stderr: `Command timed out after ${this.timeoutMs}ms`,
              exitCode: 124,
            });
            return;
          }

          const exitCode = error && "code" in error && typeof error.code === "number"
            ? error.code
            : error
              ? 1
              : 0;

          resolvePromise({
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode,
          });
        },
      );
    });
  }
}
