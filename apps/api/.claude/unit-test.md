# 단위 테스트 가이드

> 개별 클래스/메서드의 독립적인 동작을 Mock으로 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 가이드 |
| [api-conventions.md](./api-conventions.md) | API 코드 규칙 |

---

## 개요

| 항목 | 설명 |
|------|------|
| **정의** | 개별 클래스/메서드의 독립적인 동작 검증 |
| **외부 의존성** | 모두 Mock 처리 (DB, 외부 API 등) |
| **실행 속도** | 빠름 (실제 DB 연결 없음) |
| **테스트 도구** | Jest + Suites + Builder 패턴 |

---

## 파일 구조

```
src/
├── modules/
│   └── {name}/
│       ├── {name}.service.ts
│       └── {name}.service.spec.ts    # 테스트 대상과 같은 폴더
├── app.controller.ts
└── app.controller.spec.ts

test/
├── builders/                          # 테스트 데이터 빌더
│   ├── index.ts
│   ├── user.builder.ts
│   ├── notification.builder.ts
│   └── ...
└── setup/
    └── suites.setup.ts                # Suites 유틸리티
```

**명명 규칙**: `{파일명}.spec.ts`

---

## Suites 패턴 (권장)

NestJS 공식 권장 [Suites 라이브러리](https://docs.nestjs.com/recipes/suites)를 사용한 테스트 설정입니다.

### 기본 사용법

```typescript
// Suites 라이브러리 (자동 mock 생성)
import { TestBed } from "@suites/unit";
import type { Mocked } from "@suites/doubles.jest";

// 테스트 대상 서비스 (프로젝트 내부)
import { AuthService } from "@/modules/auth/services/auth.service";
import { UserRepository } from "@/modules/auth/repositories/user.repository";

describe("AuthService", () => {
  let service: AuthService;
  let userRepo: Mocked<UserRepository>;

  beforeEach(async () => {
    // Suites가 모든 의존성을 자동으로 mock
    const { unit, unitRef } = await TestBed.solitary(AuthService).compile();

    service = unit;
    userRepo = unitRef.get(UserRepository);
  });

  it("사용자를 조회해야 한다", async () => {
    // Given - Mock 반환값 설정
    userRepo.findById.mockResolvedValue({ id: "1", email: "test@example.com" });

    // When - 테스트 대상 메서드 호출
    const result = await service.findById("1");

    // Then - 결과 검증
    expect(result.email).toBe("test@example.com");
  });
});
```

### 수동 Mock 주입 (Provider override)

특정 Provider를 직접 mock해야 할 경우:

```typescript
beforeEach(async () => {
  const mockPushProvider = {
    name: "expo",
    validateToken: jest.fn().mockReturnValue(true),
    send: jest.fn(),
    sendBatch: jest.fn().mockResolvedValue({
      total: 1,
      successCount: 1,
      failureCount: 0,
      results: [{ success: true, ticketId: "ticket-1" }],
      invalidTokens: [],
    }),
  };

  const { unit, unitRef } = await TestBed.solitary(NotificationService)
    .mock(PUSH_PROVIDER)
    .impl(() => mockPushProvider)
    .compile();

  service = unit;
  pushProvider = mockPushProvider as unknown as Mocked<PushProvider>;
});
```

---

## Builder 패턴

[Prisma 공식 권장](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing) Builder 패턴으로 테스트 데이터를 생성합니다.

### 사용법

```typescript
import { UserBuilder, NotificationBuilder } from "@test/builders";

// 기본 사용자
const user = UserBuilder.create().build();

// 커스텀 사용자
const admin = UserBuilder.create()
  .withEmail("admin@example.com")
  .asAdmin()
  .verified()
  .build();

// 알림 데이터
const notification = NotificationBuilder.create("user-1")
  .asFollowNew("friend-1")
  .asUnread()
  .build();
```

### Builder 작성 규칙

```typescript
export class UserBuilder {
  private data: User;

  private constructor() {
    const now = new Date();
    this.data = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      email: `test-${Date.now()}@example.com`,
      userTag: this.generateUserTag(),
      role: "USER" as UserRole,
      status: "PENDING_VERIFY" as UserStatus,
      // ... 기본값 설정
    };
  }

  static create(): UserBuilder {
    return new UserBuilder();
  }

  // 메서드 체이닝
  withId(id: string): UserBuilder {
    this.data.id = id;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.data.email = email;
    return this;
  }

  asAdmin(): UserBuilder {
    this.data.role = "ADMIN";
    return this;
  }

  verified(): UserBuilder {
    this.data.status = "ACTIVE";
    this.data.emailVerifiedAt = new Date();
    return this;
  }

  build(): User {
    return { ...this.data };
  }

  static createMany(count: number): User[] {
    return Array.from({ length: count }, () => UserBuilder.create().build());
  }
}
```

### ID 카운터 리셋

테스트 간 ID 충돌을 방지하려면 `beforeEach`에서 리셋:

```typescript
beforeEach(() => {
  NotificationBuilder.resetIdCounter();
  PushTokenBuilder.resetIdCounter();
});
```

---

## GWT 주석 형식

**Given/When/Then** 패턴으로 테스트 의도를 명확히 표현합니다.

### 형식

```typescript
it("유효한 토큰을 등록해야 한다", async () => {
  // Given - 유효한 Expo 푸시 토큰 데이터 준비
  const data = {
    userId: mockUserId,
    token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    deviceId: "device-1",
    platform: "IOS" as const,
  };
  const expectedToken = PushTokenBuilder.create(mockUserId)
    .withToken(data.token)
    .withDeviceId(data.deviceId)
    .asIos()
    .build();
  notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

  // When - 푸시 토큰 등록 요청
  const result = await service.registerPushToken(data);

  // Then - 토큰 검증 및 저장 확인
  expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
  expect(notificationRepo.registerPushToken).toHaveBeenCalledWith(data);
  expect(result).toEqual(expectedToken);
});
```

### 예외 케이스

```typescript
it("유효하지 않은 토큰이면 예외를 던져야 한다", async () => {
  // Given - 유효하지 않은 토큰 형식
  const data = {
    userId: mockUserId,
    token: "invalid-token",
    deviceId: "device-1",
  };
  pushProvider.validateToken.mockReturnValue(false);

  // When & Then - 유효성 검사 실패로 예외 발생
  await expect(service.registerPushToken(data)).rejects.toThrow(
    BusinessException,
  );
  expect(notificationRepo.registerPushToken).not.toHaveBeenCalled();
});
```

---

## 테스트 구조

```typescript
describe("클래스명", () => {
  // 테스트 대상 클래스

  describe("메서드명", () => {
    // 테스트 대상 메서드

    it("조건일 때 동작해야 한다", () => {
      // 개별 테스트 케이스
    });
  });
});
```

### 전체 예제

```typescript
/**
 * NotificationService 단위 테스트 (Suites + Builder + GWT 패턴)
 */
import { TestBed } from "@suites/unit";
import type { Mocked } from "@suites/doubles.jest";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { NotificationBuilder, PushTokenBuilder } from "@test/builders";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { PUSH_PROVIDER } from "./providers";
import type { PushProvider } from "./providers/push-provider.interface";

describe("NotificationService", () => {
  let service: NotificationService;
  let notificationRepo: Mocked<NotificationRepository>;
  let pushProvider: Mocked<PushProvider>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    // Builder ID 카운터 리셋
    NotificationBuilder.resetIdCounter();
    PushTokenBuilder.resetIdCounter();

    // PushProvider mock 객체 생성
    const mockPushProviderImpl = {
      name: "expo",
      validateToken: jest.fn().mockReturnValue(true),
      send: jest.fn(),
      sendBatch: jest.fn().mockResolvedValue({
        total: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ success: true, ticketId: "ticket-1" }],
        invalidTokens: [],
      }),
    };

    const { unit, unitRef } = await TestBed.solitary(NotificationService)
      .mock(PUSH_PROVIDER)
      .impl(() => mockPushProviderImpl)
      .compile();

    service = unit;
    notificationRepo = unitRef.get(NotificationRepository);
    pushProvider = mockPushProviderImpl as unknown as Mocked<PushProvider>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // 푸시 토큰 관리 테스트
  // ==========================================================================

  describe("registerPushToken", () => {
    it("유효한 토큰을 등록해야 한다", async () => {
      // Given - 유효한 Expo 푸시 토큰 데이터 준비
      const data = { userId: mockUserId, token: "ExponentPushToken[xxx]", deviceId: "device-1" };
      const expectedToken = PushTokenBuilder.create(mockUserId).withToken(data.token).build();
      notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

      // When - 푸시 토큰 등록 요청
      const result = await service.registerPushToken(data);

      // Then - 토큰 검증 및 저장 확인
      expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
      expect(result).toEqual(expectedToken);
    });

    it("유효하지 않은 토큰이면 예외를 던져야 한다", async () => {
      // Given - 유효하지 않은 토큰
      pushProvider.validateToken.mockReturnValue(false);

      // When & Then - 예외 발생
      await expect(service.registerPushToken({ userId: mockUserId, token: "invalid" }))
        .rejects.toThrow(BusinessException);
    });
  });
});
```

---

## Mock 설정 헬퍼

### 기본 Mock 객체

```typescript
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
```

### Mock 반환값 설정

```typescript
// 단일 값 반환
mockRepository.findById.mockResolvedValue({ id: "1", title: "Test" });

// 에러 발생
mockRepository.findById.mockRejectedValue(new Error("DB Error"));

// 여러 번 호출 시 다른 값 반환
mockRepository.findById
  .mockResolvedValueOnce({ id: "1" })
  .mockResolvedValueOnce(null);
```

### 호출 검증

```typescript
// 호출 여부
expect(mockRepository.findById).toHaveBeenCalled();

// 특정 인자로 호출
expect(mockRepository.findById).toHaveBeenCalledWith("1");

// 호출 횟수
expect(mockRepository.findById).toHaveBeenCalledTimes(1);

// 객체 일부만 검증
expect(mockRepository.create).toHaveBeenCalledWith(
  expect.objectContaining({ title: "Test" })
);
```

---

## 테스트 케이스 분류

### 섹션 구분자

```typescript
// ==========================================================================
// 푸시 토큰 관리 테스트
// ==========================================================================

describe("registerPushToken", () => { ... });

// ==========================================================================
// 알림 생성 및 발송 테스트
// ==========================================================================

describe("createAndSend", () => { ... });
```

### 테스트 케이스 유형

| 유형 | 설명 | 예시 |
|------|------|------|
| 정상 케이스 | 성공적인 동작 | "유효한 토큰을 등록해야 한다" |
| 예외 케이스 | 에러 발생 상황 | "토큰이 없으면 예외를 던져야 한다" |
| 경계값 테스트 | 극단적인 입력값 | "빈 목록이면 아무 작업도 하지 않아야 한다" |
| 간접 테스트 | private 메서드 테스트 | "sendPushToUser (간접 테스트)" |

---

## 실행 명령어

```bash
# 전체 단위 테스트
pnpm --filter @aido/api test

# 특정 파일
pnpm --filter @aido/api test notification.service.spec

# Watch 모드 (파일 변경 시 자동 실행)
pnpm --filter @aido/api test:watch

# 커버리지 리포트
pnpm --filter @aido/api test:cov
```

---

## DO / DON'T

### DO

- ✅ Suites `TestBed.solitary()` 패턴 사용
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ Given/When/Then 주석으로 의도 표현
- ✅ 각 테스트 케이스는 독립적으로 실행 가능
- ✅ Edge case와 에러 케이스 테스트 포함
- ✅ `beforeEach`에서 Builder ID 카운터 리셋

### DON'T

- ❌ 실제 DB 연결 (통합 테스트에서 담당)
- ❌ 테스트 간 상태 공유
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)
- ❌ 테스트에서 비즈니스 로직 재구현
- ❌ 하드코딩된 ID 사용 (Builder 사용)
