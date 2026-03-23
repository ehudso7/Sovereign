// ---------------------------------------------------------------------------
// Browser provider abstraction — Phase 7
// ---------------------------------------------------------------------------

import type { BrowserActionType } from "@sovereign/core";

export interface BrowserContext {
  readonly sessionId: string;
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  select(selector: string, value: string): Promise<void>;
  waitForSelector(selector: string, timeout?: number): Promise<void>;
  extractText(selector: string): Promise<string>;
  screenshot(): Promise<Buffer>;
  uploadFile(selector: string, filePath: string): Promise<void>;
  currentUrl(): Promise<string>;
  close(): Promise<void>;
}

export interface BrowserProvider {
  readonly name: string;
  launch(browserType: string): Promise<BrowserContext>;
  isAvailable(): Promise<boolean>;
}

export interface BrowserActionRequest {
  readonly type: BrowserActionType;
  readonly selector?: string;
  readonly value?: string;
  readonly url?: string;
  readonly filePath?: string;
  readonly timeout?: number;
}

export interface BrowserActionResponse {
  readonly success: boolean;
  readonly output: Record<string, unknown>;
  readonly screenshotBuffer?: Buffer;
  readonly error?: string;
  readonly latencyMs: number;
}

export async function executeBrowserAction(
  ctx: BrowserContext,
  action: BrowserActionRequest,
): Promise<BrowserActionResponse> {
  const start = Date.now();
  try {
    switch (action.type) {
      case "navigate": {
        if (!action.url) throw new Error("navigate requires url");
        await ctx.navigate(action.url);
        return { success: true, output: { url: action.url }, latencyMs: Date.now() - start };
      }
      case "click": {
        if (!action.selector) throw new Error("click requires selector");
        await ctx.click(action.selector);
        return { success: true, output: { selector: action.selector }, latencyMs: Date.now() - start };
      }
      case "type": {
        if (!action.selector || action.value === undefined) throw new Error("type requires selector and value");
        await ctx.type(action.selector, action.value);
        return { success: true, output: { selector: action.selector }, latencyMs: Date.now() - start };
      }
      case "select": {
        if (!action.selector || action.value === undefined) throw new Error("select requires selector and value");
        await ctx.select(action.selector, action.value);
        return { success: true, output: { selector: action.selector, value: action.value }, latencyMs: Date.now() - start };
      }
      case "wait_for_selector": {
        if (!action.selector) throw new Error("wait_for_selector requires selector");
        await ctx.waitForSelector(action.selector, action.timeout);
        return { success: true, output: { selector: action.selector }, latencyMs: Date.now() - start };
      }
      case "extract_text": {
        if (!action.selector) throw new Error("extract_text requires selector");
        const text = await ctx.extractText(action.selector);
        return { success: true, output: { text }, latencyMs: Date.now() - start };
      }
      case "screenshot": {
        const buffer = await ctx.screenshot();
        return { success: true, output: { size: buffer.length }, screenshotBuffer: buffer, latencyMs: Date.now() - start };
      }
      case "upload_file": {
        if (!action.selector || !action.filePath) throw new Error("upload_file requires selector and filePath");
        await ctx.uploadFile(action.selector, action.filePath);
        return { success: true, output: { filePath: action.filePath }, latencyMs: Date.now() - start };
      }
      case "download_file": {
        // Downloads are captured by Playwright's download event, handled at session level
        return { success: true, output: { note: "download_handled_at_session_level" }, latencyMs: Date.now() - start };
      }
      default: {
        return { success: false, output: {}, error: `Unknown action type: ${action.type}`, latencyMs: Date.now() - start };
      }
    }
  } catch (e) {
    return {
      success: false,
      output: {},
      error: e instanceof Error ? e.message : "Unknown error",
      latencyMs: Date.now() - start,
    };
  }
}
