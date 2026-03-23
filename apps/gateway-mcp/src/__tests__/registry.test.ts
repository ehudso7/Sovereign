import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTool,
  getTool,
  listTools,
  listToolsForConnector,
  executeTool,
  clearRegistry,
} from "../registry.js";
import { registerEchoConnector } from "../connectors/echo.js";
import { registerWeatherConnector } from "../connectors/weather.js";
import type { ToolDefinition, ToolHandler, ToolExecutionContext } from "../registry.js";

describe("Gateway Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  // ---------------------------------------------------------------------------
  // registerTool / getTool
  // ---------------------------------------------------------------------------

  describe("registerTool", () => {
    it("registers a tool", () => {
      const definition: ToolDefinition = {
        name: "test-tool",
        description: "A test tool",
        parameters: [{ name: "input", type: "string", description: "Input value", required: true }],
        connectorSlug: "test-connector",
      };
      const handler: ToolHandler = async () => ({ output: { result: "ok" }, latencyMs: 1 });

      registerTool(definition, handler);

      const tool = getTool("test-tool");
      expect(tool).toBeDefined();
      expect(tool!.definition.name).toBe("test-tool");
    });
  });

  describe("getTool", () => {
    it("returns registered tool", () => {
      const definition: ToolDefinition = {
        name: "my-tool",
        description: "My tool",
        parameters: [],
        connectorSlug: "my-connector",
      };
      const handler: ToolHandler = async () => ({ output: {}, latencyMs: 0 });
      registerTool(definition, handler);

      const tool = getTool("my-tool");
      expect(tool).toBeDefined();
      expect(tool!.definition.connectorSlug).toBe("my-connector");
    });

    it("returns undefined for unknown tool", () => {
      const tool = getTool("nonexistent");
      expect(tool).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // listTools / listToolsForConnector
  // ---------------------------------------------------------------------------

  describe("listTools", () => {
    it("lists all registered tools", () => {
      const handler: ToolHandler = async () => ({ output: {}, latencyMs: 0 });
      registerTool(
        { name: "tool-a", description: "A", parameters: [], connectorSlug: "conn-1" },
        handler,
      );
      registerTool(
        { name: "tool-b", description: "B", parameters: [], connectorSlug: "conn-2" },
        handler,
      );

      const tools = listTools();
      expect(tools.length).toBe(2);
      const names = tools.map((t) => t.name);
      expect(names).toContain("tool-a");
      expect(names).toContain("tool-b");
    });
  });

  describe("listToolsForConnector", () => {
    it("filters by connector slug", () => {
      const handler: ToolHandler = async () => ({ output: {}, latencyMs: 0 });
      registerTool(
        { name: "tool-a", description: "A", parameters: [], connectorSlug: "conn-1" },
        handler,
      );
      registerTool(
        { name: "tool-b", description: "B", parameters: [], connectorSlug: "conn-2" },
        handler,
      );
      registerTool(
        { name: "tool-c", description: "C", parameters: [], connectorSlug: "conn-1" },
        handler,
      );

      const tools = listToolsForConnector("conn-1");
      expect(tools.length).toBe(2);
      const names = tools.map((t) => t.name);
      expect(names).toContain("tool-a");
      expect(names).toContain("tool-c");
    });
  });

  // ---------------------------------------------------------------------------
  // executeTool
  // ---------------------------------------------------------------------------

  describe("executeTool", () => {
    const ctx: ToolExecutionContext = {
      orgId: "org-1",
      runId: "run-1",
      connectorSlug: "test",
    };

    it("executes a tool successfully", async () => {
      const handler: ToolHandler = async (args) => ({
        output: { received: args.value },
        latencyMs: 5,
      });
      registerTool(
        { name: "exec-tool", description: "Exec", parameters: [], connectorSlug: "test" },
        handler,
      );

      const result = await executeTool("exec-tool", { value: "hello" }, ctx);
      expect(result.error).toBeUndefined();
      expect(result.output).toEqual({ received: "hello" });
    });

    it("returns error for unknown tool", async () => {
      const result = await executeTool("missing-tool", {}, ctx);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("TOOL_NOT_FOUND");
    });

    it("handles tool execution errors", async () => {
      const handler: ToolHandler = async () => {
        throw new Error("Something broke");
      };
      registerTool(
        { name: "broken-tool", description: "Broken", parameters: [], connectorSlug: "test" },
        handler,
      );

      const result = await executeTool("broken-tool", {}, ctx);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("TOOL_EXECUTION_ERROR");
      expect(result.error!.message).toContain("Something broke");
    });
  });

  // ---------------------------------------------------------------------------
  // clearRegistry
  // ---------------------------------------------------------------------------

  describe("clearRegistry", () => {
    it("clears all tools", () => {
      const handler: ToolHandler = async () => ({ output: {}, latencyMs: 0 });
      registerTool(
        { name: "tool-x", description: "X", parameters: [], connectorSlug: "conn" },
        handler,
      );
      expect(listTools().length).toBe(1);

      clearRegistry();
      expect(listTools().length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Echo connector
  // ---------------------------------------------------------------------------

  describe("echo connector", () => {
    beforeEach(() => {
      registerEchoConnector();
    });

    it("echo tool returns expected output", async () => {
      const ctx: ToolExecutionContext = {
        orgId: "org-1",
        runId: "run-1",
        connectorSlug: "echo",
      };

      const result = await executeTool("echo", { message: "hello world" }, ctx);
      expect(result.error).toBeUndefined();
      expect(result.output.echoed).toBe("hello world");
      expect(result.output.reversed).toBe("dlrow olleh");
      expect(result.output.length).toBe(11);
    });

    it("current_time tool returns timestamps", async () => {
      const ctx: ToolExecutionContext = {
        orgId: "org-1",
        runId: "run-1",
        connectorSlug: "echo",
      };

      const result = await executeTool("current_time", {}, ctx);
      expect(result.error).toBeUndefined();
      expect(result.output.utc).toBeDefined();
      expect(typeof result.output.utc).toBe("string");
      expect(result.output.unix).toBeDefined();
      expect(typeof result.output.unix).toBe("number");
    });
  });

  // ---------------------------------------------------------------------------
  // Weather connector
  // ---------------------------------------------------------------------------

  describe("weather connector", () => {
    beforeEach(() => {
      registerWeatherConnector();
    });

    it("get_weather requires credentials", async () => {
      const ctx: ToolExecutionContext = {
        orgId: "org-1",
        runId: "run-1",
        connectorSlug: "weather",
      };

      const result = await executeTool("get_weather", { location: "London" }, ctx);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("AUTH_REQUIRED");
    });

    it("get_weather returns weather data with credentials", async () => {
      const ctx: ToolExecutionContext = {
        orgId: "org-1",
        runId: "run-1",
        connectorSlug: "weather",
        credentials: { apiKey: "test-api-key-12345" },
      };

      const result = await executeTool("get_weather", { location: "London" }, ctx);
      expect(result.error).toBeUndefined();
      expect(result.output.location).toBe("London");
      expect(typeof result.output.temperature_c).toBe("number");
      expect(typeof result.output.condition).toBe("string");
      expect(typeof result.output.humidity_pct).toBe("number");
      expect(result.output.provider).toBe("weather-dev");
    });
  });
});
