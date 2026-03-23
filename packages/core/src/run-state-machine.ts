// ---------------------------------------------------------------------------
// Run state machine — centralized state transition validation
// ---------------------------------------------------------------------------

import type { RunStatus } from "./entities.js";

/**
 * Valid state transitions for runs.
 * Key: current status, Value: set of valid next statuses.
 */
const VALID_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["starting", "cancelling"],
  starting: ["running", "failed"],
  running: ["paused", "cancelling", "completed", "failed"],
  paused: ["running", "cancelling"],
  cancelling: ["cancelled", "failed"],
  cancelled: [],
  failed: [],
  completed: [],
};

/** Terminal states — no further transitions allowed. */
export const TERMINAL_STATES: readonly RunStatus[] = ["cancelled", "failed", "completed"];

/** Check whether a transition from `from` to `to` is valid. */
export function isValidTransition(from: RunStatus, to: RunStatus): boolean {
  return (VALID_TRANSITIONS[from] as readonly string[]).includes(to);
}

/** Assert a transition is valid, throwing a descriptive error if not. */
export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid run state transition: ${from} → ${to}`);
  }
}

/** Check whether a run status is terminal (no further transitions). */
export function isTerminal(status: RunStatus): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(status);
}
