// ---------------------------------------------------------------------------
// Playwright-based local browser provider — Phase 7
// ---------------------------------------------------------------------------

import { chromium, firefox, webkit, type Browser, type Page, type BrowserType } from "playwright";
import type { BrowserContext, BrowserProvider } from "./browser-provider.js";

const BROWSER_TYPES: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

class PlaywrightBrowserContext implements BrowserContext {
  constructor(
    readonly sessionId: string,
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }

  async click(selector: string): Promise<void> {
    await this.page.click(selector, { timeout: 10_000 });
  }

  async type(selector: string, text: string): Promise<void> {
    await this.page.fill(selector, text, { timeout: 10_000 });
  }

  async select(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value, { timeout: 10_000 });
  }

  async waitForSelector(selector: string, timeout = 10_000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async extractText(selector: string): Promise<string> {
    const el = await this.page.waitForSelector(selector, { timeout: 10_000 });
    return el ? await el.textContent() ?? "" : "";
  }

  async screenshot(): Promise<Buffer> {
    return await this.page.screenshot({ type: "png", fullPage: false }) as Buffer;
  }

  async uploadFile(selector: string, filePath: string): Promise<void> {
    const input = await this.page.waitForSelector(selector, { timeout: 10_000 });
    if (input) {
      await input.setInputFiles(filePath);
    }
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }

  async close(): Promise<void> {
    try {
      await this.page.close();
    } catch {
      // page may already be closed
    }
    try {
      await this.browser.close();
    } catch {
      // browser may already be closed
    }
  }
}

export class PlaywrightProvider implements BrowserProvider {
  readonly name = "playwright-local";

  async launch(browserType = "chromium"): Promise<BrowserContext> {
    const factory = BROWSER_TYPES[browserType];
    if (!factory) {
      throw new Error(`Unsupported browser type: ${browserType}. Supported: chromium, firefox, webkit`);
    }

    const browser = await factory.launch({
      headless: true,
      args: browserType === "chromium" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: "SovereignBrowser/1.0",
    });

    const page = await context.newPage();
    const sessionId = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new PlaywrightBrowserContext(sessionId, browser, page);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      return true;
    } catch {
      return false;
    }
  }
}
