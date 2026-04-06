// ---------------------------------------------------------------------------
// Agent Provider Config Service — Phase 15c
// Manages per-org AI provider configurations.
// Stores reference IDs to secrets (never raw API keys).
// In-memory storage for Phase 15; will be DB-backed later.
// ---------------------------------------------------------------------------

import type { OrgId, Result } from "@sovereign/core";
import { ok, err, AppError, toISODateString } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = "openai" | "anthropic" | "google" | "deepseek";

export interface ProviderConfig {
  readonly provider: ProviderName;
  /** Reference ID to the secret stored in the secret broker — never a raw key */
  readonly apiKeyRefId: string;
  /** Default model to use for this provider */
  readonly defaultModel: string;
  /** Whether this provider is enabled for the org */
  readonly enabled: boolean;
  /** When the provider was configured */
  readonly configuredAt: string;
  /** When the config was last updated */
  readonly updatedAt: string;
}

export interface SetProviderConfigInput {
  /** Reference ID to the secret stored in the secret broker */
  apiKeyRefId: string;
  /** Default model to use for this provider */
  defaultModel: string;
  /** Whether this provider is enabled */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * In-memory store keyed by orgId -> provider -> config.
 * Shared across instances so factory-created services for the same org
 * see the same data within a single process lifetime.
 */
const orgConfigs = new Map<string, Map<ProviderName, ProviderConfig>>();

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service for managing per-org AI provider configurations.
 * Phase 15 uses in-memory storage; will be replaced with DB-backed repos.
 */
export class AgentProviderConfigService {
  constructor(private readonly orgId: OrgId) {}

  /**
   * List all configured providers for the org.
   */
  async listProviders(): Promise<Result<readonly ProviderConfig[]>> {
    const configs = orgConfigs.get(this.orgId);
    if (!configs) {
      return ok([]);
    }
    return ok([...configs.values()]);
  }

  /**
   * Get the configuration for a specific provider.
   */
  async getProviderConfig(provider: ProviderName): Promise<Result<ProviderConfig>> {
    const configs = orgConfigs.get(this.orgId);
    if (!configs) {
      return err(
        AppError.notFound("ProviderConfig", `${this.orgId}/${provider}`),
      );
    }

    const config = configs.get(provider);
    if (!config) {
      return err(
        AppError.notFound("ProviderConfig", `${this.orgId}/${provider}`),
      );
    }

    return ok(config);
  }

  /**
   * Set (create or update) the configuration for a provider.
   * The apiKeyRefId is a reference to a secret in the secret broker — never a raw key.
   */
  async setProviderConfig(
    provider: ProviderName,
    input: SetProviderConfigInput,
  ): Promise<Result<ProviderConfig>> {
    if (!input.apiKeyRefId || input.apiKeyRefId.trim().length === 0) {
      return err(
        AppError.badRequest("apiKeyRefId is required and must be a non-empty secret reference"),
      );
    }

    if (!input.defaultModel || input.defaultModel.trim().length === 0) {
      return err(
        AppError.badRequest("defaultModel is required"),
      );
    }

    let configs = orgConfigs.get(this.orgId);
    if (!configs) {
      configs = new Map<ProviderName, ProviderConfig>();
      orgConfigs.set(this.orgId, configs);
    }

    const now = toISODateString(new Date());
    const existing = configs.get(provider);

    const config: ProviderConfig = {
      provider,
      apiKeyRefId: input.apiKeyRefId.trim(),
      defaultModel: input.defaultModel.trim(),
      enabled: input.enabled,
      configuredAt: existing?.configuredAt ?? now,
      updatedAt: now,
    };

    configs.set(provider, config);
    return ok(config);
  }

  /**
   * Remove the configuration for a provider.
   */
  async removeProviderConfig(provider: ProviderName): Promise<Result<{ removed: true }>> {
    const configs = orgConfigs.get(this.orgId);
    if (!configs || !configs.has(provider)) {
      return err(
        AppError.notFound("ProviderConfig", `${this.orgId}/${provider}`),
      );
    }

    configs.delete(provider);
    return ok({ removed: true });
  }

  /**
   * Clear all configs for this org. Primarily for testing.
   */
  static clearAll(): void {
    orgConfigs.clear();
  }
}
