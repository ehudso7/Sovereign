# SOVEREIGN — Database Schema

## Overview

All tables include `org_id` for tenant isolation. All timestamps are UTC. All IDs are UUIDs.

## Core Tables

### organizations
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| name | varchar(255) | NOT NULL |
| slug | varchar(63) | UNIQUE, NOT NULL |
| plan | varchar(50) | NOT NULL, DEFAULT 'free' |
| settings | jsonb | DEFAULT '{}' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| email | varchar(255) | UNIQUE, NOT NULL |
| name | varchar(255) | |
| avatar_url | text | |
| workos_user_id | varchar(255) | UNIQUE |
| password_hash | text | Only used in local/dev auth mode |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### memberships
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| user_id | uuid | FK → users, NOT NULL |
| role | varchar(50) | NOT NULL, DEFAULT 'org_member' |
| invited_by | uuid | FK → users |
| accepted_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (org_id, user_id) |

### invitations
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| email | varchar(255) | NOT NULL |
| role | varchar(50) | NOT NULL, DEFAULT 'org_member' |
| invited_by | uuid | FK → users, NOT NULL |
| expires_at | timestamptz | NOT NULL |
| accepted_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users, NOT NULL |
| org_id | uuid | FK → organizations, NOT NULL |
| role | varchar(50) | NOT NULL |
| token_hash | varchar(255) | UNIQUE, NOT NULL |
| expires_at | timestamptz | NOT NULL |
| ip_address | inet | |
| user_agent | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| name | varchar(255) | NOT NULL |
| slug | varchar(63) | NOT NULL |
| description | text | |
| settings | jsonb | DEFAULT '{}' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (org_id, slug) |

### agents
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| project_id | uuid | FK → projects, NOT NULL |
| name | varchar(255) | NOT NULL |
| slug | varchar(63) | NOT NULL |
| description | text | |
| status | varchar(50) | NOT NULL, DEFAULT 'draft' |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (project_id, slug) |

### agent_versions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| agent_id | uuid | FK → agents, NOT NULL |
| version | integer | NOT NULL |
| goals | jsonb | NOT NULL |
| instructions | text | NOT NULL |
| tools | jsonb | NOT NULL, DEFAULT '[]' |
| budget | jsonb | |
| approval_rules | jsonb | DEFAULT '[]' |
| memory_config | jsonb | |
| schedule | jsonb | |
| model_config | jsonb | NOT NULL |
| published | boolean | DEFAULT false |
| published_at | timestamptz | |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (agent_id, version) |

### skills
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| name | varchar(255) | NOT NULL |
| description | text | |
| type | varchar(50) | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### skill_versions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| skill_id | uuid | FK → skills, NOT NULL |
| version | integer | NOT NULL |
| definition | jsonb | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (skill_id, version) |

### connectors (Phase 6 — global catalog, not org-scoped)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| slug | varchar(63) | UNIQUE, NOT NULL |
| name | varchar(255) | NOT NULL |
| description | text | |
| category | varchar(100) | NOT NULL, DEFAULT 'custom' |
| trust_tier | varchar(50) | NOT NULL, DEFAULT 'untrusted' |
| auth_mode | varchar(50) | NOT NULL, DEFAULT 'none' |
| status | varchar(50) | NOT NULL, DEFAULT 'active' |
| tools | jsonb | NOT NULL, DEFAULT '[]' |
| scopes | jsonb | NOT NULL, DEFAULT '[]' |
| metadata | jsonb | DEFAULT '{}' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### connector_installs (Phase 6 — org-scoped installations)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| connector_id | uuid | FK → connectors, NOT NULL |
| connector_slug | varchar(63) | NOT NULL |
| enabled | boolean | NOT NULL, DEFAULT true |
| config | jsonb | NOT NULL, DEFAULT '{}' |
| granted_scopes | jsonb | NOT NULL, DEFAULT '[]' |
| installed_by | uuid | FK → users, NOT NULL |
| updated_by | uuid | FK → users |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (org_id, connector_id) |

### connector_credentials (Phase 6 — org-scoped, encrypted)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| connector_install_id | uuid | FK → connector_installs, UNIQUE, NOT NULL |
| credential_type | varchar(50) | NOT NULL |
| encrypted_data | text | NOT NULL |
| expires_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### skill_installs (Phase 6 — org-scoped)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| skill_id | uuid | FK → skills, NOT NULL |
| skill_slug | varchar(63) | NOT NULL |
| enabled | boolean | NOT NULL, DEFAULT true |
| installed_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| **UNIQUE** | | (org_id, skill_id) |

## Execution Tables

### runs
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| agent_id | uuid | FK → agents, NOT NULL |
| agent_version_id | uuid | FK → agent_versions, NOT NULL |
| project_id | uuid | FK → projects, NOT NULL |
| status | varchar(50) | NOT NULL, DEFAULT 'queued' |
| trigger_type | varchar(50) | NOT NULL |
| triggered_by | uuid | FK → users |
| input | jsonb | |
| output | jsonb | |
| error | jsonb | |
| token_usage | jsonb | |
| cost_cents | integer | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| temporal_workflow_id | varchar(255) | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

Status values: queued, running, paused, waiting_approval, completed, failed, cancelled

### run_steps
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| run_id | uuid | FK → runs, NOT NULL |
| step_number | integer | NOT NULL |
| type | varchar(50) | NOT NULL |
| tool_name | varchar(255) | |
| input | jsonb | |
| output | jsonb | |
| error | jsonb | |
| token_usage | jsonb | |
| latency_ms | integer | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### run_artifacts
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| run_id | uuid | FK → runs, NOT NULL |
| step_id | uuid | FK → run_steps |
| type | varchar(50) | NOT NULL |
| name | varchar(255) | NOT NULL |
| storage_key | text | NOT NULL |
| mime_type | varchar(255) | |
| size_bytes | bigint | |
| metadata | jsonb | DEFAULT '{}' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### approvals
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| run_id | uuid | FK → runs, NOT NULL |
| step_id | uuid | FK → run_steps |
| policy_id | uuid | FK → policies |
| action | text | NOT NULL |
| status | varchar(50) | NOT NULL, DEFAULT 'pending' |
| decided_by | uuid | FK → users |
| decided_at | timestamptz | |
| reason | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### browser_sessions (Phase 7 — implemented)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| run_id | uuid | FK → runs, NOT NULL |
| agent_id | uuid | FK → agents, NOT NULL |
| status | varchar(50) | NOT NULL, DEFAULT 'provisioning' |
| browser_type | varchar(50) | NOT NULL, DEFAULT 'chromium' |
| current_url | text | |
| human_takeover | boolean | NOT NULL, DEFAULT FALSE |
| takeover_by | uuid | FK → users |
| session_ref | text | |
| artifact_keys | jsonb | NOT NULL, DEFAULT '[]' |
| metadata | jsonb | NOT NULL, DEFAULT '{}' |
| created_by | uuid | FK → users, NOT NULL |
| started_at | timestamptz | |
| last_activity_at | timestamptz | |
| ended_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

Status values: provisioning, ready, active, takeover_requested, human_control, closing, closed, failed

Indexes: org_id, (org_id, run_id), status, (org_id, status)

RLS: tenant-scoped via org_id = app.current_org_id

## Memory Tables

### memories
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| scope_type | varchar(50) | NOT NULL |
| scope_id | uuid | NOT NULL |
| lane | varchar(50) | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

Lane values: semantic, episodic, procedural
Scope types: org, project, agent, user

### memory_entries
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| memory_id | uuid | FK → memories, NOT NULL |
| content | text | NOT NULL |
| embedding | vector(1536) | |
| relevance_score | float | |
| source_run_id | uuid | FK → runs |
| source_step_id | uuid | FK → run_steps |
| expires_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### memory_links
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| from_entry_id | uuid | FK → memory_entries, NOT NULL |
| to_entry_id | uuid | FK → memory_entries, NOT NULL |
| link_type | varchar(50) | NOT NULL |
| strength | float | DEFAULT 1.0 |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

## Policy Tables

### policies
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| name | varchar(255) | NOT NULL |
| description | text | |
| rule | jsonb | NOT NULL |
| enforcement | varchar(50) | NOT NULL, DEFAULT 'enforce' |
| enabled | boolean | DEFAULT true |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

Enforcement values: enforce, audit, disabled

### policy_decisions
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| policy_id | uuid | FK → policies, NOT NULL |
| run_id | uuid | FK → runs |
| decision | varchar(50) | NOT NULL |
| input | jsonb | NOT NULL |
| reason | text | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### audit_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| actor_id | uuid | FK → users |
| actor_type | varchar(50) | NOT NULL |
| action | varchar(255) | NOT NULL |
| resource_type | varchar(100) | NOT NULL |
| resource_id | uuid | |
| metadata | jsonb | DEFAULT '{}' |
| ip_address | inet | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

## CRM Tables

### accounts
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| name | varchar(255) | NOT NULL |
| domain | varchar(255) | |
| industry | varchar(100) | |
| metadata | jsonb | DEFAULT '{}' |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### contacts
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| account_id | uuid | FK → accounts |
| email | varchar(255) | |
| name | varchar(255) | NOT NULL |
| title | varchar(255) | |
| phone | varchar(50) | |
| metadata | jsonb | DEFAULT '{}' |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### deals
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| account_id | uuid | FK → accounts, NOT NULL |
| name | varchar(255) | NOT NULL |
| stage | varchar(100) | NOT NULL |
| value_cents | bigint | |
| currency | varchar(3) | DEFAULT 'USD' |
| expected_close | date | |
| owner_id | uuid | FK → users |
| metadata | jsonb | DEFAULT '{}' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### tasks
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| project_id | uuid | FK → projects |
| assigned_to | uuid | FK → users |
| title | varchar(255) | NOT NULL |
| description | text | |
| status | varchar(50) | NOT NULL, DEFAULT 'open' |
| priority | varchar(50) | DEFAULT 'medium' |
| due_date | timestamptz | |
| related_type | varchar(50) | |
| related_id | uuid | |
| created_by | uuid | FK → users, NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

## Billing Tables

### billing_accounts
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, UNIQUE, NOT NULL |
| provider_customer_id | varchar(255) | |
| plan | varchar(50) | NOT NULL, DEFAULT 'free' |
| status | varchar(50) | NOT NULL, DEFAULT 'active' |
| trial_ends_at | timestamptz | |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### usage_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| type | varchar(100) | NOT NULL |
| quantity | numeric | NOT NULL |
| unit | varchar(50) | NOT NULL |
| run_id | uuid | FK → runs |
| agent_id | uuid | FK → agents |
| metadata | jsonb | DEFAULT '{}' |
| recorded_at | timestamptz | NOT NULL, DEFAULT now() |

### invoices
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | FK → organizations, NOT NULL |
| billing_account_id | uuid | FK → billing_accounts, NOT NULL |
| period_start | timestamptz | NOT NULL |
| period_end | timestamptz | NOT NULL |
| amount_cents | bigint | NOT NULL |
| currency | varchar(3) | DEFAULT 'USD' |
| status | varchar(50) | NOT NULL, DEFAULT 'draft' |
| provider_invoice_id | varchar(255) | |
| line_items | jsonb | NOT NULL, DEFAULT '[]' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

## Infrastructure Tables

### schema_migrations
| Column | Type | Constraints |
|--------|------|-------------|
| version | varchar(255) | PK |
| applied_at | timestamptz | NOT NULL, DEFAULT now() |

## Row-Level Security

RLS is enabled on org-scoped tables as defense in depth:
- `memberships`, `invitations`, `projects`, `audit_events`, `sessions`
- Policies use `current_setting('app.current_org_id', true)::uuid`
- `FORCE ROW LEVEL SECURITY` is enabled so policies apply even to table owners

## Indexes

Key indexes (beyond PKs and FKs):
- `users(email)` — UNIQUE
- `users(workos_user_id)` — UNIQUE, WHERE NOT NULL
- `memberships(org_id, user_id)` — UNIQUE
- `invitations(org_id)` — for listing pending invitations
- `invitations(email)` — for lookup by email
- `sessions(token_hash)` — UNIQUE, for session validation
- `sessions(user_id)` — for listing user sessions
- `sessions(expires_at)` — for cleanup of expired sessions
- `projects(org_id, slug)` — UNIQUE
- `agents(project_id, slug)` — UNIQUE
- `agent_versions(agent_id, version)` — UNIQUE
- `runs(org_id, status)` — for queue queries
- `runs(org_id, agent_id, created_at)` — for agent run history
- `run_steps(run_id, step_number)` — for ordered step retrieval
- `audit_events(org_id, created_at)` — for audit log queries
- `audit_events(org_id, resource_type, resource_id)` — for resource audit
- `memory_entries(memory_id, created_at)` — for temporal retrieval
- `usage_events(org_id, recorded_at)` — for billing aggregation

## Migration Strategy

- All migrations are reversible (up + down)
- Migrations use sequential numbering
- No destructive migrations in production without explicit approval
- Schema changes require DB_SCHEMA.md update before merge
