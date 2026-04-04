import { describe, expect, it } from "vitest";
import {
  formatTemporalConnectionHints,
  getTemporalClientConnectionOptions,
  getTemporalRuntimeConfig,
  isRailwayPublicAddress,
  normalizeTemporalAddress,
} from "../temporal-config.js";

describe("temporal-config", () => {
  it("normalizes Temporal addresses to bare host:port", () => {
    expect(normalizeTemporalAddress(" https://sovereign.iy9qs.tmprl.cloud:7233/ ")).toBe(
      "sovereign.iy9qs.tmprl.cloud:7233",
    );
  });

  it("enables TLS automatically for Temporal Cloud endpoints", () => {
    const options = getTemporalClientConnectionOptions({
      TEMPORAL_ADDRESS: "sovereign.iy9qs.tmprl.cloud:7233",
      TEMPORAL_NAMESPACE: "sovereign.iy9qs",
    });

    expect(options.address).toBe("sovereign.iy9qs.tmprl.cloud:7233");
    expect(options.tls).toBe(true);
  });

  it("enables TLS and defaults port 443 for Railway public URLs", () => {
    const options = getTemporalClientConnectionOptions({
      TEMPORAL_ADDRESS: "temporal-basic-auth-production-e6e4.up.railway.app",
      TEMPORAL_NAMESPACE: "default",
    });

    expect(options.address).toBe("temporal-basic-auth-production-e6e4.up.railway.app:443");
    expect(options.tls).toBe(true);
  });

  it("preserves explicit port for Railway public URLs", () => {
    const options = getTemporalClientConnectionOptions({
      TEMPORAL_ADDRESS: "temporal-basic-auth-production-e6e4.up.railway.app:8080",
      TEMPORAL_NAMESPACE: "default",
    });

    expect(options.address).toBe("temporal-basic-auth-production-e6e4.up.railway.app:8080");
    expect(options.tls).toBe(true);
  });

  it("includes basic auth metadata when credentials are set", () => {
    const options = getTemporalClientConnectionOptions({
      TEMPORAL_ADDRESS: "temporal-basic-auth-production-e6e4.up.railway.app",
      TEMPORAL_NAMESPACE: "default",
      TEMPORAL_BASIC_AUTH_USER: "temporal",
      TEMPORAL_BASIC_AUTH_PASSWORD: "secret123",
    });

    expect(options.metadata).toBeDefined();
    const authValue = String(options.metadata!["authorization"]);
    const decoded = Buffer.from(
      authValue.replace("Basic ", ""),
      "base64",
    ).toString("utf8");
    expect(decoded).toBe("temporal:secret123");
  });

  it("detects Railway public addresses", () => {
    expect(isRailwayPublicAddress("temporal-basic-auth-production-e6e4.up.railway.app")).toBe(true);
    expect(isRailwayPublicAddress("temporal-basic-auth-production-e6e4.up.railway.app:443")).toBe(true);
    expect(isRailwayPublicAddress("sovereign.iy9qs.tmprl.cloud:7233")).toBe(false);
    expect(isRailwayPublicAddress("temporal.railway.internal:7233")).toBe(false);
  });

  it("decodes base64-encoded mTLS certs", () => {
    const cert = Buffer.from("-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----").toString("base64");
    const key = Buffer.from("-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----").toString("base64");

    const config = getTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: "sovereign.iy9qs.tmprl.cloud:7233",
      TEMPORAL_NAMESPACE: "sovereign.iy9qs",
      TEMPORAL_TLS_CERT: cert,
      TEMPORAL_TLS_KEY: key,
    });

    expect(config.tlsCert?.toString("utf8")).toContain("BEGIN CERTIFICATE");
    expect(config.tlsKey?.toString("utf8")).toContain("BEGIN PRIVATE KEY");
  });

  it("requires cert and key together", () => {
    expect(() =>
      getTemporalRuntimeConfig({
        TEMPORAL_ADDRESS: "localhost:7233",
        TEMPORAL_TLS_CERT: Buffer.from("-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----").toString("base64"),
      }),
    ).toThrow(/must be set together/i);
  });

  it("emits a DNS hint for unresolved Temporal Cloud hosts", () => {
    const config = getTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: "https://sovereign.iy9qs.tmprl.cloud:7233/",
      TEMPORAL_NAMESPACE: "sovereign.iy9qs",
    });

    const hints = formatTemporalConnectionHints(
      new Error('tonic::transport::Error(Transport, ConnectError(ConnectError("dns error", Custom { kind: Uncategorized, error: "failed to lookup address information: Name or service not known" })))'),
      config,
    );

    expect(hints.some((hint) => hint.includes("did not resolve in DNS"))).toBe(true);
    expect(hints.some((hint) => hint.includes("Normalized TEMPORAL_ADDRESS"))).toBe(true);
    expect(hints.some((hint) => hint.includes("must be provisioned"))).toBe(true);
  });

  it("emits cross-project hint for Railway internal DNS failures", () => {
    const config = getTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: "temporal-frontend.railway.internal:7233",
      TEMPORAL_NAMESPACE: "default",
    });

    const hints = formatTemporalConnectionHints(
      new Error("dns error: Name or service not known"),
      config,
    );

    expect(hints.some((hint) => hint.includes("SAME Railway project"))).toBe(true);
    expect(hints.some((hint) => hint.includes("public Railway URL"))).toBe(true);
  });

  it("emits basic auth hint for Railway public URLs without credentials", () => {
    const config = getTemporalRuntimeConfig({
      TEMPORAL_ADDRESS: "temporal-basic-auth-production-e6e4.up.railway.app",
      TEMPORAL_NAMESPACE: "default",
    });

    const hints = formatTemporalConnectionHints(
      new Error("connection refused"),
      config,
    );

    expect(hints.some((hint) => hint.includes("TEMPORAL_BASIC_AUTH_USER"))).toBe(true);
  });
});
