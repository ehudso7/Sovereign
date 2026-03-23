// ---------------------------------------------------------------------------
// Echo connector — no-auth proof connector for testing
// ---------------------------------------------------------------------------

import { registerTool } from "../registry.js";
import type { ToolHandler } from "../registry.js";

const echoHandler: ToolHandler = async (args) => {
  const message = (args.message as string) ?? "";
  return {
    output: {
      echoed: message,
      reversed: message.split("").reverse().join(""),
      length: message.length,
      timestamp: new Date().toISOString(),
    },
    latencyMs: 1,
  };
};

const currentTimeHandler: ToolHandler = async () => {
  return {
    output: {
      utc: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
    },
    latencyMs: 1,
  };
};

export function registerEchoConnector(): void {
  registerTool(
    {
      name: "echo",
      description: "Echoes back the input message along with metadata (reversed text, length).",
      parameters: [
        { name: "message", type: "string", description: "Message to echo", required: true },
      ],
      connectorSlug: "echo",
    },
    echoHandler,
  );

  registerTool(
    {
      name: "current_time",
      description: "Returns the current UTC time and unix timestamp.",
      parameters: [],
      connectorSlug: "echo",
    },
    currentTimeHandler,
  );
}
