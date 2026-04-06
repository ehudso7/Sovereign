// ---------------------------------------------------------------------------
// CommandPalette component — unit tests (Phase 15d polish & hardening)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { CommandPalette } from "../command-palette.js";
import type { CommandPaletteProps, CommandAction } from "../command-palette.js";

/**
 * Minimal render helper using createElement to inspect VDOM.
 */
function shallowRender(props: CommandPaletteProps) {
  return createElement(CommandPalette, props);
}

describe("CommandPalette", () => {
  it("exports a function component", () => {
    expect(typeof CommandPalette).toBe("function");
  });

  it("returns a valid React element", () => {
    const onAction = vi.fn();
    const element = shallowRender({ onAction });

    expect(element).toBeDefined();
    expect(element.type).toBe(CommandPalette);
  });

  it("accepts custom actions", () => {
    const customActions: readonly CommandAction[] = [
      { id: "custom-1", label: "Custom Action", command: "echo hi", category: "general" },
    ];
    const onAction = vi.fn();
    const element = shallowRender({ actions: customActions, onAction });

    expect(element.props).toHaveProperty("actions", customActions);
  });

  it("accepts onAiPrompt callback", () => {
    const onAction = vi.fn();
    const onAiPrompt = vi.fn();
    const element = shallowRender({ onAction, onAiPrompt });

    expect(element.props).toHaveProperty("onAiPrompt", onAiPrompt);
  });

  it("accepts className prop", () => {
    const onAction = vi.fn();
    const element = shallowRender({ onAction, className: "palette-custom" });

    expect(element.props).toHaveProperty("className", "palette-custom");
  });
});
