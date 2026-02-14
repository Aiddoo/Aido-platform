# 통합 테스트 가이드

> Mock DB 또는 실제 DB로 Service + Repository DI 통합을 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 |

---

## 개요

통합 테스트는 두 가지 유형으로 나뉩니다:

| 유형 | DB | 도구 | 목적 | 예시 |
|------|-----|------|------|------|
| **Mock DB** | `createMockDatabaseService()` | NestJS `TestingModule` | Service → Repository DI 검증 | cheer, follow, nudge, todo 등 |
| **실제 DB** | Testcontainers PostgreSQL | `TestDatabase` + 모듈 팩토리 | 전체 DB 트랜잭션 검증 | auth, oauth, account-deletion |

### 파일 위치 및 명명

```
test/
├── integration/
│   ├── helpers/
│   │   └── auth-test-module.factory.ts   # Auth 실제 DB 모듈 팩토리
│   ├── cheer.integration-spec.ts         # Mock DB
│   ├── todo.integration-spec.ts          # Mock DB
│   ├── auth-password-setup.integration-spec.ts  # 실제 DB
│   ├── oauth.integration-spec.ts         # 실제 DB
│   └── ...
├── mocks/
│   └── mock-database.factory.ts          # createMockDatabaseService
└── setup/
    ├── suppress-logger.ts                # suppressLogger()
    └── test-database.ts                  # TestDatabase (Testcontainers)
```

---

## Mock DB 통합 테스트

### 핵심 도구

| 도구 | import | 역할 |
|------|--------|------|
| `createMockDatabaseService()` | `@test/mocks/mock-database.factory` | DB Mock + `$transaction` 자동 설정 |
| `suppressLogger()` | `@test/setup/suppress-logger` | Logger 출력 억제 |
| Builder | `@test/builders` | 테스트 데이터 생성 |

### 전체 템플릿

```typescript
/**
 * CheerService 통합 테스트 (Mock DB)
 *
 * @description
 * CheerService와 CheerRepository의 DI 통합을 검증합니다.
 * DB는 Mock으로 처리하며, 실제 DB 연동은 E2E에서 담당합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test cheer.integration-spec
 * ```
 */

import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { CheerBuilder, UserBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";
import { CheerRepository } from "@/modules/cheer/cheer.repository";
import { CheerService } from "@/modules/cheer/cheer.service";

describe("CheerService 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let service: CheerService;

  // Mock DB 팩토리로 생성 — $transaction 자동 설정됨
  const mockDb = createMockDatabaseService({
    cheer: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  });

  const mockEventEmitter = { emit: jest.fn() };

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        CheerService,
        CheerRepository,
        { provide: DatabaseService, useValue: mockDb },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CheerService>(CheerService);
  });

  afterAll(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    CheerBuilder.resetIdCounter();
  });

  describe("DI 통합 테스트", () => {
    it("CheerService가 정상적으로 주입되어야 함", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CheerService);
    });
  });

  describe("응원 전송", () => {
    it("친구에게 응원을 전송해야 함", async () => {
      // Given - 친구 관계 사용자 + DB Mock 설정
      const mockCheer = CheerBuilder.create("sender-1", "receiver-1").buildWithRelations();
      mockDb.cheer.create.mockResolvedValue(mockCheer);

      // When - 응원 전송
      const result = await service.sendCheer({ senderId: "sender-1", receiverId: "receiver-1" });

      // Then - 성공 검증
      expect(result.id).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("cheer.sent", expect.any(Object));
    });
  });
});
```

### `createMockDatabaseService()` 사용법

```typescript
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";

// 필요한 모델만 전달 — $transaction은 자동 설정됨
const mockDb = createMockDatabaseService({
  todo: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
  todoCategory: { findUnique: jest.fn() },
});

// 사용: Service 내부의 $transaction이 정상 동작
// $transaction(callback) → callback(mockDb) 호출
```

### 단위 테스트에서의 `$transaction` mock (txProxy 패턴)

단위 테스트(@suites)에서는 `createMockDatabaseService()`를 사용하지 않습니다.
대신 `$transaction`의 callback에 **txProxy** 객체를 직접 전달합니다:

```typescript
// Given - 트랜잭션 내부에서 사용할 모델별 mock 설정
(database.$transaction as jest.Mock).mockImplementation(
  async (callback: (tx: unknown) => Promise<unknown>) => {
    const txProxy = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      cheer: {
        create: jest.fn().mockResolvedValue(mockCheer),
      },
    };
    return callback(txProxy);
  },
);
```

> **참고**: 통합 테스트에서는 `createMockDatabaseService()`가 `$transaction`을 자동 설정하므로 txProxy가 불필요합니다. txProxy 패턴은 단위 테스트에서만 사용합니다.

---

## 실제 DB 통합 테스트

### 핵심 도구

| 도구 | import | 역할 |
|------|--------|------|
| `TestDatabase` | `@test/setup/test-database` | Testcontainers PostgreSQL 관리 |
| `createAuthTestModule()` | `@test/integration/helpers/auth-test-module.factory` | Auth 관련 TestingModule 팩토리 |
| `suppressLogger()` | `@test/setup/suppress-logger` | Logger 출력 억제 |
| `FakeEmailService` | `@test/mocks/fake-email.service` | 이메일 발송 Mock |

### Auth 모듈 팩토리 사용 (password-setup, password-change, password-reset)

```typescript
/**
 * 비밀번호 설정 통합 테스트 (실제 DB)
 *
 * @description
 * 소셜 로그인 사용자의 비밀번호 최초 설정 플로우를 실제 DB로 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test auth-password-setup.integration-spec
 * ```
 */

import { suppressLogger } from "@test/setup/suppress-logger";
import { DatabaseService } from "@/database/database.service";
import { AuthService } from "@/modules/auth/services/auth.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("비밀번호 설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let authService: AuthService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;
  const fakeEmailService = new FakeEmailService();

  beforeAll(async () => {
    suppressLogger();
    testDb = new TestDatabase();
    databaseService = (await testDb.start()) as DatabaseService;
    module = await createAuthTestModule(databaseService, fakeEmailService);
    authService = module.get<AuthService>(AuthService);
  }, 60000);

  beforeEach(async () => {
    await testDb.cleanup();
    fakeEmailService.clear();
  });

  afterAll(async () => {
    if (testDb) await testDb.stop();
    if (module) await module.close();
  });

  // 테스트 케이스들...
});
```

### 독립 모듈 구성 (oauth, account-deletion)

Auth 팩토리에 포함되지 않는 서비스(OAuth, AccountPurge)는 자체 모듈을 구성합니다.
공통 패턴은 동일합니다:

```typescript
beforeAll(async () => {
  suppressLogger();
  testDb = new TestDatabase();
  databaseService = (await testDb.start()) as DatabaseService;

  module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: "...", signOptions: { expiresIn: "15m" } })],
    providers: [
      OAuthService, TokenService,
      AccountRepository, UserRepository, SessionRepository,
      // ... 필요한 Repository들
      { provide: DatabaseService, useValue: databaseService },
      { provide: CacheService, useValue: { invalidateSession: async () => {}, ... } },
      { provide: CACHE_SERVICE, useValue: { get: async () => undefined, set: async () => {}, del: async () => {} } },
      { provide: EncryptionService, useValue: { encrypt: (v) => v, decryptSafe: (v) => v } },
      { provide: EventEmitter2, useValue: { emit: () => true } },
      // ... ConfigService, TypedConfigService mocks
    ],
  }).compile();
}, 60000);
```

---

## 네이밍 규칙

### describe명 형식

```typescript
// Mock DB 통합 테스트
describe("CheerService 통합 테스트 (Mock DB)", () => { ... });
describe("TodoService 통합 테스트 (Mock DB)", () => { ... });

// 실제 DB 통합 테스트
describe("비밀번호 설정 통합 테스트 (실제 DB)", () => { ... });
describe("OAuth 통합 테스트 (실제 DB)", () => { ... });
```

### JSDoc 헤더

모든 통합 테스트 파일 상단에 작성:

```typescript
/**
 * TodoService 통합 테스트 (Mock DB)
 *
 * @description
 * TodoService와 TodoRepository의 DI 통합을 검증합니다.
 * DB는 Mock으로 처리합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo.integration-spec
 * ```
 */
```

---

## 실행 명령어

```bash
# 전체 통합 테스트
pnpm --filter @aido/api test:integration

# 특정 파일
pnpm --filter @aido/api test cheer.integration-spec

# 특정 describe 블록
pnpm --filter @aido/api test cheer.integration-spec -- -t "응원 전송"
```

---

## DO / DON'T

### DO

- ✅ Mock DB: `createMockDatabaseService()` 팩토리 사용
- ✅ 실제 DB Auth: `createAuthTestModule()` 팩토리 사용
- ✅ 모든 파일에서 `suppressLogger()` 호출
- ✅ `beforeAll`에서 TestingModule 생성 (성능)
- ✅ `beforeEach`에서 `jest.clearAllMocks()` 호출
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ GWT 주석으로 테스트 의도 표현
- ✅ 한국어 describe명 + 유형 태그 `(Mock DB)` / `(실제 DB)`
- ✅ 파일 상단 JSDoc 헤더 (description + 실행 명령)
- ✅ `afterAll`에서 `module.close()` 호출

### DON'T

- ❌ 직접 `$transaction` mock 구현 → `createMockDatabaseService()` 사용
- ❌ 직접 `Logger.prototype` spy → `suppressLogger()` 사용
- ❌ HTTP 요청 테스트 (E2E에서 담당)
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID (Builder 사용)
- ❌ 영어 describe명 (한국어 통일)

---

**문서 버전**: 2.0.0
**최종 수정일**: 2026-02-14
