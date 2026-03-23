/**
 * @sovereign/crm
 *
 * CRM domain types for contact, account, deal, and activity management
 * in the Sovereign platform.
 */

import type {
  OrgId,
  UserId,
  TenantContext,
  Result,
  PaginationParams,
  PaginatedResult,
  AuditFields,
  ISODateString,
  HttpUrl,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Branded CRM IDs
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type ContactId = Brand<string, "ContactId">;
export type AccountId = Brand<string, "AccountId">;
export type DealId = Brand<string, "DealId">;
export type ActivityId = Brand<string, "ActivityId">;
export type PipelineId = Brand<string, "PipelineId">;
export type StageId = Brand<string, "StageId">;

export const toContactId = (id: string): ContactId => id as ContactId;
export const toAccountId = (id: string): AccountId => id as AccountId;
export const toDealId = (id: string): DealId => id as DealId;
export const toActivityId = (id: string): ActivityId => id as ActivityId;
export const toPipelineId = (id: string): PipelineId => id as PipelineId;
export const toStageId = (id: string): StageId => id as StageId;

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactStatus = "active" | "inactive" | "unsubscribed" | "bounced";

export interface ContactAddress {
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
}

export interface Contact extends AuditFields {
  readonly id: ContactId;
  readonly orgId: OrgId;
  readonly accountId?: AccountId;
  readonly ownerId?: UserId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string;
  readonly title?: string;
  readonly department?: string;
  readonly status: ContactStatus;
  readonly address?: ContactAddress;
  readonly linkedInUrl?: HttpUrl;
  readonly twitterHandle?: string;
  readonly tags: readonly string[];
  readonly customFields: Record<string, unknown>;
  readonly lastContactedAt?: ISODateString;
  readonly source?: string;
}

// ---------------------------------------------------------------------------
// Accounts (companies / organisations)
// ---------------------------------------------------------------------------

export type AccountType = "prospect" | "customer" | "partner" | "vendor" | "other";
export type AccountSize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1001-5000"
  | "5001+";

export interface CRMAccount extends AuditFields {
  readonly id: AccountId;
  readonly orgId: OrgId;
  readonly ownerId?: UserId;
  readonly name: string;
  readonly type: AccountType;
  readonly industry?: string;
  readonly size?: AccountSize;
  readonly website?: HttpUrl;
  readonly phone?: string;
  readonly annualRevenue?: number;
  readonly address?: ContactAddress;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly customFields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pipelines & stages
// ---------------------------------------------------------------------------

export interface Stage extends AuditFields {
  readonly id: StageId;
  readonly pipelineId: PipelineId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly order: number;
  /** Probability 0–100. */
  readonly probability: number;
  readonly isWon: boolean;
  readonly isLost: boolean;
}

export interface Pipeline extends AuditFields {
  readonly id: PipelineId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly stages: readonly Stage[];
  readonly isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Deals / opportunities
// ---------------------------------------------------------------------------

export type DealStatus = "open" | "won" | "lost";

export interface Deal extends AuditFields {
  readonly id: DealId;
  readonly orgId: OrgId;
  readonly accountId?: AccountId;
  readonly contactIds: readonly ContactId[];
  readonly ownerId?: UserId;
  readonly pipelineId: PipelineId;
  readonly stageId: StageId;
  readonly name: string;
  readonly value?: number;
  readonly currency?: string;
  readonly status: DealStatus;
  readonly closeDate?: ISODateString;
  readonly lostReason?: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly customFields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "task"
  | "linkedin"
  | "sms"
  | "demo"
  | "other";

export type ActivityStatus = "planned" | "completed" | "canceled";

export interface Activity extends AuditFields {
  readonly id: ActivityId;
  readonly orgId: OrgId;
  readonly type: ActivityType;
  readonly status: ActivityStatus;
  readonly subject: string;
  readonly body?: string;
  readonly ownerId: UserId;
  readonly dueAt?: ISODateString;
  readonly completedAt?: ISODateString;
  readonly contactId?: ContactId;
  readonly accountId?: AccountId;
  readonly dealId?: DealId;
  readonly durationMinutes?: number;
}

// ---------------------------------------------------------------------------
// Service interfaces
// ---------------------------------------------------------------------------

export interface ContactService {
  get(ctx: TenantContext, id: ContactId): Promise<Result<Contact>>;
  list(ctx: TenantContext, params?: PaginationParams): Promise<Result<PaginatedResult<Contact>>>;
  create(ctx: TenantContext, input: CreateContactInput): Promise<Result<Contact>>;
  update(ctx: TenantContext, id: ContactId, input: UpdateContactInput): Promise<Result<Contact>>;
  delete(ctx: TenantContext, id: ContactId): Promise<Result<void>>;
  search(ctx: TenantContext, query: string, params?: PaginationParams): Promise<Result<PaginatedResult<Contact>>>;
}

export interface AccountService {
  get(ctx: TenantContext, id: AccountId): Promise<Result<CRMAccount>>;
  list(ctx: TenantContext, params?: PaginationParams): Promise<Result<PaginatedResult<CRMAccount>>>;
  create(ctx: TenantContext, input: CreateAccountInput): Promise<Result<CRMAccount>>;
  update(ctx: TenantContext, id: AccountId, input: UpdateAccountInput): Promise<Result<CRMAccount>>;
  delete(ctx: TenantContext, id: AccountId): Promise<Result<void>>;
}

export interface DealService {
  get(ctx: TenantContext, id: DealId): Promise<Result<Deal>>;
  list(ctx: TenantContext, params?: PaginationParams): Promise<Result<PaginatedResult<Deal>>>;
  create(ctx: TenantContext, input: CreateDealInput): Promise<Result<Deal>>;
  update(ctx: TenantContext, id: DealId, input: UpdateDealInput): Promise<Result<Deal>>;
  delete(ctx: TenantContext, id: DealId): Promise<Result<void>>;
  moveStage(ctx: TenantContext, id: DealId, stageId: StageId): Promise<Result<Deal>>;
}

export interface ActivityService {
  get(ctx: TenantContext, id: ActivityId): Promise<Result<Activity>>;
  list(ctx: TenantContext, params?: PaginationParams): Promise<Result<PaginatedResult<Activity>>>;
  create(ctx: TenantContext, input: CreateActivityInput): Promise<Result<Activity>>;
  update(ctx: TenantContext, id: ActivityId, input: UpdateActivityInput): Promise<Result<Activity>>;
  complete(ctx: TenantContext, id: ActivityId): Promise<Result<Activity>>;
  delete(ctx: TenantContext, id: ActivityId): Promise<Result<void>>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateContactInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string;
  readonly title?: string;
  readonly department?: string;
  readonly accountId?: AccountId;
  readonly address?: ContactAddress;
  readonly tags?: readonly string[];
  readonly customFields?: Record<string, unknown>;
  readonly source?: string;
}

export type UpdateContactInput = Partial<Omit<CreateContactInput, "email">> & {
  readonly email?: string;
  readonly status?: ContactStatus;
};

export interface CreateAccountInput {
  readonly name: string;
  readonly type: AccountType;
  readonly industry?: string;
  readonly size?: AccountSize;
  readonly website?: HttpUrl;
  readonly phone?: string;
  readonly annualRevenue?: number;
  readonly address?: ContactAddress;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly customFields?: Record<string, unknown>;
}

export type UpdateAccountInput = Partial<CreateAccountInput>;

export interface CreateDealInput {
  readonly name: string;
  readonly pipelineId: PipelineId;
  readonly stageId: StageId;
  readonly accountId?: AccountId;
  readonly contactIds?: readonly ContactId[];
  readonly value?: number;
  readonly currency?: string;
  readonly closeDate?: ISODateString;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly customFields?: Record<string, unknown>;
}

export type UpdateDealInput = Partial<CreateDealInput> & {
  readonly status?: DealStatus;
  readonly lostReason?: string;
};

export interface CreateActivityInput {
  readonly type: ActivityType;
  readonly subject: string;
  readonly body?: string;
  readonly dueAt?: ISODateString;
  readonly contactId?: ContactId;
  readonly accountId?: AccountId;
  readonly dealId?: DealId;
  readonly durationMinutes?: number;
}

export type UpdateActivityInput = Partial<CreateActivityInput> & {
  readonly status?: ActivityStatus;
};
