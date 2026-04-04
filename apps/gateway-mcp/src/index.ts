// ---------------------------------------------------------------------------
// MCP Gateway — Connector runtime and tool execution gateway
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { registerBuiltinConnectors } from "./connectors/index.js";
import { listTools } from "./registry.js";

// Register all built-in connectors on startup
registerBuiltinConnectors();

// Export gateway utilities for use by API server and worker
export { executeTool, getTool, listTools, listToolsForConnector, registerTool, clearRegistry } from "./registry.js";
export type { ToolDefinition, ToolExecutionContext, ToolExecutionResult, ToolHandler, ToolParameter } from "./registry.js";
export { registerBuiltinConnectors } from "./connectors/index.js";
export { BUILTIN_CONNECTORS, BUILTIN_SKILLS } from "./catalog.js";
export type { CatalogConnector, CatalogSkill } from "./catalog.js";

const isDirectRun = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const port = parseInt(process.env.PORT ?? "3003", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "gateway-mcp",
          tools: listTools().length,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (url === "/tools") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ data: listTools() }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, host, () => {
    console.warn(`[gateway-mcp] listening on http://${host}:${port}`);
  });
}

if (!isDirectRun) {
  process.on("SIGINT", () => {
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });
}
