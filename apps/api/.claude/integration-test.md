# 통합 테스트 작성 가이드

## 정의 및 범위

- **통합 테스트**: Service + Repository + 실제 DB 연동 검증
- **Testcontainers**: Docker로 격리된 PostgreSQL 컨테이너 사용
- **목적**: 프로덕션과 동일한 환경에서 데이터 흐름 검증

---

## 파일 위치

```
test/
├── integration/
│   └── todo.integration-spec.ts    ← 통합 테스트
└── setup/
    └── test-database.ts            ← TestDatabase 헬퍼
```

**명명 규칙**: `{도메인}.integration-spec.ts`

---

## TestDatabase 클래스

### 주요 메서드

```typescript
import { TestDatabase } from "../setup/test-database";

const testDb = new TestDatabase();

// 컨테이너 시작 + Prisma 마이그레이션
const prisma = await testDb.start();

// PrismaClient 인스턴스 반환
const prisma = testDb.getPrisma();

// 모든 테이블 데이터 삭제
await testDb.cleanup();

// 컨테이너 종료
await testDb.stop();
```

### 내부 동작

1. **start()**: PostgreSQL 16 컨테이너 시작 → Prisma 마이그레이션 실행 → PrismaClient 연결
2. **cleanup()**: `$transaction`으로 모든 테이블 데이터 삭제
3. **stop()**: Prisma 연결 해제 → 컨테이너 종료

---

## 테스트 라이프사이클

```typescript
describe("Todo Integration Tests", () => {
  let module: TestingModule;
  let service: TodoService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;
  let testUserId: string;

  // 테스트 스위트 시작 시 한 번만 실행
  beforeAll(async () => {
    testDb = new TestDatabase();
    databaseService = await testDb.start();

    module = await Test.createTestingModule({
      providers: [
        TodoService,
        TodoRepository,
        PaginationService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
  }, 60000); // 컨테이너 시작 타임아웃

  // 각 테스트 전 데이터 초기화
  beforeEach(async () => {
    await testDb.cleanup();

    // FK 제약조건을 위해 테스트 User 생성
    const testUser = await databaseService.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        status: "ACTIVE",
      },
    });
    testUserId = testUser.id;
  });

  // 테스트 스위트 종료 시 정리
  afterAll(async () => {
    await testDb.stop();
    await module.close();
  });

  // 테스트 케이스들...
});
```

---

## FK 제약조건 처리

Todo 생성 시 유효한 `userId`가 필요함:

```typescript
beforeEach(async () => {
  await testDb.cleanup();

  // 테스트용 User 먼저 생성
  const testUser = await databaseService.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      status: "ACTIVE",
    },
  });
  testUserId = testUser.id;
});

it("should create todo", async () => {
  const todo = await service.create(testUserId, { title: "Test" });
  expect(todo.userId).toBe(testUserId);
});
```

---

## CRUD 테스트 패턴

### 전체 라이프사이클 테스트

```typescript
it("should perform full CRUD lifecycle", async () => {
  // 1. Create
  const created = await service.create(testUserId, {
    title: "통합 테스트 할 일",
    content: "통합 테스트 내용",
  });
  expect(created.id).toBeDefined();
  expect(created.title).toBe("통합 테스트 할 일");

  // 2. Read
  const found = await service.findById(created.id);
  expect(found.id).toBe(created.id);

  // 3. Update
  const updated = await service.update(created.id, {
    title: "수정된 제목",
    completed: true,
  });
  expect(updated.title).toBe("수정된 제목");
  expect(updated.completed).toBe(true);

  // 4. Delete
  const deleted = await service.delete(created.id);
  expect(deleted.id).toBe(created.id);

  // 5. Verify deletion
  await expect(service.findById(created.id)).rejects.toThrow(NotFoundException);
});
```

### 다중 레코드 테스트

```typescript
it("should handle multiple todos correctly", async () => {
  // 여러 Todo 생성
  const todo1 = await service.create(testUserId, { title: "첫 번째" });
  const todo2 = await service.create(testUserId, { title: "두 번째" });
  const todo3 = await service.create(testUserId, { title: "세 번째" });

  // 전체 조회
  const all = await service.findAll();
  expect(all).toHaveLength(3);

  // 특정 항목만 삭제
  await service.delete(todo2.id);
  const afterDelete = await service.findAll();
  expect(afterDelete).toHaveLength(2);
});
```

---

## 에러 케이스 테스트

```typescript
describe("Error Handling", () => {
  const NON_EXISTENT_ID = "clnonexistent0000000000";

  it("should throw NotFoundException for non-existent todo", async () => {
    await expect(service.findById(NON_EXISTENT_ID))
      .rejects.toThrow(NotFoundException);

    await expect(service.findById(NON_EXISTENT_ID))
      .rejects.toThrow(`Todo #${NON_EXISTENT_ID} not found`);
  });

  it("should throw NotFoundException on update non-existent", async () => {
    await expect(service.update(NON_EXISTENT_ID, { title: "수정" }))
      .rejects.toThrow(NotFoundException);
  });

  it("should throw on invalid FK (non-existent userId)", async () => {
    const invalidUserId = "cl_invalid_user_id";

    await expect(service.create(invalidUserId, { title: "FK 테스트" }))
      .rejects.toThrow();
  });
});
```

---

## 데이터 무결성 테스트

```typescript
describe("Data Integrity", () => {
  it("should maintain data on partial update", async () => {
    const original = await service.create(testUserId, {
      title: "원본 제목",
      content: "원본 내용",
    });

    // title만 수정
    await service.update(original.id, { title: "수정된 제목" });

    const afterUpdate = await service.findById(original.id);
    expect(afterUpdate.title).toBe("수정된 제목");
    expect(afterUpdate.content).toBe("원본 내용"); // 유지됨
  });

  it("should update updatedAt on modification", async () => {
    const original = await service.create(testUserId, { title: "타임스탬프 테스트" });

    await new Promise((resolve) => setTimeout(resolve, 100));
    const updated = await service.update(original.id, { title: "수정됨" });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      original.updatedAt.getTime()
    );
  });
});
```

---

## 실행 명령어

```bash
# 전체 통합 테스트 실행
pnpm --filter @aido/api test todo.integration-spec

# 특정 describe 블록만 실행
pnpm --filter @aido/api test todo.integration-spec -- -t "CRUD"
```

---

## 요구사항

- **Docker 필수**: Testcontainers가 Docker로 PostgreSQL 컨테이너 실행
- **첫 실행 시간**: 이미지 다운로드로 시간 소요 (`postgres:16-alpine`)
- **타임아웃**: `beforeAll`에 60초 타임아웃 설정 권장

---

## DO / DON'T

### DO
- 각 테스트 전 `cleanup()`으로 데이터 초기화
- FK 제약조건이 있는 테이블은 부모 레코드 먼저 생성
- 실제 DB 동작 검증 (제약조건, 기본값, 타임스탬프)
- 독립적으로 실행 가능한 테스트 작성

### DON'T
- 테스트 간 데이터 의존성
- 하드코딩된 ID 사용 (테스트마다 새로 생성)
- HTTP 요청 테스트 (E2E 테스트에서 담당)
- Mock 사용 (실제 DB 연결이 목적)
