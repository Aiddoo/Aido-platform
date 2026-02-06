# Mobile 앱 테스트 가이드

## 개요

Ports & Adapters 아키텍처의 의존성 주입을 활용한 테스트 전략입니다.

- **mock 객체**: 생성자 주입을 활용하여 `jest.fn()` 기반 mock 객체로 의존성 교체
- **순수 함수 테스트**: Mapper와 Policy는 mock 없이 직접 테스트
- **테스트 데이터 팩토리**: 공통 테스트 데이터는 factory 함수로 생성

> **왜 Stub이 아니라 Mock인가?**
> Stub은 정해진 결과를 반환할 뿐 호출 여부를 검증하지 않습니다 (결과 검증).
> Mock은 `toHaveBeenCalledWith` 등으로 **어떤 인자로 호출되었는지까지 검증**합니다 (상호작용 검증).
> 이 프로젝트에서는 "Policy 실패 시 Repository가 호출되지 않는다" 같은 상호작용 검증이 중요하므로 `jest.fn()` mock을 사용합니다.

- **Result 타입**: `Result<T, ApiError>` 기반 성공/실패 검증
- **한국어**: `describe`/`it` 블록은 모두 한국어로 작성

---

## 테스트 우선순위

| 우선순위 | 계층 | 테스트 대상 | mock 필요 |
|---------|------|------------|----------|
| 1 | Mapper | DTO → Domain 변환 | 없음 (순수 함수) |
| 2 | Policy | 비즈니스 규칙 검증 | 없음 (순수 함수) |
| 3 | Repository | API 응답 파싱, Zod 검증 | mock HttpClient |
| 4 | Service | 비즈니스 로직 조합, Policy 검증 | mock Repository |
| 5 | ErrorBoundary | InfraError → fallback UI 렌더링 | mock Service/Repository |

---

## 1. 테스트 데이터 팩토리

테스트마다 인라인으로 데이터를 만들면 의도가 묻힙니다. Factory 함수를 사용하면 **테스트마다 달라지는 값만 명시**할 수 있어 의도가 명확해집니다.

### 위치

```
shared/testing/factories/
├── todo.factory.ts
├── friend.factory.ts
└── auth.factory.ts
```

### Todo 팩토리 예시

```typescript
// shared/testing/factories/todo.factory.ts
import type { Todo } from '@aido/validators';
import type { TodoItem } from '@src/features/todo/models/todo.model';

/** DTO (서버 응답) 팩토리 */
export const createTodoDto = (overrides?: Partial<Todo>): Todo => ({
  id: 1,
  title: '할일 제목',
  category: { id: 1, name: '일상', color: '#FF9500' },
  completed: false,
  scheduledTime: null,
  isAllDay: true,
  visibility: 'PUBLIC',
  ...overrides,
});

/** Domain 모델 팩토리 */
export const createTodoItem = (overrides?: Partial<TodoItem>): TodoItem => ({
  id: 1,
  title: '할일 제목',
  category: { id: 1, name: '일상', color: '#FF9500' },
  completed: false,
  scheduledTime: null,
  isAllDay: true,
  visibility: 'PUBLIC',
  ...overrides,
});
```

### 사용법

```typescript
// 기본값 — 의도가 없는 필드는 생략
const dto = createTodoDto();

// 특정 필드만 오버라이드 — 테스트 의도가 명확
const completedDto = createTodoDto({ completed: true });
const withTimeDto = createTodoDto({ scheduledTime: '2024-06-01T09:00:00Z', isAllDay: false });
const privateTodo = createTodoItem({ visibility: 'PRIVATE' });
```

---

## 2. Mapper 테스트

Mapper는 순수 함수입니다. 외부 의존성 없이 DTO → Domain 변환만 검증합니다.

```typescript
// features/todo/repositories/todo.mapper.spec.ts
import { toTodoItem, toTodoItems } from './todo.mapper';
import { createTodoDto } from '@src/shared/testing/factories/todo.factory';

describe('Todo Mapper', () => {
  describe('toTodoItem', () => {
    it('DTO의 scheduledTime 문자열을 Date 객체로 변환해야 한다', () => {
      const dto = createTodoDto({ scheduledTime: '2024-06-01T09:00:00Z', isAllDay: false });

      const result = toTodoItem(dto);

      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.scheduledTime?.toISOString()).toBe('2024-06-01T09:00:00.000Z');
    });

    it('scheduledTime이 null이면 null을 유지해야 한다', () => {
      const dto = createTodoDto({ scheduledTime: null });

      const result = toTodoItem(dto);

      expect(result.scheduledTime).toBeNull();
    });

    it('모든 필드를 올바르게 매핑해야 한다', () => {
      const dto = createTodoDto();

      const result = toTodoItem(dto);

      expect(result).toEqual({
        id: 1,
        title: '할일 제목',
        category: { id: 1, name: '일상', color: '#FF9500' },
        completed: false,
        scheduledTime: null,
        isAllDay: true,
        visibility: 'PUBLIC',
      });
    });
  });

  describe('toTodoItems', () => {
    it('DTO 배열을 Domain 모델 배열로 변환해야 한다', () => {
      const dtos = [createTodoDto(), createTodoDto({ id: 2 })];

      const result = toTodoItems(dtos);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });
  });
});
```

---

## 3. Policy 테스트

Policy는 도메인 비즈니스 규칙을 순수 함수로 검증합니다.

```typescript
// features/todo/models/todo.model.spec.ts
import { TodoPolicy } from './todo.model';
import { createTodoItem } from '@src/shared/testing/factories/todo.factory';

describe('TodoPolicy', () => {
  describe('getColor', () => {
    it('카테고리의 색상을 반환해야 한다', () => {
      const todo = createTodoItem();

      expect(TodoPolicy.getColor(todo)).toBe('#FF9500');
    });
  });

  describe('isPublic', () => {
    it('visibility가 PUBLIC이면 true를 반환해야 한다', () => {
      const todo = createTodoItem({ visibility: 'PUBLIC' });

      expect(TodoPolicy.isPublic(todo)).toBe(true);
    });

    it('visibility가 PRIVATE이면 false를 반환해야 한다', () => {
      const todo = createTodoItem({ visibility: 'PRIVATE' });

      expect(TodoPolicy.isPublic(todo)).toBe(false);
    });
  });
});
```

---

## 4. Mock 객체 생성 방법

모든 의존성은 생성자 주입을 사용하므로, 인터페이스를 구현하는 `jest.fn()` mock 객체를 만들어 주입합니다.

### HttpClient mock

```typescript
import type { HttpClient } from '@src/core/ports/http';

const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});
```

### Repository mock 예시

```typescript
import type { TodoRepository } from './todo.repository';

const createMockTodoRepository = (): jest.Mocked<TodoRepository> => ({
  getTodos: jest.fn(),
  toggleTodoComplete: jest.fn(),
  createTodo: jest.fn(),
  parseTodo: jest.fn(),
  getAiUsage: jest.fn(),
});
```

```typescript
import type { FriendRepository } from './friend.repository';

const createMockFriendRepository = (): jest.Mocked<FriendRepository> => ({
  sendRequest: jest.fn(),
  getReceivedRequests: jest.fn(),
  getSentRequests: jest.fn(),
  acceptRequest: jest.fn(),
  rejectRequest: jest.fn(),
  cancelRequest: jest.fn(),
  getFriends: jest.fn(),
  removeFriend: jest.fn(),
});
```

```typescript
import type { AuthRepository } from './auth.repository';

const createMockAuthRepository = (): jest.Mocked<AuthRepository> => ({
  exchangeCode: jest.fn(),
  emailLogin: jest.fn(),
  appleLogin: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  getPreference: jest.fn(),
  updatePreference: jest.fn(),
  getConsent: jest.fn(),
  updateMarketingConsent: jest.fn(),
  register: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  getKakaoAuthUrl: jest.fn(),
  getNaverAuthUrl: jest.fn(),
  getGoogleAuthUrl: jest.fn(),
});
```

```typescript
import type { NotificationRepository } from './notification.repository';

const createMockNotificationRepository = (): jest.Mocked<NotificationRepository> => ({
  registerToken: jest.fn(),
  unregisterToken: jest.fn(),
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
});
```

> mock 팩토리 함수는 테스트 파일 상단에 정의하거나, 필요하면 `src/shared/testing/` 하위에 공유 파일로 추출합니다.

---

## 5. Repository 테스트

Repository는 mock HttpClient를 주입하여 **API 응답 파싱, Zod 검증, Result 반환**을 검증합니다.

```typescript
// features/todo/repositories/todo.repository.spec.ts
import type { TodoListResponse } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import { ServerError, ParseError } from '@src/shared/errors/infra-error';
import { ok, err } from '@src/shared/errors/result';
import { ApiError } from '@src/shared/errors/api-error';
import { createTodoDto } from '@src/shared/testing/factories/todo.factory';

import { TodoRepositoryImpl } from './todo.repository.impl';

const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

describe('TodoRepositoryImpl', () => {
  let httpClient: jest.Mocked<HttpClient>;
  let repository: TodoRepositoryImpl;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    repository = new TodoRepositoryImpl(httpClient);
  });

  describe('getTodos', () => {
    const validResponse: TodoListResponse = {
      items: [createTodoDto()],
      pagination: { hasNext: false, nextCursor: null },
    };

    it('API 성공 응답을 Zod로 검증하고 ok Result를 반환해야 한다', async () => {
      // Given
      httpClient.get.mockResolvedValue(ok(validResponse));

      // When
      const result = await repository.getTodos({ size: 10 });

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0].title).toBe('할일 제목');
      }
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos', { params: { size: 10 } });
    });

    it('4xx API 에러 시 err Result를 그대로 반환해야 한다', async () => {
      // Given
      httpClient.get.mockResolvedValue(
        err(new ApiError('TODO_0801', '할 일을 찾을 수 없어요', 404)),
      );

      // When
      const result = await repository.getTodos({ size: 10 });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TODO_0801');
        expect(result.error.status).toBe(404);
      }
    });

    it('Zod 검증 실패 시 ParseError를 throw해야 한다', async () => {
      // Given — 스키마에 맞지 않는 응답
      httpClient.get.mockResolvedValue(ok({ items: [{ id: 'not-a-number' }], pagination: {} }));

      // When & Then
      await expect(repository.getTodos({ size: 10 })).rejects.toThrow(ParseError);
    });

    it('HttpClient가 throw하면 그대로 전파해야 한다', async () => {
      // Given — 5xx 서버 에러
      httpClient.get.mockRejectedValue(new ServerError(500));

      // When & Then
      await expect(repository.getTodos({ size: 10 })).rejects.toThrow(ServerError);
    });
  });
});
```

---

## 6. Service 테스트

Service는 mock Repository를 주입하여 **비즈니스 로직, Policy 검증, Result 전파**를 검증합니다.

### 기본 패턴: Result 전파

```typescript
// features/todo/services/todo.service.spec.ts
import type { TodosResult } from '../models/todo.model';
import type { TodoRepository } from '../repositories/todo.repository';
import { ApiError } from '@src/shared/errors/api-error';
import { ok, err } from '@src/shared/errors/result';
import { createTodoItem } from '@src/shared/testing/factories/todo.factory';

import { TodoService } from './todo.service';

const createMockTodoRepository = (): jest.Mocked<TodoRepository> => ({
  getTodos: jest.fn(),
  toggleTodoComplete: jest.fn(),
  createTodo: jest.fn(),
  parseTodo: jest.fn(),
  getAiUsage: jest.fn(),
});

describe('TodoService', () => {
  let repository: jest.Mocked<TodoRepository>;
  let service: TodoService;

  beforeEach(() => {
    repository = createMockTodoRepository();
    service = new TodoService(repository);
  });

  describe('getTodos', () => {
    it('Repository 성공 시 ok Result를 반환해야 한다', async () => {
      // Given
      const todosResult: TodosResult = {
        todos: [createTodoItem({ scheduledTime: new Date('2024-06-01T09:00:00Z'), isAllDay: false })],
        hasNext: false,
        nextCursor: null,
      };
      repository.getTodos.mockResolvedValue(ok(todosResult));

      // When
      const result = await service.getTodos({ size: 10 });

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.todos).toHaveLength(1);
        expect(result.value.hasNext).toBe(false);
      }
      expect(repository.getTodos).toHaveBeenCalledWith({ size: 10 });
    });

    it('Repository가 에러를 반환하면 그대로 전파해야 한다', async () => {
      // Given
      repository.getTodos.mockResolvedValue(
        err(new ApiError('TODO_0801', '할 일을 찾을 수 없어요', 404)),
      );

      // When
      const result = await service.getTodos({ size: 10 });

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TODO_0801');
      }
    });
  });
});
```

### Policy 검증 패턴 (FriendService)

```typescript
// features/friend/services/friend.service.spec.ts
import type { FriendRepository } from '../repositories/friend.repository';
import { ok } from '@src/shared/errors/result';

import { FriendService } from './friend.service';

const createMockFriendRepository = (): jest.Mocked<FriendRepository> => ({
  sendRequest: jest.fn(),
  getReceivedRequests: jest.fn(),
  getSentRequests: jest.fn(),
  acceptRequest: jest.fn(),
  rejectRequest: jest.fn(),
  cancelRequest: jest.fn(),
  getFriends: jest.fn(),
  removeFriend: jest.fn(),
});

describe('FriendService', () => {
  let repository: jest.Mocked<FriendRepository>;
  let service: FriendService;

  beforeEach(() => {
    repository = createMockFriendRepository();
    service = new FriendService(repository);
  });

  describe('sendRequestByTag', () => {
    it('빈 태그로 요청 시 FRIEND_EMPTY_TAG 에러를 반환해야 한다', async () => {
      const result = await service.sendRequestByTag('   ');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FRIEND_EMPTY_TAG');
      }
      // Repository가 호출되지 않아야 한다
      expect(repository.sendRequest).not.toHaveBeenCalled();
    });

    it('잘못된 태그 형식으로 요청 시 FRIEND_INVALID_TAG 에러를 반환해야 한다', async () => {
      const result = await service.sendRequestByTag('잘못된태그!!');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FRIEND_INVALID_TAG');
      }
      expect(repository.sendRequest).not.toHaveBeenCalled();
    });

    it('유효한 태그로 요청 시 Repository를 호출해야 한다', async () => {
      // Given
      repository.sendRequest.mockResolvedValue(ok({ userId: 'user-1' }));

      // When
      const result = await service.sendRequestByTag('#1234');

      // Then
      expect(repository.sendRequest).toHaveBeenCalledWith('#1234');
      expect(result.ok).toBe(true);
    });
  });
});
```

### AuthService 테스트 (Storage mock 포함)

AuthService는 Repository와 Storage 두 의존성을 주입받습니다:

```typescript
// features/auth/services/auth.service.spec.ts
import type { AuthRepository } from '../repositories/auth.repository';
import type { Storage } from '@src/core/ports/storage';
import { ok, err } from '@src/shared/errors/result';
import { ApiError } from '@src/shared/errors/api-error';

import { AuthService } from './auth.service';

const createMockAuthRepository = (): jest.Mocked<AuthRepository> => ({
  exchangeCode: jest.fn(),
  emailLogin: jest.fn(),
  appleLogin: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  getPreference: jest.fn(),
  updatePreference: jest.fn(),
  getConsent: jest.fn(),
  updateMarketingConsent: jest.fn(),
  register: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  getKakaoAuthUrl: jest.fn(),
  getNaverAuthUrl: jest.fn(),
  getGoogleAuthUrl: jest.fn(),
});

const createMockStorage = (): jest.Mocked<Storage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
});

describe('AuthService', () => {
  let authRepository: jest.Mocked<AuthRepository>;
  let storage: jest.Mocked<Storage>;
  let service: AuthService;

  beforeEach(() => {
    authRepository = createMockAuthRepository();
    storage = createMockStorage();
    service = new AuthService(authRepository, storage);
  });

  describe('emailLogin', () => {
    it('로그인 성공 시 토큰을 저장하고 ok Result를 반환해야 한다', async () => {
      // Given
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      authRepository.emailLogin.mockResolvedValue(ok(tokens));

      // When
      const result = await service.emailLogin('test@example.com', 'password');

      // Then
      expect(result.ok).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('accessToken', 'access');
      expect(storage.set).toHaveBeenCalledWith('refreshToken', 'refresh');
    });

    it('로그인 실패 시 토큰을 저장하지 않고 에러를 전파해야 한다', async () => {
      // Given
      authRepository.emailLogin.mockResolvedValue(
        err(new ApiError('AUTH_0401', '이메일 또는 비밀번호가 틀렸어요', 401)),
      );

      // When
      const result = await service.emailLogin('test@example.com', 'wrong');

      // Then
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AUTH_0401');
      }
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('성공/실패 관계없이 로컬 토큰을 삭제해야 한다', async () => {
      // Given
      authRepository.logout.mockResolvedValue(ok(undefined));

      // When
      await service.logout();

      // Then
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
    });
  });
});
```

---

## 7. ErrorBoundary 통합 테스트

`<QueryErrorBoundary>`가 Repository/Service에서 throw된 InfraError를 잡아서 fallback UI를 렌더링하는지 검증합니다.

### 테스트 대상

Repository에서 `ParseError`/`ServerError`가 throw되면 → TanStack Query가 error를 전파 → `<QueryErrorBoundary>`가 catch → fallback UI 렌더링

### 테스트 유틸: throwError 컴포넌트

```typescript
// shared/testing/utils/throw-error.tsx
import { useSuspenseQuery } from '@tanstack/react-query';

/** queryFn에서 에러를 throw하여 ErrorBoundary를 트리거하는 컴포넌트 */
export function ThrowError({ error }: { error: Error }) {
  useSuspenseQuery({
    queryKey: ['test-error'],
    queryFn: () => { throw error; },
    retry: false,
  });
  return null;
}
```

### 기본 패턴: InfraError → fallback 렌더링

```typescript
// shared/ui/QueryErrorBoundary/QueryErrorBoundary.spec.tsx
import { renderWithClient } from '@src/shared/testing/utils/render-with-client';
import { screen, waitFor } from '@testing-library/react-native';
import { ServerError, ParseError } from '@src/shared/errors/infra-error';

import { QueryErrorBoundary } from './QueryErrorBoundary';
import { ThrowError } from '@src/shared/testing/utils/throw-error';

describe('QueryErrorBoundary', () => {
  it('ServerError 발생 시 기본 fallback UI를 렌더링해야 한다', async () => {
    renderWithClient(
      <QueryErrorBoundary>
        <ThrowError error={new ServerError(500)} />
      </QueryErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('오류가 발생했어요')).toBeTruthy();
      expect(screen.getByText('재시도')).toBeTruthy();
    });
  });

  it('ParseError 발생 시 기본 fallback UI를 렌더링해야 한다', async () => {
    renderWithClient(
      <QueryErrorBoundary>
        <ThrowError error={new ParseError()} />
      </QueryErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('오류가 발생했어요')).toBeTruthy();
    });
  });

  it('커스텀 fallback을 전달하면 해당 UI를 렌더링해야 한다', async () => {
    renderWithClient(
      <QueryErrorBoundary
        fallback={({ error, reset }) => <Text testID="custom-fallback">커스텀 에러</Text>}
      >
        <ThrowError error={new ServerError(500)} />
      </QueryErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    });
  });
});
```

### 재시도 흐름 테스트

```typescript
it('재시도 버튼을 누르면 쿼리가 다시 실행되어야 한다', async () => {
  const queryFn = jest.fn()
    .mockRejectedValueOnce(new ServerError(500))  // 첫 번째: 실패
    .mockResolvedValueOnce({ data: 'success' });  // 두 번째: 성공

  renderWithClient(
    <QueryErrorBoundary>
      <TestQueryComponent queryFn={queryFn} />
    </QueryErrorBoundary>,
  );

  // fallback 렌더링 대기
  await waitFor(() => {
    expect(screen.getByText('오류가 발생했어요')).toBeTruthy();
  });

  // 재시도
  fireEvent.press(screen.getByText('재시도'));

  // 성공 UI 렌더링 대기
  await waitFor(() => {
    expect(screen.getByText('success')).toBeTruthy();
  });
  expect(queryFn).toHaveBeenCalledTimes(2);
});
```

### renderWithClient 유틸

ErrorBoundary 테스트에는 실제 `QueryClient`가 필요합니다:

```typescript
// shared/testing/utils/render-with-client.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

export function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}
```

---

## 테스트 작성 규칙

### 파일 네이밍

| 파일 유형 | 패턴 | 예시 |
|----------|------|------|
| Mapper 테스트 | `{feature}.mapper.spec.ts` | `todo.mapper.spec.ts` |
| Policy 테스트 | `{feature}.model.spec.ts` | `todo.model.spec.ts` |
| Repository 테스트 | `{feature}.repository.spec.ts` | `todo.repository.spec.ts` |
| Service 테스트 | `{feature}.service.spec.ts` | `todo.service.spec.ts` |
| ErrorBoundary 테스트 | `QueryErrorBoundary.spec.tsx` | — |

### 테스트 구조 (Given-When-Then)

```typescript
it('특정 조건에서 기대하는 결과가 나와야 한다', async () => {
  // Given — 테스트 데이터 및 mock 설정
  repository.getTodos.mockResolvedValue(ok(data));

  // When — 테스트 대상 실행
  const result = await service.getTodos({ size: 10 });

  // Then — 결과 검증
  expect(result.ok).toBe(true);
});
```

### Result 타입 검증 패턴

```typescript
// 성공 검증
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.value).toEqual(expected);
}

// 실패 검증
expect(result.ok).toBe(false);
if (!result.ok) {
  expect(result.error.code).toBe('ERROR_CODE');
}
```

### mock 설정 패턴

```typescript
// 성공 응답
repository.getTodos.mockResolvedValue(ok(data));

// 에러 응답
repository.getTodos.mockResolvedValue(err(new ApiError('CODE', '메시지', 404)));

// throw (InfraError 시뮬레이션)
httpClient.get.mockRejectedValue(new ServerError(500));

// 한 번만 다른 응답
repository.getTodos.mockResolvedValueOnce(ok(firstData));
repository.getTodos.mockResolvedValueOnce(ok(secondData));
```

---

## 테스트 실행

```bash
# 전체 테스트
pnpm --filter @aido/mobile test

# 특정 파일 테스트
pnpm --filter @aido/mobile test -- todo.service.spec.ts

# 특정 패턴 테스트
pnpm --filter @aido/mobile test -- --testPathPattern=mapper

# 커버리지 확인
pnpm --filter @aido/mobile test -- --coverage
```

---

## 체크리스트

### Mapper 테스트

- [ ] DTO → Domain 변환이 올바른지 검증
- [ ] 날짜 문자열 → Date 변환 확인
- [ ] nullable 필드 처리 확인

### Policy 테스트

- [ ] 비즈니스 규칙 경계값 테스트
- [ ] 유효/무효 입력 모두 검증

### Repository 테스트

- [ ] mock HttpClient로 성공 응답 → ok Result 반환 검증
- [ ] mock HttpClient로 4xx 에러 → err Result 전파 검증
- [ ] Zod 검증 실패 시 ParseError throw 확인
- [ ] InfraError throw 전파 확인

### Service 테스트

- [ ] mock Repository로 호출 검증
- [ ] ok Result 반환 시 데이터 변환 검증
- [ ] err Result 전파 검증
- [ ] Policy 검증 로직이 err Result 반환하는지 확인
- [ ] Policy 실패 시 Repository가 호출되지 않는지 확인

### ErrorBoundary 통합 테스트

- [ ] InfraError throw 시 fallback UI 렌더링 확인
- [ ] 기본 fallback 텍스트 ("오류가 발생했어요", "재시도") 확인
- [ ] 커스텀 fallback 전달 시 해당 UI 렌더링 확인
- [ ] 재시도 버튼으로 쿼리 재실행 검증

### 공통

- [ ] 테스트 설명이 한국어로 작성됨
- [ ] Given-When-Then 구조 준수
- [ ] 에러 케이스 포함
- [ ] 팩토리 함수로 테스트 데이터 생성 (인라인 객체 지양)

---

## 참고 파일

| 파일 | 설명 |
|------|------|
| `src/core/ports/http.ts` | HttpClient 인터페이스 |
| `src/shared/errors/result.ts` | Result 타입, ok/err/unwrap |
| `src/shared/errors/api-error.ts` | ApiError (4xx) |
| `src/shared/errors/infra-error.ts` | InfraError (5xx, 네트워크, 파싱) |
| `src/shared/ui/QueryErrorBoundary/` | ErrorBoundary 컴포넌트 |
| `src/shared/testing/factories/` | 테스트 데이터 팩토리 |
| `src/shared/testing/utils/` | 테스트 유틸 (renderWithClient 등) |
| `src/features/*/repositories/*.repository.ts` | Repository 인터페이스 |
| `src/features/*/services/*.service.ts` | Service 구현 |
