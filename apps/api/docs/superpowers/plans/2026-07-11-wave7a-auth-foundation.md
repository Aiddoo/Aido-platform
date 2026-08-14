# Wave 7a — auth Foundation (기계적 4계층 재배치) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** auth 모듈 58파일을 todo 표준 4계층 폴더(domain/application/infrastructure/presentation)로 `git mv` 재배치하고, 공개 배럴 API를 확정하며, 외부 소비자를 배럴로 재배선한다. **로직 byte-identical, 클라이언트 영향 zero.**

**Architecture:** Wave 0와 동일한 순수 기계적 재배치 방법론. 파일 이동 + 임포트 경로 치환만 수행하며 어떤 함수 본문도 바꾸지 않는다. 안전성은 OpenAPI 스냅샷 diff 0 + 전체 유닛/통합/e2e 스위트로 증명한다. auth는 아직 `CLEAN_MODULES`에 등록하지 않으므로 `no-cast`/`boundaries` 게이트는 이 커밋에서 비활성(레거시 `BusinessExceptions`·`tx?`·`as` 캐스트는 그대로 유지된다).

**Tech Stack:** NestJS 11 · Prisma 7 · TypeScript 5.9 · Biome 2.4 · Jest · Testcontainers

## Global Constraints

- **클라이언트 영향 zero**: `test/e2e/__snapshots__/openapi-contract.e2e-spec.ts.snap` **diff 0**. request/response·에러코드(@aido/errors)·상태코드·시맨틱 동결.
- **로직 무변경**: 이 커밋은 파일 이동 + 임포트 경로 치환만. 함수 본문·클래스 로직·DI 토큰·프로바이더 배열 순서 변경 금지.
- **전역 파이프라인 불변**: `app.module.ts`의 `APP_GUARD`(JwtAuthGuard)·`APP_INTERCEPTOR`(LastActiveInterceptor) 등록 순서·동작 불변.
- **auth는 CLEAN_MODULES 미등록** — 이 커밋에서 `scripts/check-boundaries.mjs`·`scripts/check-no-cast.mjs` 수정 금지.
- **제어문 중괄호 필수**, biome-ignore 금지. 커밋 전 `pnpm exec biome check --write src test`. commitlint body-max-line-length 100자. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Move Map (source → destination)

이 표가 모든 `git mv` + 임포트 치환의 완전한 명세다. 대상 폴더는 todo 표준(subscription/notification 선례) 관례를 따른다. **최종 레이어에 직접 배치**하여 7b–7d에서 파일이 재이동되지 않게 한다.

### presentation/

| 현재                                                    | 대상                                                   |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `controllers/auth.controller.ts`                        | `presentation/controllers/auth.controller.ts`          |
| `controllers/account.controller.ts`                     | `presentation/controllers/account.controller.ts`       |
| `controllers/oauth.controller.ts`                       | `presentation/controllers/oauth.controller.ts`         |
| `controllers/session.controller.ts`                     | `presentation/controllers/session.controller.ts`       |
| `controllers/auth-controller.utils.ts`                  | `presentation/controllers/auth-controller.utils.ts`    |
| `controllers/index.ts`                                  | `presentation/controllers/index.ts`                    |
| `dtos/*` (3파일)                                        | `presentation/dtos/*`                                  |
| `decorators/*` (4파일: admin/current-user/public/index) | `presentation/decorators/*`                            |
| `interceptors/last-active.interceptor.ts`               | `presentation/interceptors/last-active.interceptor.ts` |
| `auth.mapper.ts` + `auth.mapper.spec.ts`                | `presentation/auth.mapper.ts` + spec                   |

### infrastructure/

| 현재                                                                                                      | 대상                                                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `guards/*` (jwt-auth/jwt-refresh/admin/index + specs)                                                     | `infrastructure/guards/*`                                              |
| `strategies/*` (jwt/jwt-refresh/index + specs)                                                            | `infrastructure/strategies/*`                                          |
| `repositories/*` (account/login-attempt/oauth-state/security-log/session/user/verification/index + specs) | `infrastructure/persistence/*`                                         |
| `services/oauth-providers/*` (apple/google/kakao/naver/oauth-provider.strategy/index)                     | `infrastructure/oauth/adapters/*`                                      |
| `services/oauth-token-verifier.service.ts` + spec                                                         | `infrastructure/oauth/verifier/oauth-token-verifier.service.ts` + spec |
| `services/password.service.ts` + spec                                                                     | `infrastructure/adapters/password.service.ts` + spec                   |
| `services/token.service.ts` + spec                                                                        | `infrastructure/adapters/token.service.ts` + spec                      |
| `jobs/account-purge.job.ts` + spec                                                                        | `infrastructure/scheduler/account-purge.job.ts` + spec                 |
| `processors/account-purge.processor.ts`                                                                   | `infrastructure/queue/account-purge.processor.ts`                      |

### application/

| 현재                                             | 대상                                                         |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `services/auth.service.ts` + spec                | `application/services/auth.service.ts` + spec                |
| `services/oauth.service.ts` + spec               | `application/services/oauth.service.ts` + spec               |
| `services/password-management.service.ts` + spec | `application/services/password-management.service.ts` + spec |
| `services/session.service.ts` + spec             | `application/services/session.service.ts` + spec             |
| `services/verification.service.ts` + spec        | `application/services/verification.service.ts` + spec        |
| `services/index.ts`                              | `application/services/index.ts` (재구성)                     |
| `types/*` (auth.types/session.types/index)       | `application/types/*`                                        |
| `utils/auth-validation.utils.ts`                 | `application/utils/auth-validation.utils.ts`                 |

### domain/

| 현재                                 | 대상                                         |
| ------------------------------------ | -------------------------------------------- |
| `constants/*` (auth.constants/index) | `domain/constants/*`                         |
| `utils/random-name.util.ts` + spec   | `domain/services/random-name.util.ts` + spec |
| `utils/user-tag.util.ts`             | `domain/services/user-tag.util.ts`           |

> `auth.module.ts`, `index.ts`는 루트 유지. `services/oauth-providers/` 내부의 `IOAuthProviderStrategy`는 7b에서 application 포트로 승격 예정이나, 7a에서는 어댑터와 함께 `infrastructure/oauth/adapters/`에 둔다(로직 무변경).

---

### Task 1: 4계층 스켈레톤 생성 + presentation 레이어 이동

**Files:** `git mv` per 위 표의 presentation/ 섹션. 이동 후 이동한 파일들의 상대 임포트 경로만 갱신.

**Interfaces:**

- Produces: `presentation/controllers/*`, `presentation/dtos/*`, `presentation/decorators/*`, `presentation/interceptors/*`, `presentation/auth.mapper.ts`.

- [ ] **Step 1: presentation 파일 git mv**

```bash
cd apps/api/src/auth
mkdir -p presentation/controllers presentation/dtos presentation/decorators presentation/interceptors
git mv controllers/auth.controller.ts controllers/auth.controller.spec.ts presentation/controllers/
git mv controllers/account.controller.ts controllers/account.controller.spec.ts presentation/controllers/
git mv controllers/oauth.controller.ts controllers/oauth.controller.spec.ts presentation/controllers/
git mv controllers/session.controller.ts controllers/session.controller.spec.ts presentation/controllers/
git mv controllers/auth-controller.utils.ts controllers/index.ts presentation/controllers/
git mv dtos/auth.request.dto.ts dtos/auth.response.dto.ts dtos/index.ts presentation/dtos/
git mv decorators/admin.decorator.ts decorators/current-user.decorator.ts decorators/public.decorator.ts decorators/index.ts presentation/decorators/
git mv interceptors/last-active.interceptor.ts presentation/interceptors/
git mv auth.mapper.ts auth.mapper.spec.ts presentation/
rmdir controllers dtos decorators interceptors 2>/dev/null || true
```

- [ ] **Step 2: 이동 파일의 상대 임포트 경로 갱신**

이동한 각 파일이 참조하는 auth 내부 상대 경로(`../services/...`, `../repositories/...`, `../constants/...`, `../types/...`, `../guards/...`, `../decorators/...` 등)를 새 위치 기준으로 갱신한다. **원칙**: auth 내부 참조는 가능하면 `@/auth/<layer>/...` 절대 경로로 통일하지 말고 기존 스타일(상대) 유지하되 깊이만 보정. 실제 경로는 다음 Step의 tsc가 지시한다.

- [ ] **Step 3: 타입체크로 깨진 임포트 전수 식별 및 수정**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "auth/presentation" | head -60
```

Expected: 이동 파일들의 `Cannot find module` 목록. 각 오류를 File Move Map에 따라 새 경로로 치환. 오류 0까지 반복.

- [ ] **Step 4: 타입체크 green 확인**

```bash
cd apps/api && npx tsc --noEmit && echo OK
```

Expected: `OK` (프로젝트 전체 — 아직 다른 레이어 미이동이라 auth.module.ts·index.ts의 이동파일 참조가 남아있으면 이 시점엔 실패 가능. 그럴 경우 Task 4까지 진행 후 일괄 green). **주의**: Task 1–3은 중간 상태라 tsc가 auth.module/index 참조 오류를 낼 수 있음 — Task 4(배럴/모듈 갱신) 완료 시점에 전체 green을 목표로 한다.

---

### Task 2: infrastructure 레이어 이동

**Files:** `git mv` per 표의 infrastructure/ 섹션.

**Interfaces:**

- Produces: `infrastructure/persistence/*` (7 repos), `infrastructure/oauth/adapters/*` (4 providers + strategy iface), `infrastructure/oauth/verifier/*`, `infrastructure/adapters/{password,token}.service.ts`, `infrastructure/guards/*`, `infrastructure/strategies/*`, `infrastructure/scheduler/account-purge.job.ts`, `infrastructure/queue/account-purge.processor.ts`.

- [ ] **Step 1: infrastructure 파일 git mv**

```bash
cd apps/api/src/auth
mkdir -p infrastructure/persistence infrastructure/oauth/adapters infrastructure/oauth/verifier infrastructure/adapters infrastructure/guards infrastructure/strategies infrastructure/scheduler infrastructure/queue
git mv repositories/*.ts infrastructure/persistence/
git mv services/oauth-providers/*.ts infrastructure/oauth/adapters/
git mv services/oauth-token-verifier.service.ts services/oauth-token-verifier.service.spec.ts infrastructure/oauth/verifier/
git mv services/password.service.ts services/password.service.spec.ts infrastructure/adapters/
git mv services/token.service.ts services/token.service.spec.ts infrastructure/adapters/
git mv guards/*.ts infrastructure/guards/
git mv strategies/*.ts infrastructure/strategies/
git mv jobs/account-purge.job.ts jobs/account-purge.job.spec.ts infrastructure/scheduler/
git mv processors/account-purge.processor.ts infrastructure/queue/
rmdir repositories guards strategies jobs processors services/oauth-providers 2>/dev/null || true
```

- [ ] **Step 2: 이동 파일 상대 임포트 경로 갱신** — Task 1 Step 2와 동일 방식.

- [ ] **Step 3: 부분 타입체크로 깨진 경로 식별**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -E "auth/(infrastructure|persistence|oauth)" | head -80
```

각 오류를 File Move Map 기준 새 경로로 치환.

---

### Task 3: application + domain 레이어 이동

**Files:** `git mv` per 표의 application/ 및 domain/ 섹션.

**Interfaces:**

- Produces: `application/services/*` (5 services), `application/types/*`, `application/utils/*`, `domain/constants/*`, `domain/services/{random-name,user-tag}.util.ts`.

- [ ] **Step 1: application/domain 파일 git mv**

```bash
cd apps/api/src/auth
mkdir -p application/services application/types application/utils domain/constants domain/services
git mv services/auth.service.ts services/auth.service.spec.ts application/services/
git mv services/oauth.service.ts services/oauth.service.spec.ts application/services/
git mv services/password-management.service.ts services/password-management.service.spec.ts application/services/
git mv services/session.service.ts services/session.service.spec.ts application/services/
git mv services/verification.service.ts services/verification.service.spec.ts application/services/
git mv services/index.ts application/services/
git mv types/*.ts application/types/
git mv utils/auth-validation.utils.ts application/utils/
git mv constants/*.ts domain/constants/
git mv utils/random-name.util.ts utils/random-name.util.spec.ts domain/services/
git mv utils/user-tag.util.ts domain/services/
rmdir services types utils constants 2>/dev/null || true
```

- [ ] **Step 2: 이동 파일 상대 임포트 경로 갱신** — 동일 방식.

---

### Task 4: `auth.module.ts` provider 경로 + 루트 배럴 `index.ts` 공개 API 갱신

**Files:**

- Modify: `src/auth/auth.module.ts` (모든 provider/controller import 경로를 새 4계층 위치로)
- Modify: `src/auth/index.ts` (배럴)

**Interfaces:**

- Produces (배럴 공개 표면 — 외부가 의존): `AuthModule`, `Public`, `Admin`, `CurrentUser`, `type CurrentUserPayload`, `JwtAuthGuard`, `JwtRefreshGuard`, `AdminGuard`, `LastActiveInterceptor`, `UserRepository`, `ACCOUNT_PURGE_QUEUE`, `AccountPurgeProcessor`, `AccountPurgeJob`, `OAuthTokenVerifierService`(테스트/e2e), + 기존 서비스/컨트롤러/dtos/types/constants/mapper.

- [ ] **Step 1: `auth.module.ts` import 경로 갱신**

`auth.module.ts`의 모든 `import`를 새 위치로 치환(예: `./controllers` → `./presentation/controllers`, `./services` → `./application/services`, `./repositories` → `./infrastructure/persistence`, `./guards` → `./infrastructure/guards`, `./strategies` → `./infrastructure/strategies`, `./interceptors/...` → `./presentation/interceptors/...`, `./services/oauth-providers` → `./infrastructure/oauth/adapters`, `./services/oauth-token-verifier.service` → `./infrastructure/oauth/verifier/oauth-token-verifier.service`, `./services/password.service`·`./services/token.service` → `./infrastructure/adapters/...`, `./jobs/...` → `./infrastructure/scheduler/...`, `./processors/...` → `./infrastructure/queue/...`, `./constants` → `./domain/constants`, `./utils/...` → `./domain/services/...` 또는 `./application/utils/...`). **provider 배열의 순서·토큰·클래스 목록은 변경 금지.**

- [ ] **Step 2: 루트 배럴 `index.ts` 재작성**

새 4계층 경로에서 re-export하도록 갱신. 기존 `export *` 대상들을 새 위치로 옮기고, **추가로 공개**: `LastActiveInterceptor`(presentation/interceptors), `UserRepository`(infrastructure/persistence — ai 위임 어댑터용, todo-category 시더 선례처럼 concrete 유지), `ACCOUNT_PURGE_QUEUE`+`AccountPurgeProcessor`(infrastructure/queue), `AccountPurgeJob`(infrastructure/scheduler), `OAuthTokenVerifierService`(infrastructure/oauth/verifier — e2e fake override용). 예:

```typescript
export { AuthModule } from './auth.module';
export * from './presentation/decorators';
export * from './presentation/controllers';
export * from './presentation/dtos';
export { AuthMapper } from './presentation/auth.mapper';
export { LastActiveInterceptor } from './presentation/interceptors/last-active.interceptor';
export * from './infrastructure/guards';
export * from './infrastructure/strategies';
export { UserRepository } from './infrastructure/persistence/user.repository';
export {
  ACCOUNT_PURGE_QUEUE,
  AccountPurgeProcessor,
} from './infrastructure/queue/account-purge.processor';
export { AccountPurgeJob } from './infrastructure/scheduler/account-purge.job';
export {
  OAuthTokenVerifierService,
  type VerifiedProfile,
} from './infrastructure/oauth/verifier/oauth-token-verifier.service';
export * from './application/services';
export * from './application/types';
export * from './domain/constants';
```

(정확한 export 목록은 기존 `index.ts` 및 하위 `index.ts` 배럴들과 대조하여 누락 없이 옮긴다.)

- [ ] **Step 3: 전체 타입체크 green**

```bash
cd apps/api && npx tsc --noEmit && echo TYPECHECK_OK
```

Expected: `TYPECHECK_OK`. 남은 `Cannot find module`는 File Move Map으로 해소.

---

### Task 5: 외부 소비자 배럴 재배선

**Files:**

- Modify: `src/app.controller.ts`, `src/health/health.controller.ts`, `src/subscription/presentation/subscription.controller.ts` — `@/auth/decorators/public.decorator` → `@/auth`
- Modify: `src/user-settings/presentation/user-settings.controller.ts` — `@/auth/decorators` → `@/auth`
- Modify: `src/app.module.ts` — `@/auth/guards/jwt-auth.guard`·`@/auth/interceptors/last-active.interceptor` → `@/auth`
- Modify: `src/ai/infrastructure/adapters/prisma-ai-usage.repository.ts` — `../../../auth/repositories/user.repository` → `@/auth`
- Modify: `test/e2e/helpers/e2e-app-factory.ts` — `AccountPurgeJob`, `account-purge.processor`(ACCOUNT_PURGE_QUEUE/AccountPurgeProcessor), `OAuthTokenVerifierService` deep imports → `@/auth`
- Modify: `test/integration/*` + `test/integration/helpers/auth-test-module.factory.ts` + `test/mocks/fake-oauth-token-verifier.service.ts` — deep auth repo/service/`VerifiedProfile` imports → 새 경로 또는 배럴(테스트는 boundaries 미적용이나 typecheck 위해 경로 갱신 필수)

**Interfaces:**

- Consumes: Task 4의 배럴 공개 API.

- [ ] **Step 1: 프로덕션 소비자 재배선** (위 목록의 src/ 파일들). deep import 라인을 `@/auth` 배럴 import로 교체.

- [ ] **Step 2: 테스트 소비자 경로 갱신** — e2e-app-factory·integration specs·helpers·mocks의 deep auth 경로를 새 위치(또는 배럴)로 갱신.

- [ ] **Step 3: 남은 auth deep import 전수 스캔**

```bash
cd apps/api
grep -rn '@/auth/\(controllers\|services\|repositories\|guards\|strategies\|decorators\|interceptors\|jobs\|processors\|constants\|types\|utils\)' src test --include="*.ts" | grep -v "^src/auth/"
```

Expected: 빈 결과(모든 외부 참조가 배럴 또는 새 경로). 남으면 갱신.

- [ ] **Step 4: 전체 타입체크**

```bash
cd apps/api && npx tsc --noEmit && echo TYPECHECK_OK
```

Expected: `TYPECHECK_OK`.

---

### Task 6: 전체 게이트 검증 + 커밋

- [ ] **Step 1: biome 정렬/린트**

```bash
cd apps/api && pnpm exec biome check --write src test && pnpm exec biome check src test; echo "biome exit: $?"
```

Expected: `biome exit: 0`.

- [ ] **Step 2: 타입체크 재확인(biome 재정렬 후)**

```bash
cd apps/api && npx tsc --noEmit && echo OK
```

- [ ] **Step 3: 전체 유닛 테스트**

```bash
cd apps/api && pnpm exec jest 2>&1 | tail -6
```

Expected: 이전과 동일 통과 수(2145 passed 근방), 실패 0.

- [ ] **Step 4: 전체 통합 테스트**

```bash
cd apps/api && pnpm exec jest --config ./test/jest-integration.json 2>&1 | tail -6
```

Expected: 25 suites / 317 passed, 실패 0.

- [ ] **Step 5: e2e 전체 + OpenAPI 스냅샷 diff 0**

```bash
cd apps/api && pnpm exec jest --config ./test/jest-e2e.json --forceExit 2>&1 | tail -10
```

Expected: 22 suites / 371 passed, `Snapshots: 2 passed`(OpenAPI diff 0), 실패 0.

- [ ] **Step 6: 커밋**

```bash
cd /Users/matthew/workspace/aido/Aido-platform
git add -A && git commit -F - <<'EOF'
refactor(api): auth 4계층 폴더 재배치 + 배럴 공개 API 확정 (Wave 7a)

58파일을 domain/application/infrastructure/presentation으로 git mv,
로직 byte-identical. 배럴이 Public·CurrentUser·JwtAuthGuard·
LastActiveInterceptor·UserRepository·ACCOUNT_PURGE_QUEUE를 공개하고
외부 소비자(app.module·app/health/subscription/user-settings 컨트롤러·
ai 위임 어댑터·e2e/통합 팩토리)를 배럴로 재배선. auth는 아직
CLEAN_MODULES 미등록(no-cast·boundaries는 7e에서 ON). 게이트 green:
유닛 2145·통합 317·e2e 371·OpenAPI 스냅샷 diff 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```
