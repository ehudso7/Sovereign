// ---------------------------------------------------------------------------
// Connector tool registry — holds callable tool implementations
// ---------------------------------------------------------------------------

export interface ToolParameter {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ToolParameter[];
  readonly connectorSlug: string;
}

export interface ToolExecutionContext {
  readonly orgId: string;
  readonly runId: string;
  readonly connectorSlug: string;
  readonly credentials?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  readonly output: Record<string, unknown>;
  readonly error?: { code: string; message: string };
  readonly latencyMs: number;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const _tools = new Map<string, RegisteredTool>();

export function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  _tools.set(definition.name, { definition, handler });
}

export function getTool(name: string): RegisteredTool | undefined {
  return _tools.get(name);
}

export function listTools(): ToolDefinition[] {
  return [..._tools.values()].map((t) => t.definition);
}

export function listToolsForConnector(connectorSlug: string): ToolDefinition[] {
  return [..._tools.values()]
    .filter((t) => t.definition.connectorSlug === connectorSlug)
    .map((t) => t.definition);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const tool = _tools.get(name);
  if (!tool) {
    return {
      output: {},
      error: { code: "TOOL_NOT_FOUND", message: `Tool "${name}" not found in registry` },
      latencyMs: 0,
    };
  }
  const startTime = Date.now();
  try {
    const result = await tool.handler(args, ctx);
    return { ...result, latencyMs: result.latencyMs || (Date.now() - startTime) };
  } catch (e) {
    return {
      output: {},
      error: {
        code: "TOOL_EXECUTION_ERROR",
        message: e instanceof Error ? e.message : "Unknown tool error",
      },
      latencyMs: Date.now() - startTime,
    };
  }
}

export function clearRegistry(): void {
  _tools.clear();
}
