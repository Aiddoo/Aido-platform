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
import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { [Feature]Builder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";
import { [Feature]Repository } from "@/modules/{name}/{name}.repository";
import { [Feature]Service } from "@/modules/{name}/{name}.service";
import { [Feature]QueueService } from "@/modules/{name}/queue/{name}-queue.service";

describe("[Feature]Service 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let service: [Feature]Service;

  // Mock DB 팩토리로 생성 — $transaction 자동 설정됨
  const mockDb = createMockDatabaseService({
    [model]: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  });

  const mockQueueService = { enqueueXxx: jest.fn() };

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        [Feature]Service,
        [Feature]Repository,
        { provide: DatabaseService, useValue: mockDb },
        { provide: [Feature]QueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get<[Feature]Service>([Feature]Service);
  });

  afterAll(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    [Feature]Builder.resetIdCounter();
  });

  describe("DI 통합 테스트", () => {
    it("[Feature]Service가 정상적으로 주입되어야 함", () => {
      // Given — DI 컨테이너 구성 완료

      // When & Then
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf([Feature]Service);
    });
  });

  describe("생성", () => {
    it("정상적으로 생성해야 함", async () => {
      // Given - DB Mock 설정
      const mock = [Feature]Builder.create().build();
      mockDb.[model].create.mockResolvedValue(mock);

      // When
      const result = await service.create({ ... });

      // Then - 성공 검증 + 큐 enqueue 호출 확인
      expect(result.id).toBeDefined();
      expect(mockQueueService.enqueueXxx).toHaveBeenCalledWith(
        expect.objectContaining({ [feature]Id: mock.id }),
      );
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
import { suppressLogger } from "@test/setup/suppress-logger";
import { DatabaseService } from "@/database/database.service";
import { {Feature}Service } from "@/modules/{feature}/services/{feature}.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("{Feature} 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let service: {Feature}Service;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;
  const fakeEmailService = new FakeEmailService();

  beforeAll(async () => {
    suppressLogger();
    testDb = new TestDatabase();
    databaseService = (await testDb.start()) as DatabaseService;
    module = await createAuthTestModule(databaseService, fakeEmailService);
    service = module.get<{Feature}Service>({Feature}Service);
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
      {Feature}Service, TokenService,
      {Feature}Repository, {Related}Repository,
      // ... 필요한 Repository들
      { provide: DatabaseService, useValue: databaseService },
      { provide: CacheService, useValue: { invalidateSession: async () => {}, ... } },
      { provide: CACHE_SERVICE, useValue: { get: async () => undefined, set: async () => {}, del: async () => {} } },
      { provide: EncryptionService, useValue: { encrypt: (v) => v, decryptSafe: (v) => v } },
      { provide: [Feature]QueueService, useValue: { enqueueXxx: jest.fn() } },
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
describe("{Feature}Service 통합 테스트 (Mock DB)", () => { ... });

// 실제 DB 통합 테스트
describe("{Feature} 통합 테스트 (실제 DB)", () => { ... });
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
- ✅ Builder 패턴으로 mock 반환값 생성
- ✅ GWT 주석으로 테스트 의도 표현
- ✅ 한국어 describe명 + 유형 태그 `(Mock DB)` / `(실제 DB)`
- ✅ `afterAll`에서 `module.close()` 호출

### DON'T

- ❌ 직접 `$transaction` mock 구현 → `createMockDatabaseService()` 사용
- ❌ 직접 `Logger.prototype` spy → `suppressLogger()` 사용
- ❌ HTTP 요청 테스트 (E2E에서 담당)
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID (Builder 사용)
- ❌ 영어 describe명 (한국어 통일)

---

**문서 버전**: 4.0.0
**최종 수정일**: 2026-04-05
