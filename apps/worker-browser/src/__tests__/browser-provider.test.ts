import { describe, it, expect } from "vitest";
import { executeBrowserAction } from "../browser-provider.js";
import type { BrowserContext } from "../browser-provider.js";

function createMockContext(): BrowserContext {
  return {
    sessionId: "test-session-1",
    navigate: async () => {},
    click: async () => {},
    type: async () => {},
    select: async () => {},
    waitForSelector: async () => {},
    extractText: async () => "extracted text",
    screenshot: async () => Buffer.from("fake-screenshot"),
    uploadFile: async () => {},
    currentUrl: async () => "https://example.com",
    close: async () => {},
  };
}

describe("executeBrowserAction", () => {
  it("executes navigate action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "navigate", url: "https://example.com" });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ url: "https://example.com" });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("executes click action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "click", selector: "#btn" });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ selector: "#btn" });
  });

  it("executes type action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "type", selector: "#input", value: "hello" });
    expect(result.success).toBe(true);
  });

  it("executes select action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "select", selector: "#select", value: "opt1" });
    expect(result.success).toBe(true);
  });

  it("executes wait_for_selector action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "wait_for_selector", selector: ".loading" });
    expect(result.success).toBe(true);
  });

  it("executes extract_text action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "extract_text", selector: "h1" });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ text: "extracted text" });
  });

  it("executes screenshot action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "screenshot" });
    expect(result.success).toBe(true);
    expect(result.screenshotBuffer).toBeDefined();
    expect(result.output).toEqual({ size: 15 }); // "fake-screenshot" length
  });

  it("executes upload_file action", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, {
      type: "upload_file",
      selector: "input[type=file]",
      filePath: "/tmp/test.txt",
    });
    expect(result.success).toBe(true);
  });

  it("executes download_file action (session-level)", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "download_file" });
    expect(result.success).toBe(true);
  });

  it("returns error for navigate without url", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "navigate" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("navigate requires url");
  });

  it("returns error for click without selector", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "click" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("click requires selector");
  });

  it("returns error for type without value", async () => {
    const ctx = createMockContext();
    const result = await executeBrowserAction(ctx, { type: "type", selector: "#input" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("type requires selector and value");
  });

  it("handles context errors gracefully", async () => {
    const ctx: BrowserContext = {
      ...createMockContext(),
      navigate: async () => {
        throw new Error("Connection refused");
      },
    };
    const result = await executeBrowserAction(ctx, { type: "navigate", url: "https://example.com" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection refused");
  });
});
