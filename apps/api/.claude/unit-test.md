# 단위 테스트 가이드

> 개별 클래스/메서드의 독립적인 동작을 Mock으로 검증하는 테스트

---

## 관련 문서

| 문서 | 내용 |
|------|------|
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
```

**명명 규칙**: `{파일명}.spec.ts`

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

---

## 기본 테스트 패턴

### Controller 테스트

```typescript
import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it('"Hello World!"를 반환해야 한다', () => {
      expect(appController.getHello()).toBe("Hello World!");
    });
  });
});
```

### Service 테스트 (의존성 Mock)

```typescript
import { Test, type TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TodoService } from "./todo.service";
import { TodoRepository } from "./todo.repository";
import { PaginationService } from "@/common/pagination";

describe("TodoService", () => {
  let service: TodoService;
  let repository: jest.Mocked<TodoRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoService,
        PaginationService,
        { provide: TodoRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
    repository = module.get(TodoRepository);
  });

  describe("findById", () => {
    it("Todo를 찾으면 반환해야 한다", async () => {
      const mockTodo = { id: "1", title: "Test", completed: false };
      repository.findById.mockResolvedValue(mockTodo);

      const result = await service.findById("1");

      expect(result).toEqual(mockTodo);
      expect(repository.findById).toHaveBeenCalledWith("1");
    });

    it("Todo를 찾지 못하면 NotFoundException을 던져야 한다", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById("999")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("새로운 Todo를 생성하고 반환해야 한다", async () => {
      const createDto = { title: "New Todo" };
      const mockTodo = { id: "1", ...createDto, completed: false };
      repository.create.mockResolvedValue(mockTodo);

      const result = await service.create("user-1", createDto);

      expect(result).toEqual(mockTodo);
      expect(repository.create).toHaveBeenCalled();
    });
  });
});
```

---

## Mocking 패턴

### 기본 Mock 객체

```typescript
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// 테스트 모듈에 주입
{ provide: TodoRepository, useValue: mockRepository }
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
```

---

## 테스트 케이스 작성 패턴

### 정상 케이스 (AAA 패턴)

```typescript
it("Todo를 찾으면 반환해야 한다", async () => {
  // Arrange (준비)
  const mockTodo = { id: "1", title: "Test" };
  repository.findById.mockResolvedValue(mockTodo);

  // Act (실행)
  const result = await service.findById("1");

  // Assert (검증)
  expect(result).toEqual(mockTodo);
});
```

### 예외 케이스

```typescript
it("Todo를 찾지 못하면 NotFoundException을 던져야 한다", async () => {
  repository.findById.mockResolvedValue(null);

  await expect(service.findById("999")).rejects.toThrow(NotFoundException);
  await expect(service.findById("999")).rejects.toThrow("Todo #999 not found");
});
```

### 경계값 테스트

```typescript
it("빈 문자열 제목을 처리해야 한다", async () => {
  // 빈 문자열 처리 테스트
});

it("최대 길이 제목을 처리해야 한다", async () => {
  const longTitle = "a".repeat(200);
  // 최대 길이 처리 테스트
});
```

---

## 실행 명령어

```bash
# 전체 단위 테스트
pnpm --filter @aido/api test

# 특정 파일
pnpm --filter @aido/api test todo.service.spec

# Watch 모드 (파일 변경 시 자동 실행)
pnpm --filter @aido/api test:watch

# 커버리지 리포트
pnpm --filter @aido/api test:cov
```

---

## DO / DON'T

### DO

- 각 테스트 케이스는 독립적으로 실행 가능해야 함
- Arrange-Act-Assert 패턴 사용
- 테스트 이름은 행동을 명확히 설명 (한국어)
- Edge case와 에러 케이스 테스트 포함

### DON'T

- 실제 DB 연결 (통합 테스트에서 담당)
- 테스트 간 상태 공유
- 구현 세부사항 테스트 (공개 인터페이스만)
- 테스트에서 비즈니스 로직 재구현
