// ---------------------------------------------------------------------------
// Browser worker entry point — Phase 7
// ---------------------------------------------------------------------------

import { PlaywrightProvider } from "./playwright-provider.js";
import { SessionManager } from "./session-manager.js";

const provider = new PlaywrightProvider();
const sessionManager = new SessionManager();

const start = async () => {
  console.warn("[worker-browser] Starting browser worker...");

  const available = await provider.isAvailable();
  if (!available) {
    console.warn("[worker-browser] Playwright browsers not available. Install with: npx playwright install chromium");
  } else {
    console.warn("[worker-browser] Playwright available. Browser worker ready.");
  }

  sessionManager.start();

  console.warn("[worker-browser] Browser worker started. Active sessions: 0");
};

const shutdown = async () => {
  console.warn("[worker-browser] Shutting down browser worker...");
  sessionManager.stop();
  await sessionManager.closeAll();
  console.warn("[worker-browser] All browser sessions closed. Exiting.");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { provider, sessionManager };

start().catch((err) => {
  console.warn("[worker-browser] Failed to start browser worker:", err);
  process.exit(1);
});
