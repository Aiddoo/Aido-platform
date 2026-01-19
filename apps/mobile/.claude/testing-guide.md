# Mobile 앱 테스트 가이드

## 개요

Context API 의존성 주입을 활용한 **Stub 기반 테스트** 전략입니다.

- **모킹 최소화**: `jest.mock()` 대신 Stub 클래스 사용
- **의존성 주입**: Context API를 통한 Repository 주입
- **한국어 테스트 설명**: `describe`/`it` 블록은 모두 한국어로 작성

## 아키텍처 계층

```
UI Layer (Components/Screens)
    └─ Custom Hooks 사용 (useAuth, useTodo 등)
Hook Layer (React Query + Context)
    └─ Service를 주입받아 데이터 페칭 및 상태 관리
Service Layer (비즈니스 로직)
    └─ Repository를 주입받아 비즈니스 로직 수행
Repository Layer (데이터 페칭)
    └─ API 호출, 외부 의존성 캡슐화
Model Layer (순수 도메인)
    └─ 타입 정의, Zod 스키마, 도메인 로직
```

## 파일 구조

```
src/features/{feature}/
├── models/
│   └── {feature}.model.ts            # 타입 및 Zod 스키마
├── repositories/
│   ├── {feature}.repository.ts       # 인터페이스 정의
│   ├── {feature}.repository.impl.ts  # 실제 구현
│   ├── {feature}.repository.stub.ts  # 테스트용 Stub
│   └── {feature}.repository.spec.ts  # Repository 테스트
├── services/
│   ├── {feature}.service.ts          # 비즈니스 로직
│   └── {feature}.service.spec.ts     # Service 테스트
├── hooks/
│   └── use-{feature}.ts              # Custom Hook
└── contexts/
    └── {feature}.context.tsx         # Context Provider
```

## 테스트 우선순위

| 우선순위 | 계층 | 테스트 대상 | 이유 |
|---------|------|------------|------|
| 1 | Repository | API 응답 파싱, Zod 검증 | 데이터 무결성의 첫 관문 |
| 2 | Service | 비즈니스 로직 | 핵심 로직, Stub으로 쉽게 테스트 |
| 3 | Model | 복잡한 도메인 로직 | 순수 함수 테스트 |
| 4 | Hook | 복잡한 상태 로직 | UI 통합 전 검증 |

## Repository 테스트 패턴

Repository는 **API 응답을 올바르게 파싱하는지** 검증합니다.

```typescript
// {feature}.repository.spec.ts
import { TodoRepositoryImpl } from './todo.repository.impl';
import { ApiClientStub } from '@src/test-utils/api-client.stub';

describe('TodoRepositoryImpl', () => {
  let apiClientStub: ApiClientStub;
  let repository: TodoRepositoryImpl;

  beforeEach(() => {
    apiClientStub = new ApiClientStub();
    repository = new TodoRepositoryImpl(apiClientStub);
  });

  describe('getAll', () => {
    it('API 응답을 Todo 모델 배열로 올바르게 변환해야 한다', async () => {
      // Given - 서버 API 응답 형태
      const apiResponse = [
        {
          id: '1',
          title: '할일 1',
          completed: false,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      apiClientStub.setResponse('/todos', apiResponse);

      // When
      const result = await repository.getAll();

      // Then
      expect(apiClientStub.getCalled).toContain('/todos');
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('API 에러 시 예외를 전파해야 한다', async () => {
      // Given
      apiClientStub.setError('/todos', new Error('Network Error'));

      // When & Then
      await expect(repository.getAll()).rejects.toThrow('Network Error');
    });
  });

  describe('Zod 스키마 검증', () => {
    it('잘못된 API 응답 형식에 대해 검증 에러를 발생시켜야 한다', async () => {
      // Given - 필수 필드 누락
      const invalidResponse = [{ id: '1' }]; // title 누락
      apiClientStub.setResponse('/todos', invalidResponse);

      // When & Then
      await expect(repository.getAll()).rejects.toThrow();
    });
  });
});
```

## Repository Stub 패턴

Service 테스트에서 사용할 Repository Stub입니다.

```typescript
// {feature}.repository.stub.ts
import type { TodoRepository } from './todo.repository';
import type { CreateTodoInput, Todo } from '../models/todo.model';

export class TodoRepositoryStub implements TodoRepository {
  private todos: Todo[] = [];

  // 호출 추적용 플래그
  public getAllCalled = false;
  public createCalled = false;
  public lastCreateInput: CreateTodoInput | null = null;

  async getAll(): Promise<Todo[]> {
    this.getAllCalled = true;
    return this.todos;
  }

  async create(input: CreateTodoInput): Promise<Todo> {
    this.createCalled = true;
    this.lastCreateInput = input;
    const newTodo: Todo = {
      id: String(this.todos.length + 1),
      ...input,
      completed: false,
      createdAt: new Date(),
    };
    this.todos.push(newTodo);
    return newTodo;
  }

  // 테스트 헬퍼
  setFakeTodos(todos: Todo[]) {
    this.todos = todos;
  }

  reset() {
    this.todos = [];
    this.getAllCalled = false;
    this.createCalled = false;
    this.lastCreateInput = null;
  }
}
```

## Service 테스트 패턴

```typescript
// {feature}.service.spec.ts
import { TodoService } from './todo.service';
import { TodoRepositoryStub } from '../repositories/todo.repository.stub';

describe('TodoService', () => {
  let todoRepositoryStub: TodoRepositoryStub;
  let todoService: TodoService;

  beforeEach(() => {
    todoRepositoryStub = new TodoRepositoryStub();
    todoService = new TodoService(todoRepositoryStub);
  });

  describe('getAllTodos', () => {
    it('모든 할일 목록을 반환해야 한다', async () => {
      // Given
      const fakeTodos = [
        { id: '1', title: '첫번째 할일', completed: false, createdAt: new Date() },
      ];
      todoRepositoryStub.setFakeTodos(fakeTodos);

      // When
      const result = await todoService.getAllTodos();

      // Then
      expect(todoRepositoryStub.getAllCalled).toBe(true);
      expect(result).toEqual(fakeTodos);
    });
  });

  describe('createTodo', () => {
    it('새로운 할일을 생성해야 한다', async () => {
      // Given
      const input = { title: '새 할일' };

      // When
      const result = await todoService.createTodo(input);

      // Then
      expect(todoRepositoryStub.createCalled).toBe(true);
      expect(todoRepositoryStub.lastCreateInput).toEqual(input);
      expect(result.title).toBe('새 할일');
    });

    it('빈 제목으로 생성 시 에러를 발생시켜야 한다', async () => {
      // Given
      const input = { title: '' };

      // When & Then
      await expect(todoService.createTodo(input)).rejects.toThrow('제목은 필수입니다');
    });
  });
});
```

## 테스트 작성 규칙

### 네이밍 컨벤션

- 테스트 파일: `{name}.spec.ts` 또는 `{name}.test.ts`
- Stub 파일: `{name}.stub.ts`
- 테스트 설명: **한국어로 작성**

### 테스트 구조 (Given-When-Then)

```typescript
it('특정 조건에서 기대하는 결과가 나와야 한다', async () => {
  // Given - 테스트 데이터 및 상태 설정
  
  // When - 테스트 대상 실행
  
  // Then - 결과 검증
});
```

### Stub 설계 원칙

1. **인터페이스 구현**: Repository/Client 인터페이스를 완전히 구현
2. **호출 추적**: 메서드 호출 여부 및 인자 확인용 필드
3. **데이터 조작**: `setResponse()`, `setFake*()` 헬퍼로 테스트 데이터 설정
4. **에러 시뮬레이션**: `setError()` 헬퍼로 에러 케이스 테스트
5. **초기화**: `reset()` 메서드로 상태 초기화

## 테스트 실행

```bash
# 전체 테스트
pnpm --filter @aido/mobile test

# 특정 파일 테스트
pnpm --filter @aido/mobile test -- todo.service.spec.ts

# 커버리지 확인
pnpm --filter @aido/mobile test -- --coverage
```

## 체크리스트

- [ ] Repository 테스트가 API 응답 파싱을 검증
- [ ] Repository 테스트가 Zod 스키마 검증을 확인
- [ ] Service 테스트가 Stub을 통해 Repository 호출 검증
- [ ] 테스트 설명이 한국어로 작성됨
- [ ] Given-When-Then 구조 준수
- [ ] 에러 케이스 테스트 포함

## 참고 파일

- `src/features/auth/repositories/auth.repository.stub.ts` - Stub 예시
- `src/features/auth/services/auth.service.spec.ts` - Service 테스트 예시
