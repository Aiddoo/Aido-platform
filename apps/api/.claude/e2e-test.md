# E2E 테스트 가이드

> `createE2eApp()` 팩토리 + `E2eHelpers`로 전체 API 흐름을 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 가이드 |

---

## 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | `test/e2e/` |
| **명명 규칙** | `{도메인}.e2e-spec.ts` |
| **핵심 도구** | `createE2eApp()` + `E2eHelpers` + `supertest` |
| **환경** | Testcontainers PostgreSQL + FakeService |
| **목적** | 사용자 관점에서 HTTP API 전체 흐름 검증 |

---

## 핵심 라이브러리 및 헬퍼

| 도구 | import 경로 | 역할 |
|------|------------|------|
| `createE2eApp()` | `./helpers` | E2E 앱 초기화 팩토리 |
| `destroyE2eApp()` | `./helpers` | E2E 앱 정리 |
| `E2eHelpers` | `./helpers` | 사용자 생성, 로그인, 친구 관계 등 |
| `E2eTestContext` | `./helpers` | 앱, DB, FakeService 컨텍스트 |
| `VerifiedUser` | `./helpers` | 인증된 사용자 타입 |
| `supertest` | `supertest` | HTTP 요청 라이브러리 |

---

## 파일 구조

```
test/
├── e2e/
│   ├── helpers/
│   │   ├── e2e-app-factory.ts       # createE2eApp / destroyE2eApp
│   │   ├── e2e-helpers.ts           # E2eHelpers 클래스
│   │   └── index.ts                 # re-export
│   ├── auth.e2e-spec.ts
│   ├── todo.e2e-spec.ts
│   ├── follow.e2e-spec.ts
│   └── ...
├── mocks/
│   ├── fake-email.service.ts
│   ├── fake-oauth-token-verifier.service.ts
│   └── fake-logger.service.ts
└── setup/
    ├── test-database.ts             # TestDatabase (Testcontainers)
    └── global-setup.ts
```

---

## 앱 팩토리 패턴

### `createE2eApp()` / `destroyE2eApp()`

모든 E2E 테스트는 이 팩토리를 사용합니다. 내부에서 자동으로 처리하는 것:
- `TestDatabase` (Testcontainers PostgreSQL) 시작
- `FakeEmailService` / `FakeOAuthTokenVerifierService` 주입
- `PinoLogger` → `FakeLogger` 교체
- `ZodValidationPipe` 설정
- `E2eHelpers` 인스턴스 생성

```typescript
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers";

describe("Todo E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.testDatabase.cleanup();
    ctx.fakeEmailService.clear();
  });

  describe("Todo 생성", () => {
    it("새 Todo를 생성해야 한다", async () => {
      // Given - 매 테스트마다 데이터를 새로 생성
      const user = await ctx.helpers.createVerifiedUser("todo@test.com", "Test1234!");
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

      // When - Todo 생성 요청
      const response = await request(ctx.app.getHttpServer())
        .post("/todos")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ title: "E2E Test", categoryId })
        .expect(201);

      // Then - 성공 검증
      expect(response.body.success).toBe(true);
    });
  });
});
```

### 데이터 격리 전략 (Per-Test Isolation)

모든 E2E 테스트는 **매 테스트마다 clean state**에서 시작합니다.

- `beforeEach`에서 `ctx.testDatabase.cleanup()` + `ctx.fakeEmailService.clear()` **필수 호출**
- 각 `it` 블록이 필요한 유저/데이터를 **자체적으로 생성** (shared state 없음)
- 순차 의존성이 있는 테스트(CRUD 플로우 등)는 **하나의 `it` 블록으로 합침**
- `describe` 스코프의 `let` 변수로 상태 공유 금지 (`ctx` 제외)

```typescript
// ✅ 올바른 패턴: 매 테스트가 독립적
it("Todo CRUD 전체 플로우", async () => {
  // Given
  const user = await ctx.helpers.createVerifiedUser("crud@test.com", "Test1234!");
  const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

  // When - 생성
  const createRes = await request(ctx.app.getHttpServer())
    .post("/todos").set("Authorization", `Bearer ${user.accessToken}`)
    .send({ title: "테스트", categoryId }).expect(201);
  const todoId = createRes.body.data.todo.id;

  // When - 수정
  await request(ctx.app.getHttpServer())
    .patch(`/todos/${todoId}`).set("Authorization", `Bearer ${user.accessToken}`)
    .send({ title: "수정됨" }).expect(200);

  // When - 삭제
  await request(ctx.app.getHttpServer())
    .delete(`/todos/${todoId}`).set("Authorization", `Bearer ${user.accessToken}`)
    .expect(200);
});

// ❌ 잘못된 패턴: 테스트 간 상태 공유
let createdTodoId: number; // describe 스코프 공유 변수
it("생성", async () => { createdTodoId = ...; }); // 테스트1에서 생성
it("수정", async () => { /* createdTodoId 사용 */ }); // 테스트2에서 의존
```

### E2eTestContext 타입

```typescript
interface E2eTestContext {
  app: INestApplication;
  module: TestingModule;
  testDatabase: TestDatabase;
  fakeEmailService: FakeEmailService;
  fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;
  helpers: E2eHelpers;
}
```

### 추가 Provider Override

일부 E2E 테스트에서 추가 Provider를 override해야 할 때:

```typescript
const ctx = await createE2eApp({
  customizeBuilder: (builder) =>
    builder
      .overrideProvider(SomeService)
      .useValue(mockSomeService),
});
```

---

## E2eHelpers API

### `createVerifiedUser(email, password, options?)` → `VerifiedUser`

회원가입 + 이메일 인증 + 토큰 반환을 한 번에 처리합니다.

```typescript
interface VerifiedUser {
  accessToken: string;
  userId: string;
  userTag: string;
}

// 기본 사용
const user = await ctx.helpers.createVerifiedUser("test@example.com", "Test1234!");

// 이름 지정
const user = await ctx.helpers.createVerifiedUser("test@example.com", "Test1234!", { name: "테스트유저" });
```

### `registerUser(email, password, options?)` → `void`

회원가입만 수행합니다 (이메일 인증 전 단계).

```typescript
await ctx.helpers.registerUser("test@example.com", "Test1234!", { name: "테스트유저" });
```

### `verifyUser(email)` → `string` (accessToken)

이메일 인증을 수행하고 accessToken을 반환합니다.

```typescript
const accessToken = await ctx.helpers.verifyUser("test@example.com");
```

### `loginUser(email, password)` → `{ accessToken, refreshToken }`

```typescript
const tokens = await ctx.helpers.loginUser("test@example.com", "Test1234!");
```

### `createFriendship(user1, user2)` → `void`

양방향 팔로우로 친구 관계를 생성합니다.

```typescript
const user1 = await ctx.helpers.createVerifiedUser("a@test.com", "Test1234!");
const user2 = await ctx.helpers.createVerifiedUser("b@test.com", "Test1234!");
await ctx.helpers.createFriendship(user1, user2);
```

### `getDefaultCategoryId(accessToken)` → `number`

사용자의 기본 카테고리 ID를 조회합니다.

```typescript
const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
```

---

## GWT 형식 E2E 테스트

### 기본 형식

```typescript
it("POST /auth/register - 새 사용자 등록", async () => {
  // Given - 새 이메일 주소

  // When - 회원가입 API 호출
  const response = await request(ctx.app.getHttpServer())
    .post("/auth/register")
    .send({
      email: "test@example.com",
      password: "Test1234!",
      passwordConfirm: "Test1234!",
      termsAgreed: true,
      privacyAgreed: true,
    })
    .expect(201);

  // Then - 응답 검증
  expect(response.body.success).toBe(true);
  expect(response.body.data.email).toBe("test@example.com");
  expect(ctx.fakeEmailService.hasSentTo("test@example.com")).toBe(true);
});
```

### 인증 필요한 API 테스트

```typescript
it("Todo를 생성해야 한다", async () => {
  // Given - 인증된 사용자 + 기본 카테고리
  const user = await ctx.helpers.createVerifiedUser("todo@test.com", "Test1234!");
  const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

  // When - Todo 생성 요청
  const response = await request(ctx.app.getHttpServer())
    .post("/todos")
    .set("Authorization", `Bearer ${user.accessToken}`)
    .send({ title: "E2E Test Todo", categoryId })
    .expect(201);

  // Then - 응답 검증
  expect(response.body.success).toBe(true);
  expect(response.body.data.title).toBe("E2E Test Todo");
});
```

### 친구 관계가 필요한 테스트

```typescript
it("친구에게 응원을 보내야 한다", async () => {
  // Given - 두 사용자 + 친구 관계
  const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
  const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
  await ctx.helpers.createFriendship(sender, receiver);

  // When - 응원 전송
  const response = await request(ctx.app.getHttpServer())
    .post(`/cheers/${receiver.userId}`)
    .set("Authorization", `Bearer ${sender.accessToken}`)
    .send({ message: "화이팅!" })
    .expect(201);

  // Then - 성공 검증
  expect(response.body.success).toBe(true);
});
```

---

## FakeService 패턴

### FakeEmailService

```typescript
// 인증 코드 조회
const code = ctx.fakeEmailService.getLastCode("test@example.com");

// 이메일 발송 여부 확인
expect(ctx.fakeEmailService.hasSentTo("test@example.com")).toBe(true);

// 테스트 간 초기화
ctx.fakeEmailService.clear();
```

### FakeOAuthTokenVerifierService

```typescript
// 소셜 프로필 설정
ctx.fakeOAuthTokenVerifierService.setCustomProfile("google", "test-token", {
  id: "google-123",
  email: "oauth@example.com",
  emailVerified: true,
  name: "Test User",
});

// 인증 실패 시뮬레이션
ctx.fakeOAuthTokenVerifierService.simulateFailure();

// 초기화
ctx.fakeOAuthTokenVerifierService.clear();
```

---

## 응답 검증 패턴

### 표준 응답 구조

모든 응답은 `ResponseTransformInterceptor`에 의해 래핑됩니다:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-14T10:30:00.000Z"
}
```

### 에러 응답 구조

```json
{
  "success": false,
  "error": {
    "code": "AUTH_0101",
    "message": "이미 등록된 이메일입니다."
  },
  "timestamp": "2026-02-14T10:30:00.000Z"
}
```

---

## 실행 명령어

```bash
# 전체 E2E 테스트
pnpm --filter @aido/api test:e2e

# 특정 파일
pnpm --filter @aido/api test:e2e -- auth.e2e-spec

# 특정 테스트
pnpm --filter @aido/api test:e2e -- -t "회원가입"
```

---

## 환경 변수

| 변수 | 설명 | 비고 |
|------|------|------|
| `DATABASE_URL` | Testcontainers가 자동 설정 | 로컬에선 불필요 |
| `JWT_SECRET` | JWT 서명 키 | CI에서 필요 |
| `JWT_REFRESH_SECRET` | Refresh 토큰 키 (32자 이상) | CI에서 필요 |
| `TOKEN_ENCRYPTION_KEY` | 암호화 키 (32자 이상) | CI에서 필요 |

---

## DO / DON'T

### DO

- ✅ `createE2eApp()` / `destroyE2eApp()` 팩토리 사용
- ✅ `E2eHelpers`의 `createVerifiedUser()` 등 공유 헬퍼 사용
- ✅ **`beforeEach`에서 `ctx.testDatabase.cleanup()` + `ctx.fakeEmailService.clear()` 필수 호출**
- ✅ 각 `it` 블록에서 필요한 데이터를 자체적으로 생성 (per-test isolation)
- ✅ 순차 의존 테스트(CRUD 등)는 하나의 `it` 블록으로 합침
- ✅ GWT 주석으로 테스트 의도 표현
- ✅ `supertest`로 HTTP 요청
- ✅ 응답 구조 (`success`, `data`, `error.code`) 검증
- ✅ 상태 코드 검증 (200, 201, 400, 401, 404, 409 등)
- ✅ `beforeAll` 60초 타임아웃 설정 (Testcontainers 시작 대기)

### DON'T

- ❌ 로컬 `createVerifiedUser()` / `loginUser()` 함수 정의 → `ctx.helpers` 사용
- ❌ 직접 `TestDatabase` 초기화 → `createE2eApp()` 사용
- ❌ 직접 `Test.createTestingModule()` 호출 → 팩토리 사용
- ❌ `overrideProvider()` 직접 호출 → `customizeBuilder` 옵션 사용
- ❌ Service/Repository 직접 호출 (HTTP 요청으로 테스트)
- ❌ 테스트 간 데이터 의존성
- ❌ 외부 API 직접 호출 (FakeService 사용)
- ❌ `describe` 스코프 `let` 변수로 테스트 간 상태 공유 (`ctx` 제외)
- ❌ nested `beforeAll`에서 공유 데이터 생성 (각 `it`에서 직접 생성)

---

**문서 버전**: 4.0.0
**최종 수정일**: 2026-04-05
