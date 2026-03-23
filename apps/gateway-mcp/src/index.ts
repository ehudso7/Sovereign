// ---------------------------------------------------------------------------
// MCP Gateway — Connector runtime and tool execution gateway
// ---------------------------------------------------------------------------

import { registerBuiltinConnectors } from "./connectors/index.js";

// Register all built-in connectors on startup
registerBuiltinConnectors();

// Export gateway utilities for use by API server and worker
export { executeTool, getTool, listTools, listToolsForConnector, registerTool, clearRegistry } from "./registry.js";
export type { ToolDefinition, ToolExecutionContext, ToolExecutionResult, ToolHandler, ToolParameter } from "./registry.js";
export { registerBuiltinConnectors } from "./connectors/index.js";
export { BUILTIN_CONNECTORS, BUILTIN_SKILLS } from "./catalog.js";
export type { CatalogConnector, CatalogSkill } from "./catalog.js";

// Process lifecycle
process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});
