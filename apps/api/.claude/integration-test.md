# 통합 테스트 가이드

> Service + Repository + Mock DB 연동을 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 |
| [prisma.md](./prisma.md) | Prisma 7 가이드 |

---

## 개요

| 항목 | 설명 |
|------|------|
| **정의** | Service + Repository + Mock DB 연동 검증 |
| **도구** | NestJS TestingModule + Mock DatabaseService |
| **목적** | NestJS DI와 서비스 계층 통합 검증 |

---

## 파일 구조

```
test/
├── integration/
│   └── {name}.integration-spec.ts    # 통합 테스트
├── builders/                          # 테스트 데이터 빌더
│   ├── index.ts
│   ├── user.builder.ts
│   ├── cheer.builder.ts
│   └── ...
└── setup/
    ├── test-database.ts               # TestDatabase 헬퍼 (E2E용)
    ├── test-database.service.ts       # TestDatabaseService
    └── suites.setup.ts                # Suites 유틸리티
```

**명명 규칙**: `{도메인}.integration-spec.ts`

---

## 테스트 구조 패턴

### 기본 구조

```typescript
/**
 * CheerService 통합 테스트
 *
 * @description
 * CheerService가 CheerRepository, FollowService, PaginationService와 함께
 * 올바르게 작동하는지 검증합니다.
 */
import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { CheerRepository } from "@/modules/cheer/cheer.repository";
import { CheerService } from "@/modules/cheer/cheer.service";
import { CheerBuilder, UserBuilder } from "@test/builders";

describe("CheerService Integration Tests", () => {
  let module: TestingModule;
  let service: CheerService;
  let repository: CheerRepository;

  // Mock 데이터베이스 서비스
  const mockCheerDb = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockUserDb = {
    findUnique: jest.fn(),
  };

  const mockDatabaseService = {
    cheer: mockCheerDb,
    user: mockUserDb,
    $transaction: jest.fn(),
  };

  // $transaction mock 구현
  mockDatabaseService.$transaction.mockImplementation(
    (callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockDatabaseService),
  );

  // 테스트 데이터
  const mockSenderId = "user-sender-123";
  const mockReceiverId = "user-receiver-456";

  beforeAll(async () => {
    // Logger 출력 비활성화
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    jest.spyOn(Logger.prototype, "debug").mockImplementation();

    module = await Test.createTestingModule({
      providers: [
        CheerService,
        CheerRepository,
        PaginationService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        // 다른 의존성들...
      ],
    }).compile();

    service = module.get<CheerService>(CheerService);
    repository = module.get<CheerRepository>(CheerRepository);
  });

  afterAll(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    CheerBuilder.resetIdCounter();
  });

  // 테스트 케이스들...
});
```

---

## Mock DatabaseService 패턴

### 기본 Mock 구조

```typescript
// 각 테이블별 Mock 객체 생성
const mockCheerDb = {
  create: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockUserDb = {
  findUnique: jest.fn(),
};

const mockDatabaseService = {
  cheer: mockCheerDb,
  user: mockUserDb,
  $transaction: jest.fn(),
};
```

### $transaction Mock

```typescript
// 트랜잭션 내부에서 같은 mock을 사용하도록 설정
mockDatabaseService.$transaction.mockImplementation(
  (callback: (tx: unknown) => Promise<unknown>) =>
    callback(mockDatabaseService),
);
```

---

## Builder 패턴 활용

### 기본 사용

```typescript
import { CheerBuilder, UserBuilder } from "@test/builders";

// 사용자 생성
const mockSender = UserBuilder.create()
  .withId(mockSenderId)
  .verified()
  .build();

const mockReceiver = UserBuilder.create()
  .withId(mockReceiverId)
  .verified()
  .build();

// 응원 생성 (관계 포함)
const mockCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
  .withId(1)
  .withMessage("축하해요!")
  .withSenderInfo({
    id: mockSenderId,
    userTag: "SENDER12",
    profile: { name: "Sender User", profileImage: null },
  })
  .withReceiverInfo({
    id: mockReceiverId,
    userTag: "RECEIVER",
    profile: { name: "Receiver User", profileImage: null },
  })
  .buildWithRelations();
```

### ID 카운터 리셋

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  CheerBuilder.resetIdCounter();
  UserBuilder.resetIdCounter();  // 필요한 경우
});
```

---

## GWT 형식 테스트 케이스

### 정상 케이스

```typescript
it("친구에게 응원을 전송해야 함", async () => {
  // Given - 친구 관계의 두 사용자 준비
  const mockSender = UserBuilder.create()
    .withId(mockSenderId)
    .verified()
    .build();
  const mockReceiver = UserBuilder.create()
    .withId(mockReceiverId)
    .verified()
    .build();
  const mockCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
    .withId(1)
    .withMessage("축하해요!")
    .buildWithRelations();

  mockFollowService.isMutualFriend.mockResolvedValue(true);
  mockUserDb.findUnique
    .mockResolvedValueOnce({ ...mockSender, profile: { name: "Sender" } })
    .mockResolvedValueOnce({ ...mockReceiver, profile: { name: "Receiver" } });
  mockCheerDb.count.mockResolvedValue(0);
  mockCheerDb.findFirst.mockResolvedValue(null);
  mockCheerDb.create.mockResolvedValue(mockCheer);

  // When - 응원 전송
  const result = await service.sendCheer({
    senderId: mockSenderId,
    receiverId: mockReceiverId,
    message: "축하해요!",
  });

  // Then - 응원이 성공적으로 전송되어야 함
  expect(result.id).toBe(1);
  expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
    mockSenderId,
    mockReceiverId,
  );
  expect(mockEventEmitter.emit).toHaveBeenCalledWith(
    "cheer.sent",
    expect.any(Object),
  );
});
```

### 예외 케이스

```typescript
it("친구가 아니면 예외를 발생시켜야 함", async () => {
  // Given - 친구가 아닌 상태로 설정
  mockFollowService.isMutualFriend.mockResolvedValue(false);

  // When & Then - 친구가 아니면 예외 발생
  await expect(
    service.sendCheer({
      senderId: mockSenderId,
      receiverId: mockReceiverId,
    }),
  ).rejects.toThrow(BusinessException);
});
```

---

## 테스트 케이스 그룹화

### DI 통합 테스트

```typescript
describe("DI 통합 테스트", () => {
  it("CheerService가 정상적으로 주입되어야 함", () => {
    // Given - NestJS 테스트 모듈 설정 완료

    // When - 서비스 인스턴스 확인

    // Then - 서비스가 정의되어 있어야 함
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CheerService);
  });

  it("CheerRepository가 정상적으로 주입되어야 함", () => {
    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(CheerRepository);
  });
});
```

### 도메인별 테스트

```typescript
describe("응원 전송 통합 테스트", () => {
  it("친구에게 응원을 전송해야 함", async () => { ... });
  it("메시지 없이도 응원을 전송해야 함", async () => { ... });
  it("자기 자신에게 전송하면 예외를 발생시켜야 함", async () => { ... });
  it("일일 제한 초과시 예외를 발생시켜야 함", async () => { ... });
});

describe("받은 응원 목록 조회 통합 테스트", () => {
  it("받은 응원 목록을 조회해야 함", async () => { ... });
  it("sender.userTag가 포함되어야 함", async () => { ... });
});
```

---

## FK 제약조건 처리

통합 테스트에서 FK 관계가 있는 데이터를 설정할 때:

```typescript
it("응원 목록에 sender 정보가 포함되어야 함", async () => {
  // Given - sender/receiver 관계가 포함된 응원 데이터 준비
  const mockCheers = [
    CheerBuilder.create(mockSenderId, mockReceiverId)
      .withId(1)
      .withSenderInfo({
        id: mockSenderId,
        userTag: "SENDER12",
        profile: { name: "Sender User", profileImage: null },
      })
      .withReceiverInfo({
        id: mockReceiverId,
        userTag: "RECEIVER",
        profile: { name: "Receiver User", profileImage: null },
      })
      .buildWithRelations(),  // 관계 포함 빌드
  ];
  mockCheerDb.findMany.mockResolvedValue(mockCheers);
  mockCheerDb.count.mockResolvedValue(1);

  // When - 받은 응원 목록 조회
  const result = await service.getReceivedCheers({
    userId: mockReceiverId,
  });

  // Then - sender.userTag가 포함되어야 함
  expect(result.items[0]?.sender.userTag).toBe("SENDER12");
});
```

---

## 외부 서비스 Mock

### EventEmitter Mock

```typescript
const mockEventEmitter = {
  emit: jest.fn(),
};

// 모듈에 주입
{
  provide: EventEmitter2,
  useValue: mockEventEmitter,
}

// 검증
expect(mockEventEmitter.emit).toHaveBeenCalledWith(
  "cheer.sent",
  expect.any(Object),
);
```

### 다른 서비스 Mock

```typescript
const mockFollowService = {
  isMutualFriend: jest.fn(),
};

// 모듈에 주입
{
  provide: FollowService,
  useValue: mockFollowService,
}
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

- ✅ `beforeAll`에서 TestingModule 생성 (성능)
- ✅ `beforeEach`에서 `jest.clearAllMocks()` 호출
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ GWT 주석으로 테스트 의도 표현
- ✅ Logger 출력 비활성화 (노이즈 제거)
- ✅ 서비스 계층 통합 검증에 집중

### DON'T

- ❌ 실제 DB 연결 (E2E 테스트에서 담당)
- ❌ HTTP 요청 테스트 (E2E 테스트에서 담당)
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID 사용 (Builder 사용)
- ❌ 외부 서비스 직접 호출 (Mock 사용)
