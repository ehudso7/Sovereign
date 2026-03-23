/**
 * @sovereign/db
 *
 * Real PostgreSQL database client, tenant-scoped query utilities,
 * repositories, and migration helpers for the Sovereign platform.
 */

export type { DatabaseConfig, TenantDb, UnscopedDb } from "./client.js";
export { DatabaseClient, initDb, getDb, resetDbClient } from "./client.js";

export { runMigrations, rollbackMigration, getMigrationStatus } from "./migrate.js";
export type { MigrationResult } from "./migrate.js";

export type {
  UserRepo,
  OrgRepo,
  MembershipRepo,
  InvitationRepo,
  SessionRepo,
  ProjectRepo,
  AuditRepo,
  AgentRepo,
  AgentVersionRepo,
  RunRepo,
  RunStepRepo,
  ConnectorRepo,
  ConnectorInstallRepo,
  ConnectorCredentialRepo,
  SkillRepo,
  SkillInstallRepo,
  BrowserSessionRepo,
  MemoryRepo,
  MemoryLinkRepo,
} from "./repositories/index.js";

export {
  PgUserRepo,
  PgOrgRepo,
  PgMembershipRepo,
  PgInvitationRepo,
  PgSessionRepo,
  PgProjectRepo,
  PgAuditRepo,
  PgAgentRepo,
  PgAgentVersionRepo,
  PgRunRepo,
  PgRunStepRepo,
  PgConnectorRepo,
  PgConnectorInstallRepo,
  PgConnectorCredentialRepo,
  PgSkillRepo,
  PgSkillInstallRepo,
  PgBrowserSessionRepo,
  PgMemoryRepo,
  PgMemoryLinkRepo,
} from "./repositories/index.js";
