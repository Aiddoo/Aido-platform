# Aido API 종합 테스팅 가이드

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Platform Team

> 테스트 유형 선택 기준 + 공유 인프라 + 공통 규칙. 각 유형별 상세는 개별 가이드 참조.

## 관련 문서

| 문서 | 내용 |
|------|------|
| [unit-test.md](./unit-test.md) | 단위 테스트 상세 (Suites, Builder, GWT) |
| [integration-test.md](./integration-test.md) | 통합 테스트 상세 (Mock DB, 실제 DB) |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 상세 (createE2eApp, supertest) |

---

## 1. 테스트 피라미드

```
        /\
       /E2E\        적은 수, 느림, 실제 환경
      /------\
     /Integ- \      중간, NestJS DI 검증
    / ration  \
   /------------\
  /    Unit      \  많은 수, 빠름, 격리됨
 /----------------\
```

| 유형 | 파일 패턴 | 목적 | 상세 가이드 |
|------|----------|------|------------|
| Unit | `*.spec.ts` | 개별 클래스/메서드 동작 검증 | [unit-test.md](./unit-test.md) |
| Integration | `*.integration-spec.ts` | Service + Repository DI / DB 스택 검증 | [integration-test.md](./integration-test.md) |
| E2E | `*.e2e-spec.ts` | 전체 API 흐름 검증 | [e2e-test.md](./e2e-test.md) |

---

## 2. 유형 선택 기준

| 검증하려는 것 | 유형 | 이유 |
|-------------|------|------|
| 단일 메서드의 입력 검증 / 예외 분기 | Unit | `TestBed.solitary`가 의존성 자동 Mock |
| Repository 쿼리 파라미터 | Unit | `toHaveBeenCalledWith`로 충분 |
| NestJS DI 연결 정합성 | Integration (Mock DB) | 실제 DI 컨테이너 구동 필요 |
| `$transaction` 다중 Repository 조합 | Integration (Mock DB) | 트랜잭션 콜백 통합 검증 |
| 실제 DB 쿼리 + 마이그레이션 정합성 | Integration (실제 DB) | Testcontainers PostgreSQL |
| HTTP 요청 → 응답 전체 흐름 | E2E | supertest + 인증 + DB |
| Guard / Interceptor 동작 | E2E | 실제 HTTP 파이프라인 필요 |

---

## 3. 파일 구조

```
apps/api/
├── src/{name}/
│   ├── {name}.service.spec.ts          # Unit 테스트 (레거시 Service — auth 한정)
│   ├── domain/
│   │   ├── entities/{name}.entity.spec.ts       # 애그리게잇 Unit (클린아키 모듈)
│   │   └── value-objects/*.vo.spec.ts           # VO 불변식 Unit
│   └── application/
│       ├── use-cases/<kebab>/<kebab>.use-case.spec.ts  # 쓰기 use-case Unit
│       ├── queries/<kebab>/<kebab>.use-case.spec.ts    # 읽기 use-case Unit
│       └── events/*.handler.spec.ts                    # @OnEvent 구독자 Unit
└── test/
    ├── e2e/{name}.e2e-spec.ts          # E2E 테스트
    ├── integration/{name}.integration-spec.ts  # Integration 테스트
    ├── builders/                        # 테스트 데이터 빌더 (17+)
    ├── mocks/                           # FakeService + Mock 팩토리
    │   └── ports/                       # Symbol 토큰 포트 mock 팩토리 (클린아키)
    └── setup/                           # TestDatabase, suppressLogger 등
```

### 3.1 Use-case spec 패턴 (클린아키텍처 모듈)

`@suites/unit`은 Symbol 토큰 포트를 auto-mock하지 못하므로 `test/mocks/ports/`의 수제 팩토리를 사용한다 (실제 예: `update-todo.use-case.spec.ts`):

```ts
const { unit, unitRef } = await TestBed.solitary(UpdateTodoUseCase)
	.mock<TodoRepositoryPort>(TODO_REPOSITORY)
	.impl(() => createTodoRepositoryMock())
	.mock(UNIT_OF_WORK)
	.impl(() => createUnitOfWorkMock())   // run(work) 즉시 실행 패스스루
	.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
	.impl(() => ({ publishAll: jest.fn() }))
	.compile();
useCase = unit;
eventPublisher = unitRef.get<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER);
```

- 이벤트 발행 검증: **`expect(eventPublisher.publishAll).toHaveBeenCalledWith([new TodoDeletedEvent(1, "user-123")])`** — 이벤트 인스턴스 배열로 정확 단언. 애그리게잇 내부(`raise`)는 protected라 스파이하지 않는다
- TX mock: `createUnitOfWorkMock()`은 `run(work)`을 즉시 실행 패스스루로 구현 — 콜백이 무인자(CLS 기반)라 tx 핸들 조립이 필요 없다
- 포트 mock 팩토리는 포트 인터페이스 반환 타입 강제 → 포트 확장 시 누락이 컴파일 에러로 드러남
- 애그리게잇 픽스처는 `Todo.reconstitute({...})` — schedule은 `TodoSchedule.reconstitute`, 항목은 `TodoItem.reconstitute`로 조립. 응답 read model은 `TodoBuilder` + 응답 매퍼
- 자식 엔티티·VO·도메인 정책은 프레임워크 없이 순수 단위 테스트 (예: `todo-item.entity.spec.ts`, `completion-policy.spec.ts`)

### 3.2 동작 동일성 게이트 (마이그레이션 필수)

| 게이트 | 파일 | 검증 내용 |
|--------|------|----------|
| **OpenAPI 계약 스냅샷** | `test/e2e/openapi-contract.e2e-spec.ts` | 전체 라우트·요청/응답 스키마 스냅샷 — **diff 0 = 클라이언트 영향 0**. 의도적 계약 변경 시에만 `-u`로 재생성 |
| **블랙박스 E2E** | `test/e2e/todo.e2e-spec.ts` 등 | 리팩터링 시 **무수정 통과**가 원칙 — 테스트를 고치면 동일성 증명이 깨진다 |

---

## 4. 공유 인프라

### 4.1 핵심 인프라

| 파일 | 용도 | 사용처 |
|------|------|--------|
| `test/setup/suppress-logger.ts` | `suppressLogger()` — Logger 출력 억제 | Integration |
| `test/mocks/mock-database.factory.ts` | `createMockDatabaseService()` — DB Mock + `$transaction` 자동 설정 | Integration (Mock DB) |
| `test/e2e/helpers/e2e-app-factory.ts` | `createE2eApp()` / `destroyE2eApp()` | E2E |
| `test/e2e/helpers/e2e-helpers.ts` | `E2eHelpers` — `createVerifiedUser()` 등 | E2E |
| `test/setup/test-database.ts` | `TestDatabase` (Testcontainers PostgreSQL) | Integration (실제 DB) + E2E |
| `test/integration/helpers/auth-test-module.factory.ts` | `createAuthTestModule()` | Integration (실제 DB, Auth) |

### 4.2 FakeService 목록

| 파일 | 대체 대상 |
|------|----------|
| `fake-email.service.ts` | 이메일 발송 |
| `fake-oauth-token-verifier.service.ts` | OAuth 토큰 검증 |
| `fake-admin-notifier.ts` | Discord 관리자 알림 |
| `fake-ai.provider.ts` | Gemini AI |
| `fake-push.provider.ts` | Expo 푸시 알림 |
| `fake-bull-queue.ts` | BullMQ 큐 |
| `fake-logger.service.ts` | Pino Logger |

### 4.3 Builder vs Fixture 선택 기준

| 상황 | 선택 | 예시 |
|------|------|------|
| 단일 엔티티 mock 반환값 | Builder | `UserBuilder.create().verified().build()` |
| 도메인 상태가 중요한 테스트 | Builder | `.locked()`, `.expired()`, `.asPremium()` |
| DB에 실제 삽입할 복합 데이터 | Fixture | `UserFixture.createFull()` |

---

## 5. 공통 규칙

### DO

- ✅ Given/When/Then 주석으로 테스트 의도 표현
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ 한국어 describe명 + 유형 태그 (예: `"(Mock DB)"`, `"(실제 DB)"`)
- ✅ `jest.clearAllMocks()`는 전역 설정(`test/setup/jest.setup.ts`)에서 자동 호출되므로 **개별 파일에서 불필요** — Builder ID 카운터 리셋만 `beforeEach`에서 호출
- ✅ FakeService로 외부 서비스 대체 (E2E)

### DON'T

- ❌ Unit 테스트에서 실제 DB 연결
- ❌ Integration 테스트에서 HTTP 요청
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID 사용 (Builder 사용)
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)

> 유형별 DO/DON'T 상세는 각 개별 가이드 참조.

### 전역 설정 참고

`jest.clearAllMocks()`는 `test/setup/jest.setup.ts`에서 `afterEach`로 전역 호출되며, `jest.preset.cjs`에서도 `clearMocks: true`, `restoreMocks: true`가 설정되어 있습니다. **개별 테스트 파일에서 별도로 호출할 필요가 없습니다.**

---

## 6. 실행 명령어

```bash
# Unit
pnpm --filter @aido/api test                     # 전체
pnpm --filter @aido/api test {파일명}             # 특정 파일
pnpm --filter @aido/api test:watch               # Watch 모드
pnpm --filter @aido/api test:cov                 # 커버리지

# Integration
pnpm --filter @aido/api test:integration         # 전체

# E2E
pnpm --filter @aido/api test:e2e                 # 전체
pnpm --filter @aido/api test:e2e -- {파일명}      # 특정 파일
pnpm --filter @aido/api test:e2e -- -t "패턴"    # 특정 테스트
```

---

## 7. 예제 파일 경로

| 유형 | 예제 파일 |
|------|----------|
| **Unit (모범 사례)** | `src/cheer/cheer.service.spec.ts` — GWT, Builder 모두 적용 |
| Unit (Suites) | `src/notification/notification.service.spec.ts` |
| Integration (Mock DB) | `test/integration/cheer.integration-spec.ts` |
| Integration (실제 DB) | `test/integration/auth-password-setup.integration-spec.ts` |
| E2E | `test/e2e/todo.e2e-spec.ts` |
| Builder | `test/builders/user.builder.ts` |
| FakeService | `test/mocks/fake-*.ts` |

---

**문서 버전**: 4.0.0
**최종 수정일**: 2026-04-05
