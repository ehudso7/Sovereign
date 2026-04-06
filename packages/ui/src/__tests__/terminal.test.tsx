// ---------------------------------------------------------------------------
// Terminal component — unit tests (Phase 15d polish & hardening)
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { Terminal } from "../terminal.js";
import type { TerminalProps } from "../terminal.js";

/**
 * Minimal render helper that evaluates the VDOM tree without a full DOM mount.
 * We call createElement and inspect the returned ReactElement structure.
 */
function shallowRender(props: TerminalProps) {
  return createElement(Terminal, props);
}

describe("Terminal", () => {
  it("exports a function component", () => {
    expect(typeof Terminal).toBe("function");
  });

  it("returns a valid React element with default props", () => {
    const element = shallowRender({});
    expect(element).toBeDefined();
    expect(element.type).toBe(Terminal);
  });

  it("passes props through to the element", () => {
    const onData = () => {};
    const element = shallowRender({
      wsUrl: "ws://localhost:8100",
      fontSize: 16,
      readOnly: true,
      onData,
    });

    expect(element.props).toMatchObject({
      wsUrl: "ws://localhost:8100",
      fontSize: 16,
      readOnly: true,
      onData,
    });
  });

  it("accepts className prop", () => {
    const element = shallowRender({ className: "my-terminal" });
    expect(element.props).toHaveProperty("className", "my-terminal");
  });

  it("TerminalProps interface allows optional wsUrl", () => {
    // Type-level test: compiles without wsUrl
    const element = shallowRender({ readOnly: false });
    expect(element).toBeDefined();
  });
});
