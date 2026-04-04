# SOVEREIGN: Final Steps to a Real 100% Production-Ready Claim

This document covers the remaining work that cannot be honestly closed from local code and Docker validation alone.

Use it as the execution runbook for staging and production signoff. Do not mark an item complete unless the required evidence is captured.

## Current Proven State

The following are already validated locally as of 2026-04-03:

- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm test:e2e`
- API startup and health
- Web and docs startup from production builds
- Temporal server and worker-orchestrator connectivity
- Browser worker readiness with Playwright Chromium installed
- MCP gateway startup and health/tool endpoints
- MinIO-backed browser-session artifact upload, list, and download through the API

That is enough to call the repo strongly hardened locally. It is not enough to claim real production readiness without the steps below.

## Exit Criteria for 100%

The product is at 100% only when all of the following are true:

- Real auth works in a deployed environment with production-like configuration.
- Real object storage works through the application path in a deployed environment.
- Monitoring, alerting, and centralized logs are live and proven.
- Backup and restore have been exercised successfully.
- Deployment and rollback have been exercised successfully.
- Staging signoff is recorded.
- Production launch and post-launch smoke checks are recorded.

## Required Evidence

Create an evidence folder for the release, for example:

```text
docs/release-evidence/2026-04-03-launch/
```

Store these artifacts there:

- screenshots of health dashboards, auth flow, and alert firing
- command output for deploy, rollback, restore, and smoke tests
- links to logs, traces, metrics, and cloud dashboards
- exact commit SHA deployed to staging and production
- incident notes for anything that failed and was fixed

## 1. Staging Environment Freeze

Goal: prove a stable release candidate in a production-like environment.

Steps:

1. Pick the exact release commit SHA.
2. Record the SHA in the evidence folder.
3. Ensure staging uses:
   - production build artifacts
   - production auth mode: `AUTH_MODE=workos`
   - production-like Postgres, Redis, Temporal, and object storage
   - real TLS and real domain routing
4. Confirm all migrations are applied in staging.
5. Confirm no manual hotfixes exist on staging hosts or services.

Evidence:

- release SHA
- staging environment URL
- migration output
- env diff review showing no missing required variables

## 2. WorkOS Auth Validation

Goal: prove real authentication and authorization behavior outside local dev mode.

Steps:

1. Configure `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` in staging.
2. Configure the WorkOS redirect URI to the staging domain.
3. Sign in with a valid test user through the real hosted auth flow.
4. Verify session creation and persistence across page reload.
5. Verify sign-out invalidates the session.
6. Verify at least one unauthorized request is rejected with the expected response shape.
7. If SSO is enabled, test at least one IdP-backed login.
8. If SCIM is required, verify user or group provisioning behavior.
9. Verify org membership and role mapping after login.
10. Verify audit events are emitted for login and membership-sensitive actions.

Evidence:

- screenshot or recording of login success
- API response for authenticated `GET /api/v1/auth/me`
- API response for rejected unauthorized request
- audit log entries for auth-related events

## 3. Storage Validation in Staging

Goal: prove real storage behavior through the app path, not just bucket health.

Steps:

1. Configure staging object storage bucket and credentials.
2. Confirm bucket exists and encryption/lifecycle rules are set.
3. Create a browser session or other artifact-producing workflow in staging.
4. Upload a small known artifact through the API or UI path.
5. List the artifacts through the app.
6. Download the artifact through the app.
7. Verify the downloaded bytes match the uploaded bytes.
8. Verify the object key path is org-scoped.
9. Verify unauthorized access to another org’s artifact is rejected.
10. Verify audit and billing usage events are emitted for the storage action if expected.

Evidence:

- uploaded filename, MIME type, and resulting object key
- successful download checksum match
- rejected cross-org access attempt
- related audit and usage events

## 4. Observability and Alerting Proof

Goal: prove the system can be operated safely.

Steps:

1. Confirm logs from API, web, workers, gateway, database, and Temporal are centralized.
2. Confirm traces and metrics are visible for core request paths.
3. Define or verify production SLO dashboards:
   - request latency
   - error rate
   - worker backlog
   - Temporal workflow failure rate
   - database saturation
   - queue or session pressure
4. Configure alerts for:
   - API error-rate spike
   - sustained high latency
   - worker not polling
   - Temporal unavailable
   - database connection exhaustion
   - storage failures
5. Intentionally trigger at least one non-destructive test alert.
6. Verify the alert reaches the on-call channel and is actionable.
7. Verify logs and traces are sufficient to explain the triggered alert.

Evidence:

- dashboard screenshots
- alert rule definitions
- fired alert screenshot or message link
- trace/log link for the triggered scenario

## 5. Backup and Restore Drill

Goal: prove data survivability.

Steps:

1. Document the current backup schedule for Postgres and object storage.
2. Confirm PITR is enabled if the platform supports it.
3. Create a restore target environment separate from staging.
4. Restore the latest database backup into the restore target.
5. Restore relevant object storage artifacts if backups are separate.
6. Run application smoke checks against the restored environment.
7. Verify restored orgs, agents, runs, memories, policies, and artifacts are present.
8. Record restore duration and recovery point.
9. Compare the achieved values against the expected RTO and RPO.

Evidence:

- backup configuration screenshot or output
- restore command transcript
- restored environment health checks
- RTO and RPO summary

## 6. Deployment Drill

Goal: prove deployment is repeatable and low-risk.

Steps:

1. Deploy the release candidate to staging using the real deployment process.
2. Record start time, finish time, and the exact image or artifact versions.
3. Confirm migrations run exactly once and complete successfully.
4. Run staging smoke checks immediately after deploy:
   - auth
   - onboarding/bootstrap
   - project creation
   - agent creation
   - publish version
   - create run
   - create/read memory
   - browser session creation
   - artifact upload/download
5. Monitor logs and dashboards for 15 to 30 minutes after deploy.
6. Confirm no unexpected error spike or worker backlog appears.

Evidence:

- deploy job logs
- smoke check results
- staging dashboard screenshots after deploy

## 7. Rollback Drill

Goal: prove the release can be reversed safely.

Steps:

1. Choose a known-good previous release.
2. Confirm rollback compatibility with the current schema and migrations.
3. Execute the real rollback process in staging.
4. Re-run the smoke checks against the rolled-back version.
5. Confirm sessions, data access, and workers still function.
6. Re-deploy the release candidate after rollback and re-run smoke checks.

Evidence:

- rollback command transcript
- pre- and post-rollback version identifiers
- smoke check results after rollback

## 8. Security Review

Goal: close the hardening gap for launch, not just functionality.

Steps:

1. Review all public and authenticated mutation endpoints.
2. Verify every mutation has authentication, authorization, and org scoping.
3. Verify rate limiting is active on public-facing routes.
4. Verify CORS allows only known production origins.
5. Verify security headers at the edge and app layers.
6. Verify no secrets appear in logs, support diagnostics, or admin outputs.
7. Verify connector credentials remain encrypted at rest.
8. Review tenant isolation tests and add any missing coverage found during review.
9. Review dependency advisories for critical and high severity issues.

Evidence:

- completed review checklist
- list of fixes, if any
- final signoff by security owner or release owner

## 9. Staging Signoff

Goal: explicitly approve the release before production.

Steps:

1. Review all evidence gathered in sections 1 through 8.
2. Confirm all launch checklist items are complete or explicitly waived.
3. Document any accepted risks with owner and mitigation.
4. Record a staging signoff entry with:
   - release SHA
   - approver
   - date/time
   - known risks

Evidence:

- signoff note in the evidence folder

## 10. Production Go-Live

Goal: perform a controlled launch with verification, not a blind push.

Steps:

1. Confirm on-call coverage is active.
2. Confirm dashboards and alerts are open before deploy.
3. Deploy the approved release SHA to production.
4. Run immediate production smoke checks:
   - `GET /api/v1/health`
   - real auth sign-in
   - org-scoped authenticated read
   - agent publish or equivalent safe mutation
   - run creation in a controlled org
   - artifact upload/download in a controlled org
5. Watch logs, traces, and metrics for at least 30 minutes.
6. Confirm no emergency rollback conditions are present.

Evidence:

- production deploy log
- smoke check results
- dashboard screenshots during the watch window

## 11. First 24 Hours

Goal: convert launch success into stable operation.

Steps:

1. Review auth success/failure rates.
2. Review API latency and error-rate trends.
3. Review worker throughput and Temporal failures.
4. Review database pool utilization and slow queries.
5. Review artifact storage errors and latency.
6. Review billing and usage event correctness.
7. Review audit logs for anomalies or missing critical events.

Evidence:

- 24-hour review note
- links to dashboards and incident tickets if any

## Decision Rule

Do not say "100%" until:

- every section above has evidence
- no blocker remains open
- any accepted risk is documented and explicitly approved

If a section is incomplete, the honest state is still "not yet 100%."
