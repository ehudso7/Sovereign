import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, ConnectorId, Connector } from "@sovereign/core";
import { PgConnectorService } from "../../services/connector.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  TestConnectorRepo,
  TestConnectorInstallRepo,
  TestConnectorCredentialRepo,
  TestAuditRepo,
  type TestRepos,
} from "../helpers/test-repos.js";
import { clearRegistry, registerBuiltinConnectors } from "@sovereign/gateway-mcp";

describe("ConnectorService", () => {
  let repos: TestRepos;
  let connectorRepo: TestConnectorRepo;
  let installRepo: TestConnectorInstallRepo;
  let credentialRepo: TestConnectorCredentialRepo;
  let auditRepo: TestAuditRepo;
  let service: PgConnectorService;
  let orgId: OrgId;
  let userId: UserId;
  let seededConnector: Connector;

  beforeEach(async () => {
    repos = createTestRepos();
    connectorRepo = repos.connectors;
    installRepo = repos.connectorInstalls;
    credentialRepo = repos.connectorCredentials;
    auditRepo = repos.audit;

    service = new PgConnectorService(
      connectorRepo,
      installRepo,
      credentialRepo,
      new PgAuditEmitter(auditRepo),
    );

    // Create a test user and org
    const user = repos.users.createSync({ email: "owner@test.com", name: "Owner" });
    userId = user.id;
    const org = await repos.orgs.create({ name: "Test Org", slug: "test-org" });
    orgId = org.id;

    // Seed a connector in the catalog
    seededConnector = await connectorRepo.create({
      slug: "echo",
      name: "Echo & Utilities",
      description: "A simple utility connector for testing.",
      category: "utility",
      trustTier: "verified",
      authMode: "none",
      status: "active",
      tools: [
        { name: "echo", description: "Echoes back the input", parameters: {} },
      ],
      scopes: [
        { id: "echo:read", name: "Echo Read", description: "Echo messages and read time" },
      ],
    });

    // Register connector tools in the gateway registry for test()
    clearRegistry();
    registerBuiltinConnectors();
  });

  // ---------------------------------------------------------------------------
  // listCatalog
  // ---------------------------------------------------------------------------

  describe("listCatalog", () => {
    it("returns seeded connectors", async () => {
      const result = await service.listCatalog();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.slug).toBe("echo");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getConnector
  // ---------------------------------------------------------------------------

  describe("getConnector", () => {
    it("returns connector by ID", async () => {
      const result = await service.getConnector(seededConnector.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(seededConnector.id);
        expect(result.value.slug).toBe("echo");
      }
    });

    it("returns NOT_FOUND for unknown ID", async () => {
      const result = await service.getConnector("nonexistent" as ConnectorId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // install
  // ---------------------------------------------------------------------------

  describe("install", () => {
    it("installs a connector for org", async () => {
      const result = await service.install(seededConnector.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.orgId).toBe(orgId);
        expect(result.value.connectorId).toBe(seededConnector.id);
        expect(result.value.connectorSlug).toBe("echo");
        expect(result.value.enabled).toBe(true);
      }
    });

    it("rejects duplicate install", async () => {
      const first = await service.install(seededConnector.id, orgId, userId);
      expect(first.ok).toBe(true);

      const second = await service.install(seededConnector.id, orgId, userId);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.code).toBe("CONFLICT");
    });

    it("rejects install of non-existent connector", async () => {
      const result = await service.install("nonexistent" as ConnectorId, orgId, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // configure
  // ---------------------------------------------------------------------------

  describe("configure", () => {
    it("updates config and stores credentials", async () => {
      // First install
      const installResult = await service.install(seededConnector.id, orgId, userId);
      expect(installResult.ok).toBe(true);

      const result = await service.configure(
        seededConnector.id,
        orgId,
        userId,
        { setting: "value" },
        { type: "api_key", data: "my-secret-key" },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.connectorId).toBe(seededConnector.id);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // test
  // ---------------------------------------------------------------------------

  describe("test", () => {
    it("succeeds for no-auth connector", async () => {
      await service.install(seededConnector.id, orgId, userId);

      const result = await service.test(seededConnector.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(true);
        expect(result.value.message).toContain("test passed");
      }
    });

    it("fails for credentialed connector without credentials", async () => {
      // Seed a weather connector that requires auth
      const weatherConnector = await connectorRepo.create({
        slug: "weather",
        name: "Weather Service",
        description: "Weather data provider",
        category: "data",
        trustTier: "verified",
        authMode: "api_key",
        status: "active",
        tools: [
          { name: "get_weather", description: "Get weather", parameters: {} },
        ],
        scopes: [
          { id: "weather:current", name: "Current Weather", description: "Read current weather" },
        ],
      });

      await service.install(weatherConnector.id, orgId, userId);

      const result = await service.test(weatherConnector.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(false);
        expect(result.value.message).toContain("requires credentials");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // revoke
  // ---------------------------------------------------------------------------

  describe("revoke", () => {
    it("removes install and credentials", async () => {
      await service.install(seededConnector.id, orgId, userId);
      await service.configure(
        seededConnector.id,
        orgId,
        userId,
        undefined,
        { type: "api_key", data: "secret" },
      );

      const result = await service.revoke(seededConnector.id, orgId, userId);
      expect(result.ok).toBe(true);

      // Verify the install is gone
      const listResult = await service.listInstalled(orgId);
      expect(listResult.ok).toBe(true);
      if (listResult.ok) expect(listResult.value.length).toBe(0);
    });

    it("returns NOT_FOUND if not installed", async () => {
      const result = await service.revoke(seededConnector.id, orgId, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // getScopes
  // ---------------------------------------------------------------------------

  describe("getScopes", () => {
    it("returns connector scopes", async () => {
      const result = await service.getScopes(seededConnector.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.id).toBe("echo:read");
      }
    });
  });
});
