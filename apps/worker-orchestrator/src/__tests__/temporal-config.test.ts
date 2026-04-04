import { describe, expect, it } from "vitest";
import {
  formatTemporalConnectionHints,
  getTemporalClientConnectionOptions,
  getTemporalRuntimeConfig,
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

  it("emits a DNS hint for unresolved Temporal hosts", () => {
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
  });
});
