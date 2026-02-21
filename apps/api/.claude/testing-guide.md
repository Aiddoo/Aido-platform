# Aido API 종합 테스팅 가이드

> Unit → Integration → E2E 순서로 테스트 작성 및 실행 가이드

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [Unit 테스트](#2-unit-테스트)
3. [Integration 테스트](#3-integration-테스트)
4. [E2E 테스트](#4-e2e-테스트)
5. [공유 인프라](#5-공유-인프라)
6. [공통 규칙](#6-공통-규칙)
7. [참고 자료](#7-참고-자료)

---

## 1. 테스트 개요

### 1.1 테스트 피라미드

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

| 유형 | 파일 패턴 | 목적 | 핵심 도구 |
|------|----------|------|----------|
| Unit | `*.spec.ts` | 개별 클래스/메서드 동작 검증 | `@suites/unit` + Builder |
| Integration (Mock DB) | `*.integration-spec.ts` | Service + Repository DI 검증 | `createMockDatabaseService()` |
| Integration (실제 DB) | `*.integration-spec.ts` | 전체 DB 스택 검증 | Testcontainers |
| E2E | `*.e2e-spec.ts` | 전체 API 흐름 검증 | `createE2eApp()` + supertest |

### 1.2 파일 구조

```
apps/api/
├── src/
│   └── modules/
│       └── {name}/
│           ├── {name}.service.ts
│           └── {name}.service.spec.ts        # Unit 테스트
│
└── test/
    ├── e2e/
    │   ├── helpers/
    │   │   ├── e2e-app-factory.ts            # createE2eApp / destroyE2eApp
    │   │   ├── e2e-helpers.ts                # E2eHelpers (VerifiedUser 등)
    │   │   └── index.ts
    │   └── {name}.e2e-spec.ts                # E2E 테스트
    ├── integration/
    │   ├── helpers/
    │   │   └── auth-test-module.factory.ts   # Auth 실제 DB 테스트 모듈 팩토리
    │   └── {name}.integration-spec.ts        # Integration 테스트
    ├── builders/                              # 테스트 데이터 빌더
    │   ├── index.ts
    │   ├── user.builder.ts
    │   ├── account.builder.ts
    │   ├── session.builder.ts
    │   ├── verification.builder.ts
    │   ├── login-attempt.builder.ts
    │   ├── security-log.builder.ts
    │   ├── user-consent.builder.ts
    │   ├── notification.builder.ts
    │   ├── todo.builder.ts
    │   └── ...
    ├── mocks/
    │   ├── fake-email.service.ts             # FakeEmailService
    │   ├── fake-oauth-token-verifier.service.ts
    │   ├── fake-logger.service.ts
    │   └── mock-database.factory.ts          # createMockDatabaseService
    └── setup/
        ├── suites.setup.ts                   # Suites 유틸리티
        ├── suppress-logger.ts                # suppressLogger() 헬퍼
        ├── test-database.ts                  # TestDatabase (Testcontainers)
        ├── test-database.service.ts          # TestDatabaseService
        ├── global-setup.ts                   # Jest global setup
        └── global-teardown.ts                # Jest global teardown
```

---

## 2. Unit 테스트

### 2.1 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | 테스트 대상과 같은 폴더 (`src/modules/{name}/`) |
| **명명 규칙** | `{파일명}.spec.ts` |
| **핵심 도구** | `@suites/unit` (자동 Mock) + Builder (테스트 데이터) |
| **목적** | 개별 클래스/메서드의 독립적인 동작 검증 |

### 2.2 Suites 패턴

```typescript
import { TestBed } from "@suites/unit";
import type { Mocked } from "@suites/doubles.jest";
import { AuthService } from "@/modules/auth/services/auth.service";
import { UserRepository } from "@/modules/auth/repositories/user.repository";

describe("AuthService", () => {
  let service: AuthService;
  let userRepo: Mocked<UserRepository>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(AuthService).compile();
    service = unit;
    userRepo = unitRef.get(UserRepository);
  });

  // 테스트 케이스들...
});
```

### 2.3 Builder 패턴

```typescript
import { UserBuilder, VerificationBuilder } from "@test/builders";

const user = UserBuilder.create().withEmail("test@example.com").verified().build();
const verification = VerificationBuilder.create("user-123", "EMAIL_VERIFY").expired().build();

// beforeEach에서 ID 카운터 리셋
beforeEach(() => {
  UserBuilder.resetIdCounter();
});
```

### 2.4 GWT 형식

```typescript
it("유효한 토큰을 등록해야 한다", async () => {
  // Given - 유효한 Expo 푸시 토큰 데이터 준비
  const data = { userId: mockUserId, token: "ExponentPushToken[xxx]" };
  notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

  // When - 푸시 토큰 등록 요청
  const result = await service.registerPushToken(data);

  // Then - 토큰 검증 및 저장 확인
  expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
  expect(result).toEqual(expectedToken);
});
```

### 2.5 Controller 테스트 작성 기준

Controller 스펙은 **위임과 변환** 두 가지를 검증합니다:

| 검증 대상 | 어서션 | 예시 |
|-----------|--------|------|
| **위임** (올바른 파라미터 전달) | `toHaveBeenCalledWith` | `expect(service.create).toHaveBeenCalledWith(...)` |
| **변환** (응답 구성 로직) | `toEqual` | `expect(result).toEqual({ message: "...", todo })` |

- Controller가 서비스 반환값을 **가공하여 응답을 구성**하면 → `toEqual`로 변환 로직 검증 (O)
- Controller가 서비스 반환값을 **그대로 pass-through**하면 → `toBeDefined()`로 충분, 구체적 값은 Service 스펙에 위임 (O)
- Controller에서 서비스 **반환값의 내부 필드 정합성**을 검증 → Service 스펙 범위이므로 불필요 (X)

### 2.6 실행 명령어

```bash
pnpm --filter @aido/api test                    # 전체 단위 테스트
pnpm --filter @aido/api test notification.service.spec  # 특정 파일
pnpm --filter @aido/api test:watch              # Watch 모드
pnpm --filter @aido/api test:cov                # 커버리지
```

**상세 가이드**: [unit-test.md](./unit-test.md)

---

## 3. Integration 테스트

### 3.1 개요

통합 테스트는 두 가지 유형으로 나뉩니다:

| 유형 | DB | 도구 | 목적 |
|------|-----|------|------|
| **Mock DB** | `createMockDatabaseService()` | NestJS TestingModule | Service + Repository DI 검증 |
| **실제 DB** | Testcontainers PostgreSQL | TestDatabase + 모듈 팩토리 | 전체 DB 스택 + 트랜잭션 검증 |

### 3.2 Mock DB 통합 테스트

#### 역할과 작성 기준

Mock DB 통합 테스트는 **NestJS DI 컨테이너를 실제로 구동**하여 Unit 테스트에서 커버하기 어려운 부분을 검증합니다.

**작성해야 하는 케이스** (Unit과 차별화되는 영역):
- NestJS DI 연결 정합성 (서비스/레포지토리 주입 확인)
- `$transaction` 콜백을 통한 다중 Repository 조합 시나리오
- EventEmitter / 캐시 등 인프라 서비스와의 통합
- 순환 의존성, 글로벌 모듈 로드 문제 검출

**작성하지 않아야 하는 케이스** (Unit에서 충분한 영역):
- 단일 Service 메서드의 입력 검증 / 예외 분기 (Unit의 `TestBed.solitary`가 커버)
- 단일 Repository의 쿼리 파라미터 검증 (Unit에서 `toHaveBeenCalledWith`로 커버)
- 단순한 CRUD 정상 경로 (Unit에서 이미 동일하게 검증)

```typescript
import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";

describe("CheerService 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let service: CheerService;
  const mockDb = createMockDatabaseService({
    cheer: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  });

  beforeAll(async () => {
    suppressLogger();
    module = await Test.createTestingModule({
      providers: [
        CheerService, CheerRepository,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();
    service = module.get<CheerService>(CheerService);
  });

  afterAll(async () => { await module.close(); jest.restoreAllMocks(); });
  beforeEach(() => { jest.clearAllMocks(); });
});
```

### 3.3 실제 DB 통합 테스트 (Auth 전용)

```typescript
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("비밀번호 설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let authService: AuthService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    suppressLogger();
    testDb = new TestDatabase();
    databaseService = await testDb.start() as DatabaseService;
    module = await createAuthTestModule(databaseService, fakeEmailService);
    authService = module.get<AuthService>(AuthService);
  }, 60000);

  beforeEach(async () => { await testDb.cleanup(); });
  afterAll(async () => { await testDb.stop(); await module.close(); });
});
```

### 3.4 실행 명령어

```bash
pnpm --filter @aido/api test:integration         # 전체 통합 테스트
pnpm --filter @aido/api test cheer.integration-spec  # 특정 파일
```

**상세 가이드**: [integration-test.md](./integration-test.md)

---

## 4. E2E 테스트

### 4.1 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | `test/e2e/` |
| **명명 규칙** | `{도메인}.e2e-spec.ts` |
| **핵심 도구** | `createE2eApp()` + `E2eHelpers` + supertest |
| **환경** | Testcontainers PostgreSQL + FakeService |

### 4.2 기본 구조 (팩토리 기반)

```typescript
import request from "supertest";
import {
  createE2eApp, destroyE2eApp, type E2eTestContext, type VerifiedUser,
} from "./helpers";

describe("Todo E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => { ctx = await createE2eApp(); }, 60000);
  afterAll(async () => { await destroyE2eApp(ctx); });

  beforeEach(async () => {
    await ctx.testDatabase.cleanup();
    ctx.fakeEmailService.clear();
  });

  it("Todo를 생성해야 한다", async () => {
    // Given - 인증된 사용자
    const user = await ctx.helpers.createVerifiedUser("test@example.com", "Test1234!");

    // When - Todo 생성 요청
    const response = await request(ctx.app.getHttpServer())
      .post("/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "E2E Test" })
      .expect(201);

    // Then - 응답 검증
    expect(response.body.data.title).toBe("E2E Test");
  });
});
```

### 4.3 E2eHelpers API

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `createVerifiedUser(email, password)` | `VerifiedUser` | 회원가입 + 인증 + 토큰 반환 |
| `loginUser(email, password)` | `{ accessToken, refreshToken }` | 로그인 후 토큰 반환 |
| `createFriendship(user1, user2)` | `void` | 양방향 팔로우 (친구 관계) |
| `getDefaultCategoryId(accessToken)` | `number` | 기본 카테고리 ID 조회 |

```typescript
interface VerifiedUser {
  accessToken: string;
  userId: string;
  userTag: string;
}
```

### 4.4 실행 명령어

```bash
pnpm --filter @aido/api test:e2e                 # 전체 E2E 테스트
pnpm --filter @aido/api test:e2e -- auth.e2e-spec  # 특정 파일
pnpm --filter @aido/api test:e2e -- -t "회원가입"   # 특정 테스트
```

**상세 가이드**: [e2e-test.md](./e2e-test.md)

---

## 5. 공유 인프라

### 5.1 인프라 목록

| 파일 | 용도 | 사용처 |
|------|------|--------|
| `test/setup/suppress-logger.ts` | `suppressLogger()` - Logger 출력 억제 | 모든 Integration 테스트 |
| `test/mocks/mock-database.factory.ts` | `createMockDatabaseService()` - DB Mock 팩토리 | Mock DB Integration 테스트 |
| `test/e2e/helpers/e2e-app-factory.ts` | `createE2eApp()` / `destroyE2eApp()` | 모든 E2E 테스트 |
| `test/e2e/helpers/e2e-helpers.ts` | `E2eHelpers` 클래스 | 모든 E2E 테스트 |
| `test/integration/helpers/auth-test-module.factory.ts` | `createAuthTestModule()` | Auth 실제 DB Integration 테스트 |
| `test/builders/` | 15+ Builder 클래스 | Unit + Integration 테스트 |
| `test/mocks/fake-email.service.ts` | `FakeEmailService` | E2E + Integration 테스트 |
| `test/mocks/fake-oauth-token-verifier.service.ts` | `FakeOAuthTokenVerifierService` | E2E + OAuth Integration 테스트 |
| `test/setup/test-database.ts` | `TestDatabase` (Testcontainers) | 실제 DB Integration + E2E 테스트 |

### 5.2 Builder vs Fixture 사용 기준

| 구분 | Builder (`test/builders/`) | Fixture (`test/fixtures/`) |
|------|---------------------------|---------------------------|
| **목적** | 단일 엔티티를 메서드 체이닝으로 생성 | 연관 엔티티 묶음(User + Profile + Account)을 한 번에 생성 |
| **사용처** | Unit 테스트, Integration 테스트 | Integration (실제 DB), E2E 테스트 |
| **ID 방식** | `resetIdCounter()`로 수동 리셋 | 카운터 자동 증가, `resetAllFixtures()`로 일괄 리셋 |
| **상태 표현** | `.verified()`, `.deleted()` 등 도메인 메서드 | `Partial<T>` override |
| **관계 데이터** | `buildWithRelations()`으로 선택적 포함 | `createWithProfile()` 등 복합 팩토리 기본 제공 |

**선택 기준:**
- **단일 엔티티 mock 반환값** → Builder: `UserBuilder.create().verified().build()`
- **DB에 실제 삽입할 복합 데이터** → Fixture: `UserFixture.createFull()`
- **도메인 상태가 중요한 테스트** → Builder: `.locked()`, `.expired()`, `.asPremium()` 체이닝
- **관계 데이터가 필요하지만 상태가 단순한 경우** → Fixture: `UserFixture.createWithProfile()`

### 5.3 Builder 목록

| Builder | 모델 | 주요 메서드 |
|---------|------|------------|
| `UserBuilder` | User | `.withEmail()`, `.verified()`, `.asAdmin()` |
| `AccountBuilder` | Account | `.withProvider()`, `.withUserId()` |
| `SessionBuilder` | Session | `.withUserId()`, `.revoked()` |
| `VerificationBuilder` | Verification | `.expired()`, `.used()`, `.withAttempts()` |
| `LoginAttemptBuilder` | LoginAttempt | `.asSuccess()`, `.asFailed()` |
| `SecurityLogBuilder` | SecurityLog | `.withEvent()`, `.withMetadata()` |
| `UserConsentBuilder` | UserConsent | `.withType()`, `.asAgreed()` |
| `TodoBuilder` | Todo | `.withTitle()`, `.completed()` |
| `NotificationBuilder` | Notification | `.asFollowNew()`, `.asUnread()` |
| `CheerBuilder` | Cheer | `.withMessage()`, `.buildWithRelations()` |
| 기타 | Follow, Nudge, PushToken, TodoCategory, UserPreference | 각 도메인별 빌더 |

---

## 6. 공통 규칙

### 6.1 DO 체크리스트

- ✅ Unit: `TestBed.solitary()` 패턴 사용 (`@suites/unit`)
- ✅ Integration (Mock DB): `createMockDatabaseService()` 사용
- ✅ Integration (실제 DB): `TestDatabase` + 모듈 팩토리 사용
- ✅ E2E: `createE2eApp()` / `destroyE2eApp()` 팩토리 사용
- ✅ E2E 헬퍼: `E2eHelpers` 클래스의 `createVerifiedUser()` 등 사용
- ✅ Logger 억제: `suppressLogger()` 사용 (Integration 테스트)
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ Given/When/Then 주석으로 테스트 의도 표현
- ✅ 한국어 describe명 + 유형 태그 (예: `"CheerService 통합 테스트 (Mock DB)"`)
- ✅ 모든 테스트 파일 상단에 JSDoc (`@description`, 실행 명령)
- ✅ `beforeEach`에서 `jest.clearAllMocks()` 호출
- ✅ `beforeEach`에서 Builder ID 카운터 리셋
- ✅ FakeService로 외부 서비스 대체 (E2E)

### 6.2 DON'T 체크리스트

- ❌ Unit 테스트에서 실제 DB 연결
- ❌ Integration 테스트에서 HTTP 요청
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID 사용 (Builder 사용)
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)
- ❌ 로컬 `createVerifiedUser()` 함수 정의 (E2eHelpers 사용)
- ❌ 직접 `Logger.prototype` spy (suppressLogger() 사용)
- ❌ 수동 `$transaction` mock 구현 (createMockDatabaseService() 사용)

### 6.3 테스트 실행 명령어 요약

```bash
# Unit 테스트
pnpm --filter @aido/api test                    # 전체
pnpm --filter @aido/api test {파일명}            # 특정 파일
pnpm --filter @aido/api test:watch              # Watch 모드
pnpm --filter @aido/api test:cov                # 커버리지

# Integration 테스트
pnpm --filter @aido/api test:integration        # 전체
pnpm --filter @aido/api test {파일명}            # 특정 파일

# E2E 테스트
pnpm --filter @aido/api test:e2e                # 전체
pnpm --filter @aido/api test:e2e -- {파일명}     # 특정 파일
pnpm --filter @aido/api test:e2e -- -t "패턴"   # 특정 테스트
```

---

## 7. 참고 자료

### 7.1 예제 파일 경로

| 유형 | 예제 파일 |
|------|----------|
| Unit (Suites) | `src/modules/notification/notification.service.spec.ts` |
| Integration (Mock DB) | `test/integration/cheer.integration-spec.ts` |
| Integration (실제 DB) | `test/integration/auth-password-setup.integration-spec.ts` |
| E2E | `test/e2e/todo.e2e-spec.ts` |
| Builder | `test/builders/user.builder.ts` |
| FakeService | `test/mocks/fake-email.service.ts` |
| DB Mock 팩토리 | `test/mocks/mock-database.factory.ts` |
| E2E 앱 팩토리 | `test/e2e/helpers/e2e-app-factory.ts` |

### 7.2 관련 문서

| 문서 | 내용 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | API 앱 진입점 |
| [unit-test.md](./unit-test.md) | 단위 테스트 상세 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 상세 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 상세 가이드 |
| [prisma.md](./prisma.md) | Prisma 7 가이드 |
| [api-conventions.md](./api-conventions.md) | API 코드 규칙 |
| [architecture.md](./architecture.md) | 전체 아키텍처 |

### 7.3 외부 참조

- [NestJS Suites 공식 문서](https://docs.nestjs.com/recipes/suites)
- [Prisma Testing 가이드](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing)
- [Testcontainers Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)

---

**문서 버전**: 2.0.0
**최종 수정일**: 2026-02-14
