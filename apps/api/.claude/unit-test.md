# 단위 테스트 가이드

> `@suites/unit` + Builder 패턴으로 개별 클래스/메서드를 격리 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 가이드 |

---

## 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | 테스트 대상과 같은 폴더 (`src/modules/{name}/`) |
| **명명 규칙** | `{파일명}.spec.ts` |
| **핵심 도구** | `@suites/unit` (TestBed.solitary) + `@suites/doubles.jest` (Mocked) |
| **데이터 생성** | Builder 패턴 (`@test/builders`) |
| **실행 속도** | 빠름 (DB 연결 없음, 모든 의존성 자동 Mock) |

---

## 핵심 라이브러리

| 패키지 | 역할 | import |
|--------|------|--------|
| `@suites/unit` | 자동 Mock DI 컨테이너 | `import { TestBed } from "@suites/unit"` |
| `@suites/doubles.jest` | Mock 타입 유틸리티 | `import type { Mocked } from "@suites/doubles.jest"` |

---

## Suites 패턴

### 기본 사용법

모든 단위 테스트는 `TestBed.solitary()`를 사용합니다. Suites가 생성자 의존성을 자동으로 Mock합니다.

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

  it("사용자를 조회해야 한다", async () => {
    // Given
    userRepo.findById.mockResolvedValue({ id: "1", email: "test@example.com" });

    // When
    const result = await service.findById("1");

    // Then
    expect(result.email).toBe("test@example.com");
  });
});
```

### Provider Override

토큰 기반 주입이나 특수한 Mock이 필요한 경우:

```typescript
beforeEach(async () => {
  const mockPushProvider = {
    name: "expo",
    validateToken: jest.fn().mockReturnValue(true),
    sendBatch: jest.fn().mockResolvedValue({ total: 1, successCount: 1 }),
  };

  const { unit, unitRef } = await TestBed.solitary(NotificationService)
    .mock(PUSH_PROVIDER)
    .impl(() => mockPushProvider)
    .compile();

  service = unit;
  pushProvider = mockPushProvider as unknown as Mocked<PushProvider>;
});
```

### 예외: Suites 미사용

순수 함수/상수 테스트는 DI가 불필요하므로 Suites 없이 직접 테스트합니다:
- `cache-keys.spec.ts` - 캐시 키 생성 함수
- `date.util.spec.ts` - 날짜 유틸리티
- `notification-templates.spec.ts` - 알림 템플릿 상수
- `in-memory-cache.adapter.spec.ts` - 캐시 어댑터

외부 SDK의 **모듈 레벨 mock**(`jest.mock()`)이 필요한 경우에도 `Test.createTestingModule()`을 사용합니다:
- `gemini.provider.spec.ts` - AI SDK(`ai` 패키지)를 `jest.mock("ai")`로 모킹. Suites는 모듈 레벨 mock을 지원하지 않으므로 이 방식이 정당함

---

## Builder 패턴

[Prisma 공식 권장](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing) Builder 패턴으로 테스트 데이터를 생성합니다.

### 사용법

```typescript
import { UserBuilder, VerificationBuilder, LoginAttemptBuilder } from "@test/builders";

// 기본 사용자
const user = UserBuilder.create().build();

// 커스텀 사용자
const admin = UserBuilder.create()
  .withEmail("admin@example.com")
  .asAdmin()
  .verified()
  .build();

// 만료된 인증
const expired = VerificationBuilder.create("user-123", "PASSWORD_RESET").expired().build();

// 실패한 로그인 시도
const attempt = LoginAttemptBuilder.create("test@example.com").asFailed().build();
```

### `buildWithRelations()` — 관계 데이터 포함 빌드

`build()`는 단일 엔티티를, `buildWithRelations()`는 관계 객체(sender, receiver 등)가 포함된 데이터를 반환합니다.
Service에서 join/include 결과를 기대하는 메서드를 테스트할 때 사용합니다:

```typescript
// 관계 없는 기본 빌드
const cheer = CheerBuilder.create(senderId, receiverId).build();

// 관계 포함 빌드 — sender/receiver 프로필 등 포함
const cheerWithRelations = CheerBuilder.create(senderId, receiverId)
  .withMessage("잘했어!")
  .withSenderProfile({ name: "테스트유저", profileImage: null })
  .buildWithRelations();

// 목록 mock에서 여러 Builder 조합
mockRepo.findMany.mockResolvedValue([
  CheerBuilder.create("sender-1", userId).withId(1).buildWithRelations(),
  CheerBuilder.create("sender-2", userId).withId(2).buildWithRelations(),
]);
```

> **현재 `buildWithRelations()` 지원 Builder**: `CheerBuilder`, `NudgeBuilder`, `NotificationBuilder`

### ID 카운터 리셋

일부 Builder는 자동 증가 ID를 사용합니다. `beforeEach`에서 리셋:

```typescript
beforeEach(() => {
  NotificationBuilder.resetIdCounter();
  VerificationBuilder.resetIdCounter();
});
```

### 사용 가능한 Builder 목록

`test/builders/index.ts`에서 전체 목록 확인. 주요 Builder:

| Builder | 주요 체이닝 메서드 |
|---------|-------------------|
| `UserBuilder` | `.withEmail()`, `.verified()`, `.asAdmin()`, `.withTag()` |
| `AccountBuilder` | `.withProvider()`, `.withUserId()` |
| `SessionBuilder` | `.withUserId()`, `.revoked()`, `.expired()` |
| `VerificationBuilder` | `.expired()`, `.used()`, `.withAttempts()`, `.withToken()` |
| `LoginAttemptBuilder` | `.asSuccess()`, `.asFailed()`, `.withIp()` |
| `SecurityLogBuilder` | `.withEvent()`, `.withMetadata()`, `.withIp()` |
| `UserConsentBuilder` | `.withType()`, `.asAgreed()` |
| `TodoBuilder` | `.withTitle()`, `.completed()`, `.withCategory()` |
| `NotificationBuilder` | `.asFollowNew()`, `.asCheerReceived()`, `.asUnread()` |

---

## GWT 주석 형식

모든 `it` 블록에 **Given/When/Then** 주석을 작성합니다.

### 정상 케이스

```typescript
it("유효한 토큰을 등록해야 한다", async () => {
  // Given - 유효한 Expo 푸시 토큰 데이터 준비
  const data = { userId: mockUserId, token: "ExponentPushToken[xxx]" };
  const expectedToken = PushTokenBuilder.create(mockUserId).build();
  notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

  // When - 푸시 토큰 등록 요청
  const result = await service.registerPushToken(data);

  // Then - 토큰 검증 및 저장 확인
  expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
  expect(result).toEqual(expectedToken);
});
```

### 예외 케이스

```typescript
it("유효하지 않은 토큰이면 예외를 던져야 한다", async () => {
  // Given - 유효하지 않은 토큰
  pushProvider.validateToken.mockReturnValue(false);

  // When & Then - 예외 발생
  await expect(service.registerPushToken({ userId: mockUserId, token: "invalid" }))
    .rejects.toThrow(BusinessException);
  expect(notificationRepo.registerPushToken).not.toHaveBeenCalled();
});
```

---

## 테스트 구조

```typescript
describe("클래스명", () => {
  // 변수 선언 + beforeEach (Suites 설정)

  // ========================================
  // 섹션 구분자
  // ========================================

  describe("메서드명", () => {
    it("조건일 때 동작해야 한다", () => {
      // Given / When / Then
    });
  });
});
```

---

## 실행 명령어

```bash
pnpm --filter @aido/api test                     # 전체 단위 테스트
pnpm --filter @aido/api test notification.service.spec  # 특정 파일
pnpm --filter @aido/api test:watch               # Watch 모드
pnpm --filter @aido/api test:cov                 # 커버리지
```

---

## DO / DON'T

### DO

- ✅ `TestBed.solitary()` 패턴 사용 (`@suites/unit`)
- ✅ Builder 패턴으로 테스트 데이터 생성 (`@test/builders`)
- ✅ Given/When/Then 주석으로 의도 표현
- ✅ 각 테스트 케이스는 독립적으로 실행 가능
- ✅ Edge case와 에러 케이스 테스트 포함
- ✅ `beforeEach`에서 Builder ID 카운터 리셋
- ✅ 한국어 describe/it 설명

### DON'T

- ❌ 실제 DB 연결 (Integration 테스트에서 담당)
- ❌ `Test.createTestingModule()` 직접 사용 (Suites 사용)
- ❌ 테스트 간 상태 공유 (`beforeAll` 대신 `beforeEach`)
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)
- ❌ 하드코딩된 ID (Builder 사용)
- ❌ 수동 Mock 객체 생성 (Suites 자동 Mock)

---

**문서 버전**: 2.0.0
**최종 수정일**: 2026-02-14
