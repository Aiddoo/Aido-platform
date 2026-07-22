# PostgreSQL Job Queue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 모바일 클라이언트와 로그인 세션에 영향을 주지 않으면서 BullMQ 작업을 pg-boss 기반 PostgreSQL 큐로 전환할 수 있는 이중 backend 구조와 안전한 배포 절차를 구축한다.

**Architecture:** bounded context의 기존 업무 포트는 유지하고, 공용 `JobRuntimePort`를 PostgreSQL(pg-boss)과 Redis(BullMQ) 어댑터가 구현한다. 첫 운영 릴리스는 `JOB_BACKEND=redis`를 유지하며, 계약·인증·재시작 검증을 통과한 뒤에만 별도 cutover에서 `postgres`를 선택한다.

**Tech Stack:** NestJS 11, TypeScript 5.9, pg-boss 12.26.2, BullMQ 5, Prisma 7, PostgreSQL 16, Jest, Testcontainers, Docker Compose

## Global Constraints

- 비용 절감보다 기존 클라이언트 무영향이 우선이다.
- REST 경로, 요청·응답 DTO, HTTP 상태 코드, error code, 푸시 payload를 변경하지 않는다.
- `Session` row, refresh token hash, JWT secret/claim/만료 정책을 변경하지 않는다.
- 운영 첫 릴리스의 기본값은 반드시 `JOB_BACKEND=redis`다. 개발·신규 설치만 `postgres`를 명시한다.
- application/domain은 pg-boss, BullMQ, Redis, Prisma 타입을 import하지 않는다.
- domain/application/infrastructure에서 새 `as`와 non-null assertion을 사용하지 않는다.
- 정상 종료는 worker 수신 중단 후 최대 90초 drain하고 Docker는 `stop_grace_period: 120s`를 제공한다.
- 일반/AI 작업 모두 총 3회 시도하며 일반 1초, AI 5초 exponential backoff를 사용한다.
- ElastiCache 삭제는 이 계획에서 수행하지 않는다. 7일 soak 뒤 별도 사용자 승인을 받는다.
- 사용자 소유의 기존 `package.json` 변경을 보존한다.

---

## File Map

### Shared runtime

- Create `apps/api/src/shared/application/ports/job-runtime.port.ts`: vendor-neutral enqueue, schedule, work, cancel, health 계약.
- Create `apps/api/src/shared/infrastructure/jobs/job-runtime.module.ts`: `JOB_BACKEND`에 따른 adapter 선택.
- Create `apps/api/src/shared/infrastructure/jobs/pg-boss-job-runtime.adapter.ts`: PostgreSQL 구현과 CLS transaction-aware enqueue.
- Create `apps/api/src/shared/infrastructure/jobs/bullmq-job-runtime.adapter.ts`: Redis rollback 구현.
- Create `apps/api/src/shared/infrastructure/jobs/job-runtime.types.ts`: infrastructure 내부 등록/상태 타입.
- Create `apps/api/src/shared/infrastructure/jobs/job-runtime.constants.ts`: retry, retention, shutdown 상수.
- Create `apps/api/src/shared/infrastructure/jobs/*.spec.ts`: 공통 계약과 각 backend 단위 테스트.
- Modify `apps/api/src/shared/application/ports/index.ts`, `apps/api/src/shared/infrastructure/shared-kernel.module.ts`, `apps/api/src/app.module.ts`: runtime export/등록과 기존 전역 Bull 등록 제거.

### Configuration and migrations

- Create `apps/api/src/shared/infrastructure/config/schemas/job.schema.ts`: `JOB_BACKEND`, pg-boss schema/worker 설정.
- Modify `apps/api/src/shared/infrastructure/config/schemas/index.ts`, `apps/api/src/shared/infrastructure/config/services/config.service.ts`: 타입 안전 설정 노출.
- Modify `apps/api/package.json`, `pnpm-lock.yaml`: pg-boss 12.26.2 고정 의존성 및 schema 명령.
- Modify `apps/api/Dockerfile`: migration image에 pg-boss CLI 추가.
- Create `scripts/migrate-jobs.sh`: `PGBOSS_DATABASE_URL`을 사용한 `migrate`와 `doctor`.

### Bounded contexts

- Modify notification queue service/processor/module under `apps/api/src/notification/infrastructure/queue/`.
- Modify admin notification adapter/processor/scheduler under `apps/api/src/admin-notification/infrastructure/`.
- Modify retention queue service/processor/module under `apps/api/src/retention/infrastructure/queue/`.
- Modify scheduler queue/service/processors/adapter/module under `apps/api/src/scheduler/infrastructure/`.
- Modify AI report job/processor/module under `apps/api/src/ai-report/infrastructure/`.
- Modify AI suggestion job/processor/maintenance/module under `apps/api/src/ai-suggestion/infrastructure/`.
- Modify account purge job/processor/module under `apps/api/src/auth/infrastructure/`.

### Safety, Docker, deployment, docs

- Replace `apps/api/src/health/indicators/bull.health.ts` with `job-runtime.health.ts` without changing `/health` public shape.
- Modify `apps/api/test/e2e/helpers/e2e-app-factory.ts`: fake runtime override.
- Create `apps/api/test/mocks/fake-job-runtime.ts` and runtime integration tests.
- Create `apps/api/test/e2e/auth-session-restart.e2e-spec.ts`: persistent session regression.
- Keep `apps/api/test/e2e/openapi-contract.e2e-spec.ts` snapshot byte-identical.
- Modify `docker-compose.dev.yml`, `docker-compose.prod.yml`, `.env.docker.*.example`, root `package.json` scripts.
- Create `docker-compose.redis.yml`: optional Redis rollback profile.
- Create `scripts/smoke-job-runtime.sh`: Docker health/schema/enqueue/restart smoke.
- Modify `scripts/deploy.sh`, `.github/workflows/ci.yml`, `apps/api/DEPLOYMENT.md`, `apps/api/AGENTS.md`, `apps/api/.claude/architecture.md`.

---

### Task 1: Freeze public and authentication contracts before queue changes

**Files:**
- Create: `apps/api/test/e2e/auth-session-restart.e2e-spec.ts`
- Modify: `apps/api/test/e2e/helpers/e2e-app-factory.ts`
- Test: `apps/api/test/e2e/openapi-contract.e2e-spec.ts`
- Test: `apps/api/test/e2e/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: existing `createE2eApp()`, `E2eHelpers.createVerifiedUser()`, `E2eHelpers.loginUser()`, public refresh and protected account endpoints.
- Produces: `restartAppPreservingDatabase()` test helper that closes/recreates only Nest application state while preserving the same Testcontainers PostgreSQL instance.

- [ ] **Step 1: Write the failing restart regression**

Create a test that calls `createVerifiedUser()`, then `loginUser()`, stores both tokens, recreates the Nest app against the same `TestDatabase`, then asserts the old access token still calls `GET /auth/me` and the old refresh token still calls `POST /auth/refresh`. The E2E app intentionally omits the production `/v1` prefix; the production prefix remains covered by the unchanged OpenAPI contract. The helper must not truncate the DB between app instances.

```ts
it("재시작 전 세션과 토큰을 재시작 후에도 유지한다", async () => {
	await ctx.helpers.createVerifiedUser(
		"restart-session@example.com",
		"Test1234!",
	);
	const tokens = await ctx.helpers.loginUser(
		"restart-session@example.com",
		"Test1234!",
	);
	ctx = await restartAppPreservingDatabase(ctx);

	await request(ctx.app.getHttpServer())
		.get("/auth/me")
		.set("Authorization", `Bearer ${tokens.accessToken}`)
		.expect(200);
	await request(ctx.app.getHttpServer())
		.post("/auth/refresh")
		.set("Authorization", `Bearer ${tokens.refreshToken}`)
		.expect(200);
});
```

- [ ] **Step 2: Run the new test and confirm the missing helper failure**

Run: `pnpm --filter @aido/api test:e2e -- auth-session-restart.e2e-spec.ts --runInBand`

Expected: FAIL because `restartAppPreservingDatabase` is not implemented.

- [ ] **Step 3: Add the minimal E2E lifecycle helper**

Split resource ownership so app close does not stop the shared test database, and ensure cache/Redis mocks are recreated empty while `DatabaseService` points at the same Prisma client. Do not change production code or auth configuration.

- [ ] **Step 4: Run authentication and OpenAPI gates**

Run:

```bash
pnpm --filter @aido/api test:e2e -- auth-session-restart.e2e-spec.ts auth.e2e-spec.ts openapi-contract.e2e-spec.ts --runInBand
```

Expected: PASS; OpenAPI snapshot has no diff.

- [ ] **Step 5: Commit the safety baseline**

```bash
git add apps/api/test/e2e/auth-session-restart.e2e-spec.ts apps/api/test/e2e/helpers/e2e-app-factory.ts
git commit -m "test(api): protect sessions across restarts"
```

### Task 2: Define the vendor-neutral job runtime and configuration

**Files:**
- Create: `apps/api/src/shared/application/ports/job-runtime.port.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/job-runtime.constants.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/job-runtime.module.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/job-runtime.module.spec.ts`
- Create: `apps/api/src/shared/infrastructure/config/schemas/job.schema.ts`
- Modify: `apps/api/src/shared/application/ports/index.ts`
- Modify: `apps/api/src/shared/infrastructure/config/schemas/index.ts`
- Modify: `apps/api/src/shared/infrastructure/config/services/config.service.ts`

**Interfaces:**
- Consumes: `ConfigService<EnvConfig, true>` and Nest lifecycle hooks.
- Produces:

```ts
export type JobBackend = "postgres" | "redis";
export type JobData = object;
export interface JobEnvelope<T extends JobData = JobData> {
	id: string;
	name: string;
	data: Readonly<T>;
	attempt: number;
}
export interface EnqueueJobOptions {
	jobKey?: string;
	startAfter?: Date;
	retryLimit: number;
	retryDelaySeconds: number;
	retryBackoff: boolean;
	expireInSeconds: number;
	retentionSeconds: number;
	deadLetter?: string;
}
export interface WorkJobOptions { teamSize: number; pollingIntervalSeconds: number; }
export interface JobRuntimeHealth {
	backend: JobBackend;
	degraded: boolean;
	queues: Readonly<Record<string, { waiting: number; active: number; failed: number; oldestAgeSeconds: number | null }>>;
}
export interface JobRuntimePort {
	start(): Promise<void>;
	stop(): Promise<void>;
	enqueue<T extends JobData>(queue: string, data: T, options: EnqueueJobOptions): Promise<string | null>;
	schedule<T extends JobData>(scheduleKey: string, cron: string, queue: string, data: T, options: EnqueueJobOptions): Promise<void>;
	cancel(queue: string, jobKey: string): Promise<void>;
	work<T extends JobData>(queue: string, handler: (jobs: readonly JobEnvelope<T>[]) => Promise<void>, options: WorkJobOptions): Promise<void>;
	health(queueNames: readonly string[]): Promise<JobRuntimeHealth>;
}
export const JOB_RUNTIME = Symbol("JOB_RUNTIME");
```

- [ ] **Step 1: Write schema and provider-selection tests**

Assert `JOB_BACKEND` accepts only `redis|postgres`, production defaults to `redis` when unset, and the module selects the matching adapter token. Assert shutdown timeout is exactly 90,000ms.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @aido/api test job-runtime.module`

Expected: FAIL because runtime files do not exist.

- [ ] **Step 3: Implement the port, constants, config, and dynamic provider**

Use `JOB_BACKEND=redis` as the schema default to prevent a merged release from changing production behavior. Expose `TypedConfigService.job` with backend, schema `pgboss`, shutdown timeout 90,000ms, and polling interval.

- [ ] **Step 4: Run contract and architecture checks**

Run:

```bash
pnpm --filter @aido/api test job-runtime.module
pnpm --filter @aido/api lint:arch
pnpm --filter @aido/api typecheck
```

Expected: PASS with no application/domain vendor imports.

- [ ] **Step 5: Commit the runtime contract**

```bash
git add apps/api/src/shared/application/ports apps/api/src/shared/infrastructure/jobs apps/api/src/shared/infrastructure/config
git commit -m "feat(api): define durable job runtime port"
```

### Task 3: Implement and contract-test the PostgreSQL runtime

**Files:**
- Create: `apps/api/src/shared/infrastructure/jobs/pg-boss-job-runtime.adapter.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/pg-boss-job-runtime.adapter.spec.ts`
- Create: `apps/api/test/integration/job-runtime-postgres.integration-spec.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `JobRuntimePort`, `DatabaseService`, `TransactionHost<TransactionalAdapterPrisma<DatabaseService>>`, `TypedConfigService`.
- Produces: `PgBossJobRuntimeAdapter implements JobRuntimePort` and the `pgboss` schema.

- [ ] **Step 1: Add pg-boss 12.26.2**

Run: `pnpm --filter @aido/api add pg-boss@12.26.2 --save-exact`

Expected: `apps/api/package.json` contains `"pg-boss": "12.26.2"` and lockfile resolves that version.

- [ ] **Step 2: Write failing adapter unit tests**

Mock pg-boss and `TransactionHost.tx`. Assert enqueue maps `jobKey→singletonKey`, retry/expiry/retention options, schedule uses the deterministic `scheduleKey`, worker batches are mapped to immutable envelopes, health returns backend `postgres`, and `stop()` is graceful with 90 seconds.

- [ ] **Step 3: Implement the minimal adapter**

Construct `PgBoss` with runtime migrations disabled. Call `boss.start()` only after schema migration. For enqueue inside a CLS transaction, pass `fromPrisma(this.txHost.tx)` through pg-boss's per-call `db` option so business writes and job insert share one transaction. Register `error` logging without payload data.

- [ ] **Step 4: Write failing Testcontainers behavior tests**

Cover enqueue→work→complete, delayed job, deterministic duplicate key, retry to dead letter, scheduled job upsert, app stop/start persistence, and transaction rollback removing both business row and job.

- [ ] **Step 5: Run the integration test and verify real PostgreSQL behavior**

Run: `pnpm --filter @aido/api test:integration -- job-runtime-postgres.integration-spec.ts --runInBand`

Expected: PASS against PostgreSQL 16; no Redis process is required.

- [ ] **Step 6: Commit the PostgreSQL adapter**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/shared/infrastructure/jobs apps/api/test/integration/job-runtime-postgres.integration-spec.ts
git commit -m "feat(api): add postgres job runtime"
```

### Task 4: Implement the Redis rollback runtime with the same contract

**Files:**
- Create: `apps/api/src/shared/infrastructure/jobs/bullmq-job-runtime.adapter.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/bullmq-job-runtime.adapter.spec.ts`
- Create: `apps/api/src/shared/infrastructure/jobs/job-runtime.contract.ts`
- Modify: `apps/api/src/shared/infrastructure/jobs/job-runtime.module.ts`

**Interfaces:**
- Consumes: `REDIS_CLIENT`, BullMQ `Queue`, `Worker`, `JobScheduler`, and the Task 2 port.
- Produces: `BullMqJobRuntimeAdapter implements JobRuntimePort` with identical business semantics.

- [ ] **Step 1: Extract a backend contract suite**

The shared suite accepts a runtime factory and asserts duplicate job keys, delay, retry count, cancellation, schedule replacement, worker shutdown, and normalized health fields.

- [ ] **Step 2: Run the Redis contract and verify failure**

Run: `pnpm --filter @aido/api test bullmq-job-runtime`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement BullMQ mapping**

Create queues/workers lazily by queue name. Map `jobKey→jobId`, `startAfter→delay`, retry options to BullMQ, and schedules to `upsertJobScheduler`. On stop, close workers before queues and wait up to 90 seconds. Do not log job payloads.

- [ ] **Step 4: Run both adapter suites**

Run: `pnpm --filter @aido/api test -- job-runtime bullmq-job-runtime pg-boss-job-runtime`

Expected: PASS and both adapters satisfy the same normalized contract.

- [ ] **Step 5: Commit the rollback adapter**

```bash
git add apps/api/src/shared/infrastructure/jobs
git commit -m "feat(api): preserve redis job runtime rollback"
```

### Task 5: Migrate bounded-context queues behind JobRuntimePort

**Files:**
- Modify: all BullMQ files listed in the File Map under Bounded contexts.
- Modify: each corresponding `*.module.ts` and existing `*.spec.ts`.
- Modify: `apps/api/src/app.module.ts`.
- Modify: `apps/api/test/e2e/helpers/e2e-app-factory.ts`.
- Create: `apps/api/test/mocks/fake-job-runtime.ts`.

**Interfaces:**
- Consumes: `JOB_RUNTIME`, existing semantic ports and existing processor business methods.
- Produces: processors/jobs that register with the selected runtime without decorators or vendor job types.

The exact mapping is:

| Existing queue | Runtime queue | Handler concurrency | Retry base |
|---|---|---:|---:|
| `notification` | `notification.v1` | existing value | 1s |
| `admin-notification` | `admin-notification.v1` | existing value | 1s |
| `retention` | `retention.v1` | 1 | 1s |
| `timezone-reminder` | `timezone-reminder.v1` | existing value | 1s |
| `todo-reminder` | `todo-reminder.v1` | existing value | 1s |
| `ai-suggestion-analysis` | `ai-suggestion-analysis.v1` | existing value | 5s |
| `ai-report-generation` | `ai-report-generation.v1` | 5 | 5s |
| `account-purge` | `account-purge.v1` | 1 | 1s |

- [ ] **Step 1: Add FakeJobRuntime and failing module tests**

`FakeJobRuntime` records enqueue/schedule/cancel calls and registered handlers, exposes `run(queue, data)` for tests, and never creates Redis/Postgres connections. Replace `getQueueToken()` loops in E2E factory with one `JOB_RUNTIME` override.

- [ ] **Step 2: Migrate notification, admin-notification, and retention**

Keep existing application port method signatures. Replace `InjectQueue`, `@Processor`, `WorkerHost`, and Bull `Job` with `JOB_RUNTIME` calls/envelopes. Run:

```bash
pnpm --filter @aido/api test -- notification-queue admin-notification-queue retention
```

Expected: existing business expectations pass; only infrastructure assertions change.

- [ ] **Step 3: Migrate scheduler queues and reminders**

Keep `ReminderSchedulerPort` and `TimezoneReminderEnqueuerPort`. Map deterministic reminder IDs to `jobKey`, scheduled dates to `startAfter`, and recurring sweep IDs to `scheduleKey`. Run:

```bash
pnpm --filter @aido/api test -- timezone-reminder todo-reminder bullmq-reminder-scheduler
```

Expected: schedule/cancel/idempotency tests pass through FakeJobRuntime.

- [ ] **Step 4: Migrate AI report and AI suggestion**

Use 5-second retry base and explicit expiry/heartbeat values. Preserve report unique constraint and skip provider calls when a report already exists. Run:

```bash
pnpm --filter @aido/api test -- report-generation suggestion-analysis ai-suggestion-queue-maintenance
```

Expected: existing AI results and retry policies pass without external AI calls.

- [ ] **Step 5: Migrate account purge and remove global Nest Bull registration**

Replace the final Bull decorators, remove `BullModule.forRootAsync()` and `@nestjs/bullmq` use from `app.module.ts`, but retain BullMQ/ioredis dependencies for the Redis runtime.

- [ ] **Step 6: Prove vendor boundaries**

Run:

```bash
rg -n "@nestjs/bullmq|InjectQueue|@Processor|WorkerHost" apps/api/src
pnpm --filter @aido/api lint:arch
pnpm --filter @aido/api typecheck
```

Expected: first command has no matches; checks PASS.

- [ ] **Step 7: Commit bounded-context migration**

```bash
git add apps/api/src apps/api/test/e2e/helpers/e2e-app-factory.ts apps/api/test/mocks/fake-job-runtime.ts
git commit -m "refactor(api): route queues through job runtime"
```

### Task 6: Replace Redis-specific health with backend-neutral queue health

**Files:**
- Create: `apps/api/src/health/indicators/job-runtime.health.ts`
- Create: `apps/api/src/health/indicators/job-runtime.health.spec.ts`
- Modify: `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/test/e2e/health-queue-policy.e2e-spec.ts`
- Delete: `apps/api/src/health/indicators/bull.health.ts`

**Interfaces:**
- Consumes: `JobRuntimePort.health()`.
- Produces: the existing `/health` field name `queues`, `status: up`, per-queue `active|waiting|failed`, optional `degraded` and `reason`.

- [ ] **Step 1: Write compatibility tests using captured response shape**

Assert PostgreSQL and Redis backends both emit the existing public fields. New internal fields such as backend and oldest age may be nested only if the OpenAPI snapshot remains unchanged; otherwise keep them in logs/metrics.

- [ ] **Step 2: Implement the health adapter**

Use the same two-second timeout and never turn a queue-only failure into HTTP 503. Database health remains the authoritative liveness failure because PostgreSQL queue and API share the DB.

- [ ] **Step 3: Run health and OpenAPI tests**

Run:

```bash
pnpm --filter @aido/api test job-runtime.health
pnpm --filter @aido/api test:e2e -- health-queue-policy.e2e-spec.ts openapi-contract.e2e-spec.ts --runInBand
```

Expected: PASS; OpenAPI snapshot unchanged.

- [ ] **Step 4: Commit health compatibility**

```bash
git add apps/api/src/health apps/api/test/e2e/health-queue-policy.e2e-spec.ts
git commit -m "refactor(api): make queue health backend neutral"
```

### Task 7: Add schema migration, Docker profiles, and restart smoke tests

**Files:**
- Create: `scripts/migrate-jobs.sh`
- Create: `scripts/smoke-job-runtime.sh`
- Create: `docker-compose.redis.yml`
- Modify: `apps/api/Dockerfile`
- Modify: `docker-compose.dev.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.docker.dev.example`
- Modify: `.env.docker.prod.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PGBOSS_DATABASE_URL`, `JOB_BACKEND`, Docker Compose service names.
- Produces: default dev PostgreSQL backend, optional Redis override, migration/doctor gate, 120-second graceful stop.

- [ ] **Step 1: Add migration script**

```sh
#!/bin/sh
set -eu
: "${PGBOSS_DATABASE_URL:?PGBOSS_DATABASE_URL is required}"
pnpm exec pg-boss migrate --connection-string "$PGBOSS_DATABASE_URL" --schema pgboss
pnpm exec pg-boss doctor --connection-string "$PGBOSS_DATABASE_URL" --schema pgboss
```

The migrate image runs Prisma migration first and this script second. `DATABASE_URL` remains the API credential; Compose maps it to `PGBOSS_DATABASE_URL` only in the migration service.

- [ ] **Step 2: Make dev PostgreSQL-only by default**

Remove the Redis dependency from `docker-compose.dev.yml`, set `JOB_BACKEND=postgres`, `CACHE_TYPE=memory`, and add `stop_grace_period: 120s`. Put the Redis service and `JOB_BACKEND=redis` overrides in `docker-compose.redis.yml`.

- [ ] **Step 3: Keep production default Redis for the expand release**

Set `.env.docker.prod.example` to `JOB_BACKEND=redis` and keep `REDIS_URL`. Add comments that cutover changes only `JOB_BACKEND`/`CACHE_TYPE` after all gates pass. Do not remove the production secret or ElastiCache reference yet.

- [ ] **Step 4: Add deterministic smoke script**

The script must wait for healthy status, run pg-boss `doctor`, invoke an internal test harness to enqueue a marker job, restart only the API container, then assert the marker reaches completed state. It must also run the Task 1 authentication restart E2E and must never print tokens or environment values.

- [ ] **Step 5: Execute requested Docker smoke sequence**

Run:

```bash
pnpm docker:dev:build
pnpm docker:dev:up
pnpm smoke:jobs
```

Expected: DB, migrate, API are healthy; no Redis container is required; schema doctor is clean; accepted marker job completes after API restart; auth restart test passes.

- [ ] **Step 6: Execute Redis rollback smoke**

Run:

```bash
docker compose --env-file .env.docker.dev -f docker-compose.dev.yml -f docker-compose.redis.yml up -d --build
JOB_BACKEND=redis pnpm smoke:jobs
```

Expected: identical marker job and health behavior using Redis.

- [ ] **Step 7: Commit Docker and migration support**

```bash
git add apps/api/Dockerfile docker-compose.dev.yml docker-compose.prod.yml docker-compose.redis.yml .env.docker.dev.example .env.docker.prod.example package.json scripts/migrate-jobs.sh scripts/smoke-job-runtime.sh
git commit -m "build(api): add postgres queue deployment path"
```

### Task 8: Harden deploy gates and document expand/cutover/rollback

**Files:**
- Modify: `scripts/deploy.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/api/DEPLOYMENT.md`
- Modify: `apps/api/AGENTS.md`
- Modify: `apps/api/.claude/architecture.md`

**Interfaces:**
- Consumes: Docker smoke scripts, `/health`, `JOB_BACKEND`.
- Produces: expand release, cutover preflight, rollback, and 7-day soak runbooks.

- [ ] **Step 1: Add CI gates**

Run adapter integration tests and OpenAPI/auth restart E2E in existing test jobs. Build both production targets. Never update the OpenAPI snapshot in this change.

- [ ] **Step 2: Add non-destructive deploy preflight**

Before API recreation, log only backend name and schema doctor result. For cutover, require `ALLOW_JOB_BACKEND_CUTOVER=1`, ensure old Redis `waiting+active` counts are zero, and abort before changing containers if not.

- [ ] **Step 3: Preserve rollback semantics**

Rollback must restore the previous API image and previous backend value. It must not run pg-boss rollback and must not delete queued rows or Redis keys.

- [ ] **Step 4: Update architecture and deployment docs**

Document semantic ports, both runtime adapters, transaction-aware PostgreSQL enqueue, 90/120-second shutdown, client/auth invariants, exact expand/cutover/rollback commands, 7-day soak, and the separate destructive approval required for ElastiCache deletion.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm --filter @aido/api lint:arch
pnpm --filter @aido/api test
pnpm --filter @aido/api test:integration
pnpm --filter @aido/api test:e2e -- --runInBand
pnpm docker:dev:build
pnpm docker:dev:up
pnpm smoke:jobs
git diff --exit-code -- apps/api/test/e2e/__snapshots__/openapi-contract.e2e-spec.ts.snap
```

Expected: all commands PASS; OpenAPI snapshot has no diff; `git status --short` shows only intended files plus the preserved pre-existing `package.json` user change if still present.

- [ ] **Step 6: Commit deployment safeguards**

```bash
git add scripts/deploy.sh .github/workflows/ci.yml apps/api/DEPLOYMENT.md apps/api/AGENTS.md apps/api/.claude/architecture.md
git commit -m "docs(api): add safe queue cutover runbook"
```

## Operational Execution After Merge

1. Deploy the expand release with production `JOB_BACKEND=redis`; verify old app versions, login/refresh, health, and queue metrics.
2. Leave production behavior unchanged until at least one normal deploy completes successfully.
3. Schedule a 2–5 minute cutover, run Redis queue preflight, set `ALLOW_JOB_BACKEND_CUTOVER=1` and `JOB_BACKEND=postgres`, and deploy.
4. Immediately run access/refresh token, paid report enqueue, notification payload, reminder, and health smoke tests.
5. On any contract/auth/queue anomaly, drain and restore `JOB_BACKEND=redis` without schema rollback.
6. Observe for 7 days. ElastiCache deletion is a separate task requiring explicit user approval.
