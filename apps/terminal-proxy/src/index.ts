// ---------------------------------------------------------------------------
// Terminal Proxy Service — WebSocket-to-PTY bridge (Phase 15)
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { SessionManager } from "./session-manager.js";
import { validateSessionToken } from "./auth.js";

const PORT = Number(process.env.TERMINAL_PROXY_PORT ?? 8100);
const IDLE_TIMEOUT_MS = Number(process.env.TERMINAL_IDLE_TIMEOUT_MS ?? 30 * 60 * 1000); // 30 min

const sessionManager = new SessionManager({ idleTimeoutMs: IDLE_TIMEOUT_MS });

const server = createServer((_req, res) => {
  if (_req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      activeSessions: sessionManager.activeCount(),
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (ws: WebSocket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const sessionId = url.searchParams.get("sessionId");
  const token = url.searchParams.get("token") ?? req.headers.authorization?.replace("Bearer ", "");

  if (!sessionId || !token) {
    ws.close(4001, "Missing sessionId or token");
    return;
  }

  const authResult = await validateSessionToken(token);
  if (!authResult.ok) {
    ws.close(4003, "Unauthorized");
    return;
  }

  try {
    sessionManager.attach(sessionId, ws, {
      orgId: authResult.orgId,
      userId: authResult.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session attach failed";
    ws.close(4002, message);
  }
});

// Graceful shutdown
const shutdown = () => {
  console.warn("[terminal-proxy] shutting down...");
  sessionManager.closeAll();
  wss.close();
  server.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => {
  console.warn(`[terminal-proxy] listening on :${PORT}`);
});

export { server, wss, sessionManager };
