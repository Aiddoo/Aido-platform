# E2E 테스트 작성 가이드

## 정의 및 범위

- **E2E 테스트**: 실제 HTTP 요청으로 전체 API 흐름 검증
- **도구**: supertest 라이브러리
- **환경**: Testcontainers로 격리된 PostgreSQL 사용
- **목적**: 사용자 관점에서 API 동작 검증

---

## 파일 위치

```
test/
├── e2e/
│   └── todo.e2e-spec.ts         ← E2E 테스트
└── setup/
    └── test-database.ts         ← TestDatabase 헬퍼
```

**명명 규칙**: `{도메인}.e2e-spec.ts`

---

## 앱 초기화 패턴

```typescript
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { TestDatabase } from "../setup/test-database";

describe("TodoController (e2e)", () => {
  let app: INestApplication;
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    // 1. Testcontainers로 DB 시작
    testDatabase = new TestDatabase();
    await testDatabase.start();

    // 2. FK 제약조건을 위한 테스트 사용자 생성
    const prisma = testDatabase.getPrisma();
    await prisma.user.create({
      data: {
        id: TEMP_USER_ID,
        email: "test@example.com",
      },
    });

    // 3. NestJS 앱 생성 (DatabaseService 오버라이드)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(testDatabase.getPrisma())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await testDatabase.stop();
  });

  // 테스트 케이스들...
});
```

---

## HTTP 요청 패턴

### 기본 구조

```typescript
const response = await request(app.getHttpServer())
  .post("/todos")
  .send({ title: "Test Todo" })
  .expect(201);
```

### GET 요청

```typescript
// 목록 조회
await request(app.getHttpServer())
  .get("/todos")
  .expect(200);

// 상세 조회
await request(app.getHttpServer())
  .get(`/todos/${todoId}`)
  .expect(200);

// 쿼리 파라미터
await request(app.getHttpServer())
  .get("/todos?page=1&size=20")
  .expect(200);
```

### POST 요청

```typescript
await request(app.getHttpServer())
  .post("/todos")
  .send({
    title: "New Todo",
    content: "Content here",
  })
  .expect(201);
```

### PUT 요청

```typescript
await request(app.getHttpServer())
  .put(`/todos/${todoId}`)
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
  .expect(200);
```

---

## 응답 검증 패턴

### 표준 응답 구조

모든 응답은 `ResponseTransformInterceptor`에 의해 래핑됨:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 성공 응답 검증

```typescript
it("should create a new todo", async () => {
  const response = await request(app.getHttpServer())
    .post("/todos")
    .send({ title: "E2E Test Todo" })
    .expect(201);

  // 응답 구조 검증
  expect(response.body.success).toBe(true);
  expect(response.body.timestamp).toBeDefined();

  // 데이터 검증
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
it("should return 404 for non-existent id", async () => {
  const response = await request(app.getHttpServer())
    .get("/todos/non-existent-id")
    .expect(404);

  expect(response.body.success).toBe(false);
});

it("should return 400 for invalid input", async () => {
  const response = await request(app.getHttpServer())
    .post("/todos")
    .send({ title: "" })  // 빈 title
    .expect(400);

  expect(response.body.success).toBe(false);
});
```

---

## 상태 코드별 테스트

| 상태 코드 | 상황 | 예시 |
|-----------|------|------|
| `200` | 조회/수정/삭제 성공 | GET, PUT, DELETE |
| `201` | 생성 성공 | POST |
| `400` | 입력 검증 실패 | 빈 title, 길이 초과 |
| `404` | 리소스 없음 | 존재하지 않는 ID |

### 입력 검증 테스트 (400)

```typescript
describe("POST /todos validation", () => {
  it("should return 400 for empty title", async () => {
    await request(app.getHttpServer())
      .post("/todos")
      .send({ title: "" })
      .expect(400);
  });

  it("should return 400 for missing title", async () => {
    await request(app.getHttpServer())
      .post("/todos")
      .send({ content: "Content without title" })
      .expect(400);
  });

  it("should return 400 for title exceeding max length", async () => {
    await request(app.getHttpServer())
      .post("/todos")
      .send({ title: "a".repeat(201) })  // 200자 초과
      .expect(400);
  });
});
```

---

## 페이지네이션 테스트

### 오프셋 기반

```typescript
it("should return paginated todos", async () => {
  const response = await request(app.getHttpServer())
    .get("/todos?page=1&size=20")
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toHaveProperty("items");
  expect(response.body.data).toHaveProperty("pagination");
  expect(Array.isArray(response.body.data.items)).toBe(true);
});
```

### 커서 기반

```typescript
it("should return cursor paginated todos", async () => {
  const response = await request(app.getHttpServer())
    .get("/todos/cursor?size=20")
    .expect(200);

  expect(response.body.data).toHaveProperty("items");
  expect(response.body.data).toHaveProperty("nextCursor");
});
```

---

## 전체 CRUD 플로우 테스트

```typescript
describe("Full CRUD Flow", () => {
  it("should complete full CRUD cycle", async () => {
    // 1. Create
    const createResponse = await request(app.getHttpServer())
      .post("/todos")
      .send({ title: "CRUD Flow Todo", content: "Initial content" })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    const todoId = createResponse.body.data.id;

    // 2. Read
    const readResponse = await request(app.getHttpServer())
      .get(`/todos/${todoId}`)
      .expect(200);

    expect(readResponse.body.data.title).toBe("CRUD Flow Todo");

    // 3. Update
    const updateResponse = await request(app.getHttpServer())
      .put(`/todos/${todoId}`)
      .send({ title: "Updated Title", completed: true })
      .expect(200);

    expect(updateResponse.body.data.title).toBe("Updated Title");
    expect(updateResponse.body.data.completed).toBe(true);

    // 4. Delete
    await request(app.getHttpServer())
      .delete(`/todos/${todoId}`)
      .expect(200);

    // 5. Verify deletion
    await request(app.getHttpServer())
      .get(`/todos/${todoId}`)
      .expect(404);
  });
});
```

---

## 테스트 데이터 정리

각 테스트 후 생성한 데이터 삭제:

```typescript
it("should create a todo", async () => {
  const response = await request(app.getHttpServer())
    .post("/todos")
    .send({ title: "Test Todo" })
    .expect(201);

  const createdId = response.body.data.id;

  // ... 테스트 검증 ...

  // 정리
  await request(app.getHttpServer())
    .delete(`/todos/${createdId}`);
});
```

---

## 실행 명령어

```bash
# 전체 E2E 테스트 실행
pnpm --filter @aido/api test:e2e

# 특정 파일 실행
pnpm --filter @aido/api test:e2e -- todo.e2e-spec

# 특정 테스트만 실행
pnpm --filter @aido/api test:e2e -- -t "CRUD"
```

---

## 환경변수

| 변수 | 설명 | 비고 |
|------|------|------|
| `DATABASE_URL` | Testcontainers가 자동 설정 | 로컬 테스트 시 |
| `JWT_SECRET` | JWT 서명 키 | CI에서 필요 |
| `JWT_REFRESH_SECRET` | Refresh 토큰 키 (32자 이상) | CI에서 필요 |

### CI 환경

`turbo.json`의 `passThroughEnv` 설정으로 환경변수 전달:

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
- 실제 HTTP 요청으로 전체 흐름 테스트
- 응답 구조 (`success`, `data`, `timestamp`) 검증
- 상태 코드 검증 (200, 201, 400, 404)
- 각 테스트 후 생성한 데이터 정리
- CRUD 전체 사이클 테스트

### DON'T
- Service/Repository 직접 호출 (통합 테스트에서 담당)
- Mock 사용 (실제 DB 연결이 목적)
- 테스트 간 데이터 의존성
- 하드코딩된 ID 사용
