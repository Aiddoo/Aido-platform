# Cache Key Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캐시 backend와 무관하게 모든 캐시·dedup·lock 키를 충돌 없는 버전 규칙으로 통일하고 bounded context가 자기 키를 소유하게 한다.

**Architecture:** shared에는 segment 정규화와 `aido:v1` prefix만 두고, 실제 resource/TTL/key builder는 auth, follow, notification, todo, daily-completion, scheduler, weather, subscription, user-settings가 소유한다. Redis와 memory adapter는 문자열 키만 소비하므로 공개 API와 저장 데이터의 source of truth에는 영향이 없다.

**Tech Stack:** TypeScript 5.9, NestJS 11, Jest, existing `ICacheService`, Redis and in-memory strategies

## Global Constraints

- REST/DTO/auth/push 계약을 변경하지 않는다.
- 키 변경은 cache miss만 만들 수 있으며 DB source of truth로 복구되어야 한다.
- `aido:v1:<bounded-context>:<resource>:<identifier>` 형식을 사용한다.
- shared가 feature 모듈을 import하지 않는다.
- raw cache/dedup/lock key 문자열 연결을 금지한다.
- 기본 backend는 memory이며 Redis rollback backend에서도 같은 builder를 사용한다.

---

### Task 1: Add the shared keyspace primitive

**Files:**
- Create: `apps/api/src/shared/infrastructure/cache/keyspace/cache-key.ts`
- Create: `apps/api/src/shared/infrastructure/cache/keyspace/cache-key.spec.ts`
- Modify: `apps/api/src/shared/infrastructure/cache/index.ts`

**Interfaces:**
- Produces:

```ts
export const CACHE_KEY_PREFIX = "aido:v1";
export function cacheKey(context: string, resource: string, ...identifiers: readonly string[]): string;
export function cachePattern(context: string, resource: string, ...identifiers: readonly string[]): string;
```

- [ ] **Step 1: Write failing exact-string tests**

Assert `cacheKey("auth", "session", "sess-1")` equals `aido:v1:auth:session:sess-1`, empty segments throw, colon-containing identifiers are URI-encoded, and pattern appends only a final `*`.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @aido/api test cache-key.spec`

Expected: FAIL because the primitive is absent.

- [ ] **Step 3: Implement the primitive without type assertions**

Use `encodeURIComponent` for identifiers and reject blank context/resource/identifier values. Wildcard is produced only by `cachePattern`, never accepted as user input.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @aido/api test cache-key.spec
git add apps/api/src/shared/infrastructure/cache/keyspace apps/api/src/shared/infrastructure/cache/index.ts
git commit -m "feat(api): define versioned cache keyspace"
```

### Task 2: Move key ownership to bounded contexts

**Files:**
- Create: `apps/api/src/auth/infrastructure/cache/auth-cache.keys.ts`
- Create: `apps/api/src/follow/infrastructure/cache/follow-cache.keys.ts`
- Create: `apps/api/src/notification/infrastructure/cache/notification-cache.keys.ts`
- Create: `apps/api/src/todo/infrastructure/cache/todo-cache.keys.ts`
- Create: `apps/api/src/daily-completion/infrastructure/cache/daily-completion-cache.keys.ts`
- Create: `apps/api/src/scheduler/infrastructure/cache/scheduler-cache.keys.ts`
- Create: `apps/api/src/weather/infrastructure/cache/weather-cache.keys.ts`
- Create: `apps/api/src/subscription/infrastructure/cache/subscription-cache.keys.ts`
- Create: `apps/api/src/user-settings/infrastructure/cache/user-settings-cache.keys.ts`
- Test: adjacent `*.keys.spec.ts` for every file.

**Interfaces:**
- Consumes: `cacheKey`, `cachePattern`.
- Produces: named functions such as `authSessionCacheKey`, `todoFriendViewCacheKey`, `weatherForecastCacheKey` and named TTL constants.

- [ ] **Step 1: Write exact contract tests for every existing key family**

The tests cover all functions currently in `CacheKeys`: session, user profile, subscription, mutual friend, categories, friend IDs/count, push tokens, preferences, unread count, timezones, weather forecast/latest/conditions, friend todo page, and daily completion range.

- [ ] **Step 2: Run the key tests and verify failure**

Run: `pnpm --filter @aido/api test -- cache.keys`

Expected: FAIL because bounded-context builders are absent.

- [ ] **Step 3: Implement builders and TTL constants**

Every function delegates to the shared primitive. Keep existing TTL numeric values exactly unchanged. Include payload schema version only in the global `aido:v1` prefix; add a resource-local version only when its serialized payload changes later.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @aido/api test -- cache.keys
git add apps/api/src/*/infrastructure/cache
git commit -m "refactor(api): move cache keys to bounded contexts"
```

### Task 3: Replace all central CacheKeys consumers

**Files:**
- Modify: `apps/api/src/shared/infrastructure/cache/cache.service.ts`
- Modify: `apps/api/src/daily-completion/infrastructure/adapters/daily-completion-cache.adapter.ts`
- Modify: `apps/api/src/notification/infrastructure/adapters/push-dispatcher.adapter.ts`
- Modify: `apps/api/src/todo/infrastructure/adapters/todo-cache.adapter.ts`
- Modify: weather query/service/use-case files currently importing `CacheKeys`.
- Delete: `apps/api/src/shared/infrastructure/cache/constants/cache-keys.ts`
- Delete: `apps/api/src/shared/infrastructure/cache/constants/cache-keys.spec.ts`

**Interfaces:**
- Consumes: Task 2 builders.
- Produces: no production reference to the deleted central registry.

- [ ] **Step 1: Add behavior tests proving cache miss falls back to DB**

For session validation, todo friend page, weather, and push token lookups, seed only the DB/fake provider, leave the new cache empty, and assert the original result and HTTP status are unchanged.

- [ ] **Step 2: Replace imports context by context**

Move typed convenience key selection out of shared `CacheService` into the owning adapter/service. Keep `ICacheService` generic operations unchanged. Where compatibility methods remain temporarily, pass the completed key into them rather than constructing it in shared.

- [ ] **Step 3: Prove no raw registry usage remains**

Run:

```bash
rg -n "CacheKeys|session:|user:profile:|friends:mutual:|weather:forecast:|todo:friend-view:" apps/api/src
```

Expected: no `CacheKeys` matches and literal key matches appear only in `*.keys.spec.ts` expected strings.

- [ ] **Step 4: Run affected tests and commit**

```bash
pnpm --filter @aido/api test -- cache notification todo weather daily-completion auth
pnpm --filter @aido/api lint:arch
pnpm --filter @aido/api typecheck
git add apps/api/src
git commit -m "refactor(api): use bounded cache key builders"
```

### Task 4: Standardize dedup, lock, throttle, and documentation

**Files:**
- Modify: `apps/api/src/shared/infrastructure/dedup/constants/dedup-keys.ts`
- Modify: dedup and lock call sites found by `rg -n "dedup|lock" apps/api/src`.
- Modify: `apps/api/.claude/architecture.md`
- Modify: `apps/api/AGENTS.md`

**Interfaces:**
- Consumes: shared keyspace primitive and bounded-context builders.
- Produces: the same `aido:v1` prefix for cache, dedup, lock, and rate-limit keys.

- [ ] **Step 1: Add exact dedup/lock key tests**

Assert notification dedup, short lock, and rate-limit keys have separate resource segments and cannot collide with cache keys for identical identifiers.

- [ ] **Step 2: Replace raw strings and update docs**

Document ownership, prefix/version rule, TTL placement, encoding, cache-miss correctness, and the ban on a new global feature-key registry.

- [ ] **Step 3: Run complete static and behavior verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm --filter @aido/api lint:arch
pnpm --filter @aido/api test
pnpm --filter @aido/api test:e2e -- auth.e2e-spec.ts openapi-contract.e2e-spec.ts --runInBand
git diff --exit-code -- apps/api/test/e2e/__snapshots__/openapi-contract.e2e-spec.ts.snap
```

Expected: PASS; OpenAPI snapshot unchanged; existing sessions remain DB-backed and valid.

- [ ] **Step 4: Commit key standardization documentation**

```bash
git add apps/api/src/shared/infrastructure/dedup apps/api/src apps/api/.claude/architecture.md apps/api/AGENTS.md
git commit -m "docs(api): standardize infrastructure key ownership"
```
