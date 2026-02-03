# E2E 테스트 가이드

> 실제 HTTP 요청으로 전체 API 흐름을 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [testing-guide.md](./testing-guide.md) | 종합 테스팅 가이드 |
| [unit-test.md](./unit-test.md) | 단위 테스트 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 가이드 |
| [api-conventions.md](./api-conventions.md) | API 코드 규칙 |

---

## 개요

| 항목 | 설명 |
|------|------|
| **정의** | 실제 HTTP 요청으로 전체 API 흐름 검증 |
| **도구** | supertest + Testcontainers (PostgreSQL) |
| **환경** | 격리된 Docker PostgreSQL 컨테이너 |
| **목적** | 사용자 관점에서 API 동작 검증 |

---

## 파일 구조

```
test/
├── e2e/
│   └── {name}.e2e-spec.ts       # E2E 테스트
├── mocks/
│   ├── fake-email.service.ts     # FakeEmailService
│   └── fake-oauth-token-verifier.service.ts
├── builders/                      # 테스트 데이터 빌더
│   ├── index.ts
│   └── ...
└── setup/
    ├── test-database.ts           # TestDatabase 헬퍼
    ├── test-database.service.ts   # TestDatabaseService
    ├── global-setup.ts            # Jest global setup
    └── global-teardown.ts         # Jest global teardown
```

**명명 규칙**: `{도메인}.e2e-spec.ts`

---

## 앱 초기화 패턴

### 기본 구조

```typescript
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";

describe("Auth (e2e)", () => {
  let app: INestApplication<App>;
  let testDatabase: TestDatabase;
  let fakeEmailService: FakeEmailService;

  beforeAll(async () => {
    // Testcontainers로 PostgreSQL 컨테이너 시작
    testDatabase = new TestDatabase();
    await testDatabase.start();

    // FakeEmailService 인스턴스 생성
    fakeEmailService = new FakeEmailService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(testDatabase.getPrisma())
      .overrideProvider(EmailService)
      .useValue(fakeEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await testDatabase.stop();
  });

  // 테스트 케이스들...
});
```

---

## 헬퍼 함수 패턴

E2E 테스트에서 자주 사용되는 작업을 헬퍼 함수로 추출합니다.

### 사용자 등록 헬퍼

```typescript
/**
 * 테스트용 사용자 등록 헬퍼
 */
async function registerUser(
  email: string,
  password: string,
  options?: { name?: string },
): Promise<void> {
  await request(app.getHttpServer())
    .post("/auth/register")
    .send({
      email,
      password,
      passwordConfirm: password,
      name: options?.name,
      termsAgreed: true,
      privacyAgreed: true,
    })
    .expect(201);
}
```

### 이메일 인증 헬퍼

```typescript
/**
 * 테스트용 이메일 인증 헬퍼
 */
async function verifyUser(email: string): Promise<string> {
  const code = fakeEmailService.getLastCode(email);
  const response = await request(app.getHttpServer())
    .post("/auth/verify-email")
    .send({ email, code })
    .expect(200);

  return response.body.data.accessToken;
}
```

### 인증된 사용자 생성 헬퍼

```typescript
/**
 * 테스트용 사용자 등록 및 인증 헬퍼
 */
async function createVerifiedUser(
  email: string,
  password: string,
  options?: { name?: string },
): Promise<string> {
  await registerUser(email, password, options);
  return verifyUser(email);
}
```

### 로그인 헬퍼

```typescript
/**
 * 테스트용 로그인 헬퍼
 */
async function loginUser(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password })
    .expect(200);

  return {
    accessToken: response.body.data.accessToken,
    refreshToken: response.body.data.refreshToken,
  };
}
```

---

## FakeService 패턴

외부 서비스를 테스트용 Fake 구현체로 대체합니다.

### FakeEmailService 예시

```typescript
// test/mocks/fake-email.service.ts
export class FakeEmailService {
  private sentEmails: Map<string, { code: string; type: string }> = new Map();

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    this.sentEmails.set(email, { code, type: "verification" });
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    this.sentEmails.set(email, { code, type: "password-reset" });
  }

  getLastCode(email: string): string | undefined {
    return this.sentEmails.get(email)?.code;
  }

  hasSentTo(email: string): boolean {
    return this.sentEmails.has(email);
  }

  clear(): void {
    this.sentEmails.clear();
  }
}
```

### 모듈에서 FakeService 사용

```typescript
const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(DatabaseService)
  .useValue(testDatabase.getPrisma())
  .overrideProvider(EmailService)
  .useValue(fakeEmailService)
  .overrideProvider(OAuthTokenVerifierService)
  .useValue(fakeOAuthTokenVerifierService)
  .compile();
```

---

## GWT 형식 E2E 테스트

### 기본 형식

```typescript
describe("회원가입 플로우", () => {
  const testEmail = "test@example.com";
  const testPassword = "Test1234!";

  it("POST /auth/register - 새 사용자 등록", async () => {
    // Given - 새 이메일 주소 준비

    // When - 회원가입 API 호출
    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      })
      .expect(201);

    // Then - 응답 검증
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testEmail);
    expect(response.body.data.message).toContain("인증 코드");
    expect(fakeEmailService.hasSentTo(testEmail)).toBe(true);
  });

  it("POST /auth/register - 중복 이메일 거부", async () => {
    // Given - 이미 등록된 이메일

    // When - 동일 이메일로 회원가입 시도
    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        termsAgreed: true,
        privacyAgreed: true,
      })
      .expect(409);

    // Then - 응답 검증
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("EMAIL_0501");
  });
});
```

---

## HTTP 요청 패턴

### GET 요청

```typescript
// 목록 조회
await request(app.getHttpServer())
  .get("/todos")
  .set("Authorization", `Bearer ${accessToken}`)
  .expect(200);

// 상세 조회
await request(app.getHttpServer())
  .get(`/todos/${todoId}`)
  .set("Authorization", `Bearer ${accessToken}`)
  .expect(200);

// 쿼리 파라미터
await request(app.getHttpServer())
  .get("/todos?page=1&size=20")
  .set("Authorization", `Bearer ${accessToken}`)
  .expect(200);
```

### POST 요청

```typescript
await request(app.getHttpServer())
  .post("/todos")
  .set("Authorization", `Bearer ${accessToken}`)
  .send({
    title: "New Todo",
    content: "Content here",
  })
  .expect(201);
```

### PATCH 요청

```typescript
await request(app.getHttpServer())
  .patch(`/todos/${todoId}`)
  .set("Authorization", `Bearer ${accessToken}`)
  .send({
    title: "Updated Title",
    completed: true,
  })
  .expect(200);
```

### DELETE 요청

```typescript
await request(app.getHttpServer())
  .delete(`/todos/${todoId}`)
  .set("Authorization", `Bearer ${accessToken}`)
  .expect(200);
```

---

## 응답 검증 패턴

### 표준 응답 구조

모든 응답은 `ResponseTransformInterceptor`에 의해 래핑됩니다.

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 성공 응답 검증

```typescript
it("새로운 Todo를 생성해야 한다", async () => {
  // Given - 인증된 사용자
  const accessToken = await createVerifiedUser("user@test.com", "Test1234!");

  // When - Todo 생성 요청
  const response = await request(app.getHttpServer())
    .post("/todos")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title: "E2E Test Todo" })
    .expect(201);

  // Then - 응답 구조 검증
  expect(response.body.success).toBe(true);
  expect(response.body.timestamp).toBeDefined();
  expect(response.body.data).toMatchObject({
    title: "E2E Test Todo",
    completed: false,
  });
  expect(response.body.data.id).toBeDefined();
  expect(response.body.data.createdAt).toBeDefined();
});
```

### 에러 응답 검증

```typescript
it("존재하지 않는 ID로 조회 시 404를 반환해야 한다", async () => {
  // Given - 인증된 사용자
  const accessToken = await createVerifiedUser("user@test.com", "Test1234!");

  // When - 존재하지 않는 Todo 조회
  const response = await request(app.getHttpServer())
    .get("/todos/non-existent-id")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(404);

  // Then - 에러 응답 검증
  expect(response.body.success).toBe(false);
});

it("유효하지 않은 입력 시 400을 반환해야 한다", async () => {
  // Given - 인증된 사용자
  const accessToken = await createVerifiedUser("user@test.com", "Test1234!");

  // When - 빈 제목으로 Todo 생성 시도
  const response = await request(app.getHttpServer())
    .post("/todos")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title: "" })
    .expect(400);

  // Then - 에러 응답 검증
  expect(response.body.success).toBe(false);
});
```

---

## 상태 코드별 테스트

| 상태 코드 | 상황 | HTTP 메서드 |
|-----------|------|-------------|
| `200` | 조회/수정/삭제 성공 | GET, PATCH, DELETE |
| `201` | 생성 성공 | POST |
| `400` | 입력 검증 실패 | 모든 메서드 |
| `401` | 인증 필요 | 모든 메서드 |
| `403` | 권한 없음 | 모든 메서드 |
| `404` | 리소스 없음 | GET, PATCH, DELETE |
| `409` | 중복 (Conflict) | POST |

---

## 전체 CRUD 플로우 테스트

```typescript
describe("전체 CRUD 플로우", () => {
  it("CRUD 전체 사이클을 완료해야 한다", async () => {
    // Given - 인증된 사용자
    const accessToken = await createVerifiedUser("crud@test.com", "Test1234!");

    // 1. 생성 (Create)
    const createResponse = await request(app.getHttpServer())
      .post("/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "CRUD 플로우 Todo", content: "초기 내용" })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    const todoId = createResponse.body.data.id;

    // 2. 조회 (Read)
    const readResponse = await request(app.getHttpServer())
      .get(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(readResponse.body.data.title).toBe("CRUD 플로우 Todo");

    // 3. 수정 (Update)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "수정된 제목", completed: true })
      .expect(200);

    expect(updateResponse.body.data.title).toBe("수정된 제목");
    expect(updateResponse.body.data.completed).toBe(true);

    // 4. 삭제 (Delete)
    await request(app.getHttpServer())
      .delete(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // 5. 삭제 확인
    await request(app.getHttpServer())
      .get(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
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
| `DATABASE_URL` | Testcontainers가 자동 설정 | 로컬 테스트 시 |
| `JWT_SECRET` | JWT 서명 키 | CI에서 필요 |
| `JWT_REFRESH_SECRET` | Refresh 토큰 키 (32자 이상) | CI에서 필요 |

### CI 환경 설정

`turbo.json`의 `passThroughEnv`로 환경변수 전달:

```json
{
  "test:e2e": {
    "dependsOn": ["build"],
    "passThroughEnv": ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"]
  }
}
```

---

## DO / DON'T

### DO

- ✅ 실제 HTTP 요청으로 전체 흐름 테스트
- ✅ 헬퍼 함수로 반복 작업 추출 (`createVerifiedUser` 등)
- ✅ FakeService로 외부 서비스 대체
- ✅ GWT 주석으로 테스트 의도 표현
- ✅ 응답 구조 (`success`, `data`, `timestamp`) 검증
- ✅ 상태 코드 검증 (200, 201, 400, 404 등)
- ✅ CRUD 전체 사이클 테스트

### DON'T

- ❌ Service/Repository 직접 호출 (통합 테스트에서 담당)
- ❌ Mock 사용 (FakeService 제외, 실제 DB 연결이 목적)
- ❌ 테스트 간 데이터 의존성
- ❌ 하드코딩된 ID 사용
- ❌ 외부 API 직접 호출 (FakeService 사용)
