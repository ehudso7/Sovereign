// ---------------------------------------------------------------------------
// Browser session state machine — centralized state transition validation
// ---------------------------------------------------------------------------

import type { BrowserSessionStatus } from "./entities.js";

const VALID_TRANSITIONS: Record<BrowserSessionStatus, readonly BrowserSessionStatus[]> = {
  provisioning: ["ready", "failed"],
  ready: ["active", "closing", "failed"],
  active: ["takeover_requested", "closing", "failed"],
  takeover_requested: ["human_control", "active", "closing", "failed"],
  human_control: ["active", "closing", "failed"],
  closing: ["closed", "failed"],
  closed: [],
  failed: [],
};

export const BROWSER_TERMINAL_STATES: readonly BrowserSessionStatus[] = ["closed", "failed"];

export function isValidBrowserTransition(from: BrowserSessionStatus, to: BrowserSessionStatus): boolean {
  return (VALID_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertBrowserTransition(from: BrowserSessionStatus, to: BrowserSessionStatus): void {
  if (!isValidBrowserTransition(from, to)) {
    throw new Error(`Invalid browser session state transition: ${from} → ${to}`);
  }
}

export function isBrowserTerminal(status: BrowserSessionStatus): boolean {
  return (BROWSER_TERMINAL_STATES as readonly string[]).includes(status);
}
