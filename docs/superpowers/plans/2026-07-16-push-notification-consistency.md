# Push Notification Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 서버 푸시의 한·영 문구, 발송 시각, 타임존 처리, 빈도 제한을 일관되게 정비하면서 v1/v2를 포함한 기존 모바일 클라이언트 계약을 그대로 유지한다.

**Architecture:** 기존 `notification` 템플릿 카탈로그와 `NotificationMessageBuilder`를 유지하고 명시적 variant ID와 결정적 선택 컨텍스트만 더한다. 스케줄 정책은 `scheduler` 도메인 상수와 오케스트레이터에 모으고, Redis 빈도 제한은 배치 포트로 바꿔 네트워크 왕복을 줄인다. Retention V2는 별도 bounded context를 유지하되 같은 카피 규칙과 타임존 안전 유틸을 사용한다.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma 7, PostgreSQL 16, BullMQ, Redis, Jest, Zod 4.3, Biome 2.4

## Global Constraints

- 한국어는 친근한 반말을 쓰되 죄책감·조롱·유행어 남용을 금지하고, 제목·본문 한 줄당 이모지는 0~1개만 사용한다.
- 반복 캠페인은 사용자·캠페인·로컬 날짜/이벤트 seed로 O(1) 결정적 variant를 선택하며 재시도 시 같은 문구를 보낸다.
- 공개 push data의 `notificationId`, `type`, `action`, `context`와 기존 route/type 의미는 변경하지 않는다. 새 필드는 optional만 허용한다.
- 서버 저장 시각은 UTC, 사용자 날짜 경계와 스케줄은 검증된 IANA timezone으로 계산한다.
- engagement는 사용자별 하루 최대 2회, 최소 4시간 간격, quiet hours 21:00~08:00을 유지한다. 날씨 예외와 transactional 즉시 발송 정책도 유지한다.
- 사용자 소유 `apps/api/scripts/send-v1.5.2-update-push.sh`는 stage, stash, commit, PR에서 제외한다.

---

### Task 1: 결정적 variant 계약과 카피 카탈로그

**Files:**

- Modify: `apps/api/src/notification/domain/services/templates/template.types.ts`
- Modify: `apps/api/src/notification/domain/services/templates/notification-templates.ts`
- Modify: `apps/api/src/notification/domain/services/templates/locales/ko.ts`
- Modify: `apps/api/src/notification/domain/services/templates/locales/en.ts`
- Modify: `apps/api/src/notification/domain/services/templates/notification-templates.spec.ts`
- Modify: `apps/api/src/notification/domain/services/templates/locale-parity.spec.ts`

**Interfaces:**

- Produces: `NotificationVariant { id, title, body }`, `NotificationVariantContext { campaignKey, recipientId, occurrenceKey }`, and builder results with optional `variantId`.
- Preserves: locale parameters and all existing builder call signatures by appending optional selection context only.

- [ ] Add failing tests for stable seed selection, different recipients/occurrences, fallback variant IDs, ko/en ID parity, placeholder parity, forbidden Korean wording, emoji/length limits.
- [ ] Run targeted Jest tests and confirm failures come from the missing deterministic contract.
- [ ] Implement a stable non-cryptographic hash selector without Redis or database I/O.
- [ ] Assign explicit matching IDs to ko/en variants and rewrite all catalog copy to the approved tone.
- [ ] Pass selection context from repeatable scheduler builders while leaving direct social/user-authored messages fixed or backward-compatible.
- [ ] Run the complete template and scheduler strategy unit tests.

### Task 2: Retention V2 copy and daytime eligibility

**Files:**

- Modify: `apps/api/src/retention/domain/services/retention-message.ts`
- Create or modify: `apps/api/src/retention/domain/services/retention-message.spec.ts`
- Modify: `apps/api/src/retention/domain/services/stage-policy.spec.ts`
- Modify: `apps/api/src/retention/domain/services/push-eligibility.spec.ts`

**Interfaces:**

- Produces: typed ko/en retention variants with deterministic `variantId` selected from user/stage/local-date seed.
- Preserves: stage names, outbox schema, push payload routes and campaign attribution.

- [ ] Add failing tests for casual Korean tone, locale parity, stable retry selection, D0 two-hour wait, and D1/D3/D7 10:30 local delivery including DST boundaries.
- [ ] Implement message variants and share the timezone validation/fallback behavior without coupling retention to notification infrastructure.
- [ ] Run retention domain and use-case tests.

### Task 3: Timezone validation and registration preservation

**Files:**

- Modify: `apps/api/src/shared/presentation/decorators/timezone.decorator.ts`
- Create: `apps/api/src/shared/presentation/decorators/timezone.decorator.spec.ts`
- Modify: `apps/api/src/shared/domain/date/utils/timezone.ts`
- Modify: `apps/api/src/shared/domain/date/utils/timezone.spec.ts`
- Modify: `apps/api/src/notification/presentation/notification.controller.ts`
- Modify: `apps/api/src/notification/presentation/notification.controller.spec.ts`
- Modify: `apps/api/src/notification/application/use-cases/register-push-token/register-push-token.use-case.spec.ts`

**Interfaces:**

- Produces: IANA validation/normalization helper and optional raw-header mode for token registration.
- Preserves: UTC fallback for ordinary endpoints; missing token-registration header means preserve stored preference instead of writing UTC.

- [ ] Add failing tests for missing header preservation, invalid IANA rejection/fallback, valid UTC/Asia/Seoul/America DST zones, and invalid stored-zone isolation.
- [ ] Implement validation at the request boundary and defensive safe timezone helpers in scheduler/dispatcher paths.
- [ ] Run decorator, controller, registration, dispatcher, date, and retention timezone tests.

### Task 4: Korean retention schedule and eligibility precedence

**Files:**

- Modify: `apps/api/src/scheduler/domain/services/notification-schedule.ts`
- Modify: `apps/api/src/scheduler/domain/services/onboarding.ts`
- Modify: `apps/api/src/scheduler/application/services/timezone-aware-reminder.orchestrator.ts`
- Modify: `apps/api/src/scheduler/application/services/timezone-aware-reminder.orchestrator.spec.ts`
- Modify: `apps/api/src/scheduler/application/strategies/onboarding.strategy.ts`
- Modify: relevant strategy specs under `apps/api/src/scheduler/application/strategies/`
- Modify: default preference values in the owning user-settings domain files and their tests.

**Interfaces:**

- Produces schedule constants for 10:30 onboarding, Monday/first-day 11:30 summaries, 12:30 lunch, 15:00 nudge suggestion, 16:00 winback, 20:15 streak risk, and evening+90m social digest.
- Preserves premium/admin custom reminder times and free morning 08:00; changes free evening default to 19:00.

- [ ] Add failing policy/orchestrator tests for every approved time, free/premium/admin eligibility, monthly-over-weekly precedence, free-achievement vs premium-report split, social digest exclusion, quiet hours, daily caps and dedup.
- [ ] Replace inline scheduler times with domain schedule constants and implement precedence before enqueue.
- [ ] Move legacy onboarding delivery to the 10:30 local slot so midnight dedup cannot suppress the daytime push.
- [ ] Ensure social digest runs at +90 minutes and skips streak-at-risk candidates.
- [ ] Run scheduler unit and integration tests.

### Task 5: Batch Redis frequency limiting

**Files:**

- Modify: `apps/api/src/notification/application/ports/push-rate-limiter.port.ts`
- Modify: `apps/api/src/notification/infrastructure/rate-limiter/redis-push-rate-limiter.ts`
- Create or modify: `apps/api/src/notification/infrastructure/rate-limiter/redis-push-rate-limiter.spec.ts`
- Modify: `apps/api/src/notification/infrastructure/rate-limiter/in-memory-push-rate-limiter.ts`
- Modify: `apps/api/src/notification/infrastructure/rate-limiter/in-memory-push-rate-limiter.spec.ts`
- Modify: `apps/api/src/notification/infrastructure/adapters/push-dispatcher.adapter.ts`
- Modify: `apps/api/src/notification/infrastructure/adapters/push-dispatcher.adapter.spec.ts`

**Interfaces:**

- Produces: batch reservation API returning eligibility by recipient in input order.
- Preserves: max 2/day, 4-hour spacing, local-day keys, fail-open/fail-closed behavior already defined by each push purpose.

- [ ] Add failing tests proving one batch Redis round trip for N recipients and atomic reservation under overlap.
- [ ] Implement pipelined/Lua batch reservation and matching in-memory behavior.
- [ ] Replace sequential per-user awaits in dispatcher with one batch call per dispatch chunk.
- [ ] Run rate limiter, dispatcher, queue processor, and integration tests.

### Task 6: Compatibility fixtures and operator documentation

**Files:**

- Create: `apps/api/docs/push-notifications.md`
- Create or modify: payload compatibility fixtures/specs under `apps/api/src/notification/` or `apps/api/test/fixtures/`
- Modify: related tests only where required to assert the unchanged public contract.

**Interfaces:**

- Documents: every notification scenario, local time, trigger, free/premium/admin eligibility, OS permission requirement, marketing consent, quiet-hour/daily-cap behavior, payload action/route, and precedence.
- Verifies: historical payloadVersion 1 and current payloadVersion 2 parsers accept the server payload superset.

- [ ] Add failing compatibility tests using v1 and v2 mobile schema fixtures and assert required legacy fields never disappear.
- [ ] Add catalog route/type/size assertions and OpenAPI snapshot diff-zero test.
- [ ] Write the complete schedule/eligibility matrix and copy/variant operations guide.
- [ ] Run notification E2E, scheduler/retention integration, OpenAPI, `lint:no-cast`, and `lint:boundaries`.

### Task 7: Full verification, Docker smoke, and ship

**Files:**

- Verify all task files and protect the unrelated untracked script.

- [ ] Run targeted unit tests, complete API unit/integration/E2E suites, `pnpm typecheck`, and `pnpm lint` with fresh output.
- [ ] Run exactly `pnpm docker:dev:down`, `pnpm docker:dev:build`, `pnpm docker:dev:up` in that order.
- [ ] Verify `/health`, API/scheduler startup logs, and container health.
- [ ] Create a disposable push-disabled fixture, enqueue a notification job, confirm BullMQ completion and persisted notification copy/metadata, confirm no Expo delivery, then remove only the disposable fixture/job.
- [ ] Review `git diff --check`, changed paths, payload contracts, and the requirements checklist.
- [ ] Execute `.claude/commands/ship/SKILL.md`: create issue, move only task changes to a feature branch, stage only explicit task paths, commit, push, and create a PR whose body contains the full notification eligibility/schedule matrix and verification evidence.
