# Mobile App Architecture Guide

Ports & Adapters (Hexagonal) 아키텍처 기반 React Native/Expo 앱입니다.
새 기능 추가 시 이 문서의 패턴을 **반드시** 따릅니다.

---

## 디렉토리 구조

```
src/
├── bootstrap/providers/          # 앱 초기화 (DI, Auth, Query 등)
│   ├── di-provider.tsx           # 의존성 주입 컨테이너
│   ├── auth-provider.tsx         # 인증 상태 관리
│   ├── query-provider.tsx        # TanStack Query 설정
│   ├── hero-ui-provider.tsx      # UI 라이브러리
│   ├── gesture-handler-provider.tsx
│   └── notification-provider.tsx
│
├── core/ports/                   # Port 인터페이스 (외부 의존성 추상화)
│   ├── http.ts                   # HttpClient
│   ├── storage.ts                # Storage
│   └── logger.ts                 # Logger
│
├── features/{feature}/           # 기능별 모듈 (아래 상세)
│   ├── models/
│   ├── repositories/
│   ├── services/
│   └── presentations/
│
└── shared/
    ├── errors/                   # Result, ApiError, InfraError
    ├── hooks/                    # 공유 React 훅
    ├── infra/                    # Port 구현체 (KyHttpClient, SecureStorage 등)
    ├── ui/                       # 공유 UI 컴포넌트 (ui-components.md 참조)
    ├── config/                   # 환경 설정
    ├── constants/                # 앱 전역 상수
    ├── types/                    # 공유 타입
    └── utils/                    # 유틸리티 (cn, date, timezone, tv)
```

---

## 의존성 흐름

```
Presentation (components, queries, hooks)
  │  use{Feature}Service() 훅으로 서비스 주입
  ▼
Service (클라이언트 검증 + 비즈니스 오케스트레이션)
  │  this.#repository.method() 호출
  ▼
Repository (API 호출 + 서버 응답 검증 + DTO → Domain 매핑)
  │  this.#httpClient.get/post() 호출
  ▼
Infrastructure - Port 구현체 (KyHttpClient, SecureStorage)
```

**핵심 규칙**: 의존성은 항상 안쪽(Domain)을 향합니다. Presentation → Service → Repository → Port.

---

## Core Ports

`src/core/ports/`에 위치하는 인터페이스입니다.

### HttpClient (`core/ports/http.ts`)

```typescript
export interface HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  delete<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
}
```

### Port 구현체 매핑

| Port | 구현체 | 위치 |
|------|--------|------|
| `HttpClient` | `KyHttpClient` | `shared/infra/http/ky-client.ts` |
| `Storage` | `SecureStorage` | `shared/infra/storage/secure-storage.ts` |
| `Logger` | `ConsoleLogger` | `shared/infra/logger/console-logger.ts` |

### HTTP 클라이언트 종류

| 클라이언트 | 용도 |
|-----------|------|
| `createPublicClient()` | 인증 전 요청 (로그인, 회원가입) |
| `createAuthClient(storage)` | 인증 후 요청 (Bearer 토큰 자동 첨부, 401 시 refresh) |

---

## 에러 시스템

### 핵심 철학: 예측 가능 vs 예측 불가능

에러를 **예측 가능 여부**로 나누고, 각각 다른 전략으로 처리합니다.

| 구분 | 에러 종류 | 처리 방식 | 전파 |
|------|----------|----------|------|
| **예측 가능** | 서버 비즈니스 에러 (4xx) | `Result.err(ApiError)` | UI가 조건부 핸들링 |
| **예측 가능** | 클라이언트 검증 에러 | `Result.err({Feature}Error)` | UI가 조건부 핸들링 |
| **예측 불가능** | 서버 장애 (5xx) | `throw ServerError` | ErrorBoundary가 catch |
| **예측 불가능** | 네트워크 끊김 | `throw NetworkError` | ErrorBoundary가 catch |
| **예측 불가능** | 요청 타임아웃 | `throw TimeoutError` | ErrorBoundary가 catch |
| **예측 불가능** | API 응답 스키마 불일치 | `throw ParseError` | ErrorBoundary가 catch |

**예측 가능한 에러**는 정상 흐름의 일부입니다. "이메일이 중복됐다", "태그 형식이 잘못됐다" 같은 건 사용자에게 **구체적인 메시지**로 안내해야 하므로 `Result.err`로 반환하여 UI가 직접 처리합니다.

**예측 불가능한 에러**는 시스템 장애입니다. DB가 터졌거나, 네트워크가 끊겼거나, 서버가 스키마를 바꿨거나. 이런 건 UI가 개별 처리할 수 없으므로 `throw`하여 `QueryErrorBoundary`가 일괄 처리합니다.

### 에러 계층

```
예측 가능 (Result.err로 반환 → UI가 핸들링)
─────────────────────────────────────────────
  BusinessError (interface)
    ├── ApiError              ← 서버 4xx 비즈니스 에러 (@aido/errors 코드)
    └── {Feature}Error        ← 클라이언트 도메인 에러 (Policy 검증 실패 등)

예측 불가능 (throw → ErrorBoundary가 catch)
─────────────────────────────────────────────
  InfraError (abstract class)
    ├── ServerError           ← 5xx (DB 장애, 서버 크래시 등)
    ├── NetworkError          ← 인터넷 연결 끊김
    ├── TimeoutError          ← 요청 시간 초과
    └── ParseError            ← Zod 응답 검증 실패 (서버 스키마 변경 감지)
```

### Result 타입 (`shared/errors/result.ts`)

```typescript
export type Result<T, E extends BusinessError = BusinessError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends BusinessError>(error: E): Result<never, E> => ({ ok: false, error });
export const unwrap = <T, E extends BusinessError>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw result.error;  // React Query onError 콜백으로 전달
};
```

### 에러가 흐르는 경로

```
[ KyHttpClient ]
  4xx → error-handler.ts가 ApiError로 변환 → Result.err(ApiError) 반환
  5xx → throw ServerError  ─┐
  네트워크 끊김 → throw NetworkError  ─┤→ ErrorBoundary catch
  타임아웃 → throw TimeoutError  ─┘

[ Repository ]
  Zod safeParse 실패 → throw ParseError → ErrorBoundary catch
  4xx Result.err → 그대로 전파 (return result)

[ Service ]
  Policy 검증 실패 → Result.err({Feature}Error) 반환
  Repository Result.err → 그대로 전파

[ Presentation (Query Options) ]
  unwrap(result) → 성공이면 data 반환, 실패면 throw → onError 콜백
```

### 서버 에러 코드 (`@aido/errors`)

서버의 비즈니스 에러 코드는 `@aido/errors` 패키지에 정의되어 있고, 클라이언트의 `error-handler.ts`에서 한국어 사용자 메시지로 매핑합니다.

```typescript
// shared/infra/http/error-handler.ts
const MOBILE_ERROR_MESSAGES: Partial<Record<ErrorCodeType, string>> = {
  FOLLOW_0901: '이미 친구 요청을 보냈어요',
  FOLLOW_0902: '이미 친구에요',
  TODO_0301: '할 일을 찾을 수 없어요',
  AI_0003: '오늘 AI 사용 횟수를 모두 사용했어요',
  // ...
};
```

Repository에서 4xx가 오면 이미 사용자 친화적 메시지가 담긴 `ApiError`가 됩니다. UI에서 `error.message`를 그대로 보여주면 됩니다.

```typescript
// ApiError 코드 확인
if (isApiError(error) && error.hasCode('FOLLOW_0901')) { /* 이미 요청 보냄 */ }
if (isApiError(error) && error.isDomain('FOLLOW_')) { /* 친구 관련 에러 */ }
```

### QueryErrorBoundary

```tsx
<QueryErrorBoundary>
  <Suspense fallback={<MyComponent.Loading />}>
    <MyComponent />
  </Suspense>
</QueryErrorBoundary>
```

예측 불가능한 에러(InfraError)가 throw되면 ErrorBoundary가 catch하여 "오류가 발생했어요" + 재시도 버튼을 렌더링합니다.

---

## Feature 모듈 구조

각 feature는 4개 레이어로 구성됩니다.

```
features/{feature}/
├── models/                   # Domain Model + Policy + Error
│   ├── {feature}.model.ts    # 서버 DTO와 독립적인 도메인 모델
│   └── {feature}.error.ts    # 클라이언트 도메인 에러
├── repositories/             # Interface + Impl + Mapper
│   ├── {feature}.repository.ts        # 인터페이스
│   ├── {feature}.repository.impl.ts   # 구현체 (서버 통신)
│   └── {feature}.mapper.ts            # DTO → Domain 변환 (경계 지점)
├── services/                 # 클라이언트 검증 + 비즈니스 오케스트레이션
│   └── {feature}.service.ts
└── presentations/            # UI 계층
    ├── components/           # React 컴포넌트 (Policy 호출만, 로직 없음)
    ├── queries/              # TanStack Query options
    ├── constants/            # Query keys
    ├── schemas/              # 폼 Zod 스키마 (필요 시)
    └── hooks/                # Feature 전용 훅 (필요 시)
```

---

### 1. Models 레이어 — 서버 독립적 도메인

Models는 **클라이언트의 진짜 도메인**입니다. 서버 DTO(`@aido/validators`)와 완전히 독립적으로 정의합니다.

#### 왜 서버 DTO를 그대로 쓰지 않는가?

```
서버 DTO (Todo from @aido/validators)     우리 Domain Model (TodoItem)
─────────────────────────────────         ──────────────────────────────
scheduledTime: string | null              scheduledTime: Date | null
visibility: "PUBLIC" | "PRIVATE"          visibility: TodoVisibility (enum)
category: { id, name, color }             category: TodoCategory (Zod 스키마)
```

서버가 `scheduledTime`을 ISO string에서 unix timestamp로 바꿔도, `visibility` 값을 소문자로 바꿔도, **Mapper만 수정하면 됩니다**. 도메인 모델을 쓰는 Service, Presentation 코드는 한 줄도 안 바뀝니다.

**원칙**: 서버 변경이 프론트엔드 개발을 멈추게 하면 안 된다. Model이 방파제 역할을 한다.

#### Domain Model (`{feature}.model.ts`)

Zod 스키마로 정의하고 `z.infer`로 타입을 추출합니다.

```typescript
// features/todo/models/todo.model.ts
import { z } from 'zod';

export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: todoCategorySchema,
  completed: z.boolean(),
  scheduledTime: z.date().nullable(),   // Date 객체 (서버는 string)
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
});
export type TodoItem = z.infer<typeof todoItemSchema>;
```

**규칙**:
- 서버 DTO 타입(`@aido/validators`)을 `import type`으로 쓰지 않는다
- 클라이언트에 필요한 형태로 스키마를 정의한다 (예: `string` → `Date`)
- 서버에 없는 계산 필드를 추가할 수 있다

---

### 2. Policy 객체 — 비즈니스 로직의 유일한 거처

**비즈니스 로직(계산, 규칙, 판단)을 도메인 레이어에 응집시키는 객체 리터럴.** 컴포넌트는 Policy를 호출만 하고, 결과를 렌더링한다.

#### "Policy인가, UI인가?" 판단 기준

> **"이 값이 바뀌면 기획자에게 물어봐야 하는가?"** → Yes면 **Policy**, No면 UI/디자인 영역

| Policy에 넣는 것 | UI에 두는 것 |
|------------------|-------------|
| 비즈니스 규칙에 의한 값/판단/상수 | 순수 디자인 상수 (색상 코드, 폰트 크기) |
| "만료 여부", "수정 가능 여부", "표시 이름" | "리스트 3개 이상이면 스크롤", 카드 border-radius |

#### 메서드 5가지 카테고리

| 카테고리 | 네이밍 패턴 | 설명 | 예시 |
|----------|------------|------|------|
| 상태 판단 | `is{상태}` | 엔티티의 현재 상태를 boolean으로 | `isExpired`, `isActive`, `isCompleted` |
| 가능 여부 | `can{동작}` | 특정 동작이 허용되는지 판단 | `canEdit`, `canDelete`, `canShare` |
| 표시값 결정 | `get{값}` | UI에 보여줄 파생 값 계산 | `getLabel`, `getColor`, `getIcon` |
| 유효성 검증 | `isValid{대상}` | 입력값의 비즈니스 규칙 충족 여부 | `isValidEmail`, `isValidTag` |
| 비즈니스 상수 | `UPPER_SNAKE` | 기획에 의한 고정값 | `MAX_COUNT`, `DEFAULT_COLOR`, `MIN_LENGTH` |

#### `[Feature]Policy` 제네릭 템플릿

```typescript
// features/{feature}/models/{feature}.model.ts 하단
export const {Feature}Policy = {
  // 상태 판단: 엔티티의 현재 상태를 boolean으로 반환
  is{상태}: (item: {Feature}): boolean => /* 조건 */,

  // 가능 여부: 특정 동작이 허용되는지 판단
  can{동작}: (item: {Feature}): boolean => /* 조건 */,

  // 표시값: UI에 보여줄 파생 값 계산
  get{값}: (item: {Feature}): string => /* 계산 */,

  // 유효성 검증: 입력값의 비즈니스 규칙 충족 여부
  isValid{대상}: (value: string): boolean => /* 검증 */,

  // 비즈니스 상수: 기획에 의한 고정값
  MAX_{대상}: number,
} as const;
```

#### 현실적 예시 (도메인 비종속)

```typescript
// 게시글이 수정 가능한가? → 작성 후 24시간 이내
canEdit: (post: Post): boolean =>
  Date.now() - post.createdAt.getTime() < 24 * 60 * 60 * 1000,

// 쿠폰이 만료됐는가? → 만료일 비교
isExpired: (coupon: Coupon): boolean =>
  coupon.expiresAt < new Date(),

// 프로필 이름 표시 → 닉네임 우선, 없으면 이메일 앞부분
getDisplayName: (user: User): string =>
  user.nickname ?? user.email.split('@')[0],

// 비밀번호 최소 길이 → 기획에 의한 고정값
MIN_PASSWORD_LENGTH: 8,
```

#### Bad vs Good

```tsx
// Bad: 컴포넌트에 비즈니스 로직 직접 작성
export function PostCard({ post }: Props) {
  const canEdit = Date.now() - post.createdAt.getTime() < 24 * 60 * 60 * 1000;
  const displayName = post.author.nickname ?? post.author.email.split('@')[0];
  return <Card editable={canEdit} author={displayName} />;
}
```

```typescript
// Good: Policy로 응집
export const PostPolicy = {
  canEdit: (post: Post): boolean =>
    Date.now() - post.createdAt.getTime() < 24 * 60 * 60 * 1000,
  getAuthorDisplayName: (post: Post): string =>
    post.author.nickname ?? post.author.email.split('@')[0],
} as const;
```

```tsx
export function PostCard({ post }: Props) {
  return (
    <Card
      editable={PostPolicy.canEdit(post)}
      author={PostPolicy.getAuthorDisplayName(post)}
    />
  );
}
```

#### 복잡한 계산: 순수 함수 + Policy 2단 구조

계산이 복잡하면 순수 함수를 먼저 정의하고, Policy가 조합한다.

```typescript
// 1단계: 순수 계산 함수 (원시 값만 받음 → 독립 단위 테스트 용이)
export function calculateDiscountedPrice(price: number, discountRate: number): number {
  return Math.floor(price * (1 - discountRate / 100));
}

// 2단계: Policy (도메인 엔티티를 받아 순수 함수에 위임)
export const ProductPolicy = {
  getFinalPrice: (product: Product): number =>
    calculateDiscountedPrice(product.price, product.discountRate),
} as const;
```

#### 규칙 요약

- Policy는 **순수 함수**로만 구성한다 (부수효과 없음)
- Policy는 반드시 **객체 리터럴** (`as const`) — class 금지
- 파일 위치: `{feature}/models/{feature}.model.ts` 하단 (스키마 + 타입 + Policy 한 파일)
- 도메인 로직을 `utils/`에 흩뿌리지 않는다 — Policy에 응집
- 네이밍: `{Feature}Policy` (예: `TodoPolicy`, `FriendPolicy`, `CouponPolicy`)

#### ViewModel에서 Policy 활용

Presentation 레이어의 `select`에서 Policy를 호출하여 ViewModel로 변환한다.

```typescript
// presentations/queries/get-{feature}s-query-options.ts
export interface {Feature}ViewModel extends {Feature} {
  displayLabel: string;
  canEdit: boolean;
}

const toViewModel = (item: {Feature}): {Feature}ViewModel => ({
  ...item,
  displayLabel: {Feature}Policy.getLabel(item),
  canEdit: {Feature}Policy.canEdit(item),
});
```

> **한 줄 요약**: 비즈니스 로직은 `{Feature}Policy` 객체 리터럴에 응집시키고, `.model.ts`에 두며, UI는 호출만 한다.

---

### 3. Domain Error (`{feature}.error.ts`) — 클라이언트 검증 에러

서버가 아닌 **클라이언트에서 발생하는 예측 가능한 에러**를 정의합니다.

4가지 구성: ErrorCode 상수, Error 클래스, Error 팩토리, 타입 가드

```typescript
// features/friend/models/friend.error.ts
import type { BusinessError } from '@src/shared/errors';

// 1. ErrorCode 상수
export const FriendErrorCode = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
} as const;
export type FriendErrorCode = (typeof FriendErrorCode)[keyof typeof FriendErrorCode];

// 2. Error 클래스 (BusinessError 구현)
export class FriendError extends Error implements BusinessError {
  override readonly name = 'FriendError';
  constructor(public readonly code: FriendErrorCode, message: string) {
    super(message);
  }
}

// 3. Error 팩토리 (한국어 사용자 메시지)
export const FriendErrors = {
  invalidTag: () => new FriendError(FriendErrorCode.INVALID_TAG, '올바른 태그 형식이 아니에요'),
  emptyTag: () => new FriendError(FriendErrorCode.EMPTY_TAG, '태그를 입력해주세요'),
} as const;

// 4. 타입 가드
export const isFriendError = (error: unknown): error is FriendError =>
  error instanceof FriendError;
```

**서버 에러(`ApiError`) vs 클라이언트 에러(`{Feature}Error`)**:
- `ApiError`: 서버가 4xx로 응답 → `@aido/errors` 코드 + 한국어 메시지 → Repository에서 `Result.err`로 반환
- `{Feature}Error`: 서버에 요청하기 전에 클라이언트에서 검증 실패 → Service에서 `Result.err`로 반환

둘 다 **예측 가능한 에러**이므로 `Result.err`로 반환하고, UI가 `onError` 콜백에서 사용자에게 메시지를 보여줍니다.

---

### 4. Repositories 레이어 — 서버 경계

Repository는 서버와 클라이언트의 **경계 지점**입니다.

**책임**:
- 서버 API 호출
- 서버 응답을 Zod로 검증 (스키마 불일치 감지)
- DTO → Domain Model 매핑 (서버 변경 흡수)
- 서버 비즈니스 에러(4xx) 전파

#### Repository 인터페이스 (`{feature}.repository.ts`)

```typescript
// features/todo/repositories/todo.repository.ts
import type { CreateTodoInput, GetTodosQuery } from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type { TodoItem, TodosResult } from '../models/todo.model';

export interface TodoRepository {
  getTodos(params: GetTodosQuery): Promise<Result<TodosResult, ApiError>>;
  createTodo(params: CreateTodoInput): Promise<Result<TodoItem, ApiError>>;
  toggleTodoComplete(todoId: number, body: ToggleTodoCompleteInput): Promise<Result<TodoItem, ApiError>>;
}
```

**규칙**:
- Input/Query 타입은 `@aido/validators`에서 import (API와 공유하는 DTO)
- 반환 타입은 `Promise<Result<DomainModel, ApiError>>` (도메인 모델로 변환된 결과)
- 에러 타입은 항상 `ApiError` (서버 비즈니스 에러)

#### Repository 구현체 (`{feature}.repository.impl.ts`)

모든 메서드가 동일한 **5단계 패턴**을 따릅니다.

```typescript
// features/todo/repositories/todo.repository.impl.ts
export class TodoRepositoryImpl implements TodoRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getTodos(params: GetTodosQuery): Promise<Result<TodosResult, ApiError>> {
    // 1. API 호출
    const result = await this.#httpClient.get<TodoListResponse>('v1/todos', {
      params: { cursor: params.cursor, size: params.size },
    });

    // 2. 서버 비즈니스 에러(4xx) 전파 — 예측 가능, Result.err 그대로 반환
    if (!result.ok) return result;

    // 3. Zod 응답 검증 — 서버가 스키마를 바꿨는지 감지
    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      // 예측 불가능: 서버 응답이 약속된 스키마와 다름 → throw
      throw new ParseError();
    }

    // 4-5. Mapper로 DTO → Domain 변환 + ok() 반환
    return ok({
      todos: toTodoItems(parsed.data.items),
      hasNext: parsed.data.pagination.hasNext,
      nextCursor: parsed.data.pagination.nextCursor,
    });
  }
}
```

**5단계 패턴 요약**:
1. `this.#httpClient.{method}<ResponseDTO>('url', ...)` 호출
2. `if (!result.ok) return result;` — 서버 비즈니스 에러(4xx) 그대로 전파
3. `schema.safeParse(result.value)` — Zod로 응답 스키마 검증
4. 검증 실패 시 `throw new ParseError()` — 예측 불가능한 에러 (서버 스키마 변경)
5. 성공 시 `return ok(mapper(parsed.data))` — DTO → Domain 변환

#### Mapper (`{feature}.mapper.ts`) — 서버 변경의 방파제

순수 함수: DTO(서버 응답) → Domain Model 변환

```typescript
// features/todo/repositories/todo.mapper.ts
import type { Todo } from '@aido/validators';       // 서버 DTO
import type { TodoItem } from '../models/todo.model'; // 우리 Domain Model

export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  category: dto.category,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,  // string → Date
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
});

export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);
```

서버가 `scheduledTime`을 `string | null`에서 `number | null` (unix timestamp)로 바꾸면:

```typescript
// Mapper만 수정 — Service, Presentation 코드 변경 없음
scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime * 1000) : null,
```

**규칙**:
- 날짜 문자열은 `new Date()`로 변환
- nullable: `dto.field ? transform(dto.field) : null`
- 배열: `dtos.map(toSingle)` 패턴
- Mapper 외부에서는 서버 DTO 타입을 절대 참조하지 않음

---

### 5. Services 레이어 — 클라이언트 검증 + 오케스트레이션

Service는 **클라이언트 측 비즈니스 검증**을 담당합니다. 서버에 요청하기 전에 Policy로 검증하고, 실패하면 `Result.err({Feature}Error)`를 반환합니다.

#### 에러 처리 책임 분리

| 레이어 | 에러 유형 | 예시 |
|--------|----------|------|
| **Service** | 클라이언트 검증 에러 | 태그 형식 불일치, 빈 입력값 |
| **Repository** | 서버 비즈니스 에러 (4xx) | 이미 친구, 이메일 중복, 할일 없음 |
| **HttpClient** | 인프라 에러 | 5xx, 네트워크, 타임아웃 |

#### 패턴 A: 기본 위임 (대부분)

비즈니스 검증이 없으면 Repository를 그대로 호출합니다.

```typescript
// features/todo/services/todo.service.ts
export class TodoService {
  readonly #todoRepository: TodoRepository;

  constructor(todoRepository: TodoRepository) {
    this.#todoRepository = todoRepository;
  }

  getTodos = async (params: GetTodosQuery): Promise<Result<TodosResult, ApiError>> => {
    return this.#todoRepository.getTodos(params);
  };

  createTodo = async (params: CreateTodoInput): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.createTodo(params);
  };
}
```

#### 패턴 B: Policy 검증 (클라이언트에서 먼저 거르기)

서버에 불필요한 요청을 보내기 전에 클라이언트에서 검증합니다.

```typescript
// features/friend/services/friend.service.ts
export type FriendServiceError = ApiError | FriendError;

export class FriendService {
  readonly #repository: FriendRepository;

  constructor(repository: FriendRepository) {
    this.#repository = repository;
  }

  sendRequestByTag = async (
    userTag: string,
  ): Promise<Result<SendRequestResult, FriendServiceError>> => {
    // 클라이언트 검증 — Policy로 판단, 실패 시 서버 호출 없이 err 반환
    if (!userTag.trim()) return err(FriendErrors.emptyTag());
    if (!FriendPolicy.isValidTag(userTag)) return err(FriendErrors.invalidTag());

    // 검증 통과 → Repository 호출 (서버 비즈니스 에러는 여기서 올 수 있음)
    return this.#repository.sendRequest(userTag);
  };
}
```

에러 흐름 예시:
```
사용자가 빈 태그 입력 → Service: FriendErrors.emptyTag() → UI: "태그를 입력해주세요"
사용자가 잘못된 태그 입력 → Service: FriendErrors.invalidTag() → UI: "올바른 태그 형식이 아니에요"
사용자가 이미 보낸 태그 입력 → Server: 4xx FOLLOW_0901 → UI: "이미 친구 요청을 보냈어요"
서버 DB 장애 → Server: 500 → throw ServerError → ErrorBoundary: "오류가 발생했어요" + 재시도
```

#### 패턴 C: 복합 조합 (여러 의존성)

```typescript
// features/notification/services/notification.service.ts
export class NotificationService {
  readonly #notificationRepository: NotificationRepository;
  readonly #deviceIdService: DeviceIdService;
  readonly #pushTokenService: PushTokenService;

  constructor(
    notificationRepository: NotificationRepository,
    deviceIdService: DeviceIdService,
    pushTokenService: PushTokenService,
  ) { /* ... */ }

  setupPushNotifications = async (): Promise<Result<RegisterTokenResult, NotificationServiceError>> => {
    const [tokenResult, deviceId] = await Promise.all([
      this.#pushTokenService.getExpoPushToken(),
      this.#deviceIdService.get(),
    ]);
    if (!tokenResult.ok) return tokenResult;
    return this.#notificationRepository.registerToken(tokenResult.value, deviceId);
  };
}
```

**Service 규칙**:
- 메서드는 **arrow function** (클래스 필드)으로 선언
- 의존성은 `readonly #private` 필드
- 반환 타입은 `Promise<Result<T, ErrorType>>`
- 여러 에러 타입 가능 시 `type ServiceError = ApiError | {Feature}Error`

---

### 6. Presentations 레이어

UI 계층: Query Options + 컴포넌트 + 훅 + 폼 스키마 + 상수

#### Query Keys (`presentations/constants/`)

계층적 팩토리 함수 패턴입니다.

```typescript
// features/todo/presentations/constants/todo-query-keys.constant.ts
export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,
  ranges: () => [...TODO_QUERY_KEYS.all, 'range'] as const,
  byRange: (start: string, end: string) => [...TODO_QUERY_KEYS.ranges(), start, end] as const,
  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: (date: string) => [...TODO_QUERY_KEYS.lists(), date] as const,
} as const;
```

**규칙**:
- `all`은 최상위 (전체 invalidation용)
- 하위 키는 `[...KEYS.parent, 'sub']`로 스프레드
- 항상 `as const`

#### Query Options (`presentations/queries/`)

```typescript
// Query
export const getMeQueryOptions = () => {
  const authService = useAuthService();
  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: async () => unwrap(await authService.getCurrentUser()),
  });
};

// Infinite Query
export const getTodosInfiniteQueryOptions = (date: string) => {
  const todoService = useTodoService();
  return infiniteQueryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate(date),
    queryFn: async ({ pageParam }) => {
      const result = await todoService.getTodos({ startDate: date, endDate: date, cursor: pageParam, size: 20 });
      return unwrap(result);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
  });
};

// Mutation
export const createTodoMutationOptions = () => {
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: async (params: CreateTodoInput) => unwrap(await todoService.createTodo(params)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
    },
  });
};
```

**규칙**:
- 함수 이름: `{action}{Feature}{Type}Options` (예: `createTodoMutationOptions`)
- `use{Feature}Service()`로 서비스 주입
- `unwrap(result)` — 실패 시 throw
- mutation `onSuccess`에서 관련 queryKey invalidate

#### Components (`presentations/components/`)

**Suspense + Loading 서브컴포넌트 패턴**:

```tsx
// 데이터 컴포넌트 — Policy 호출만, 로직 없음
export function TodoList({ date }: TodoListProps) {
  const { data, hasNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(getTodosInfiniteQueryOptions(formatDate(date)));

  return (
    <FlashList
      data={data.todos}
      renderItem={({ item }) => <TodoItem todo={item} />}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      ListEmptyComponent={<Result title="할 일이 없어요" />}
    />
  );
}

// Loading 서브컴포넌트 (Named Function 패턴)
TodoList.Loading = function Loading() {
  return (
    <VStack px={16} gap={12}>
      {times(5, (i) => (
        <HStack key={`skeleton-${i}`} gap={12} className="py-3">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </HStack>
      ))}
    </VStack>
  );
};
```

**사용 (부모 컴포넌트)**:

```tsx
<QueryErrorBoundary>
  <Suspense fallback={<TodoList.Loading />}>
    <TodoList date={selectedDate} />
  </Suspense>
</QueryErrorBoundary>
```

#### Form Schemas (`presentations/schemas/`)

```typescript
// features/todo/presentations/schemas/add-todo-form.schema.ts
export const addTodoFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200),
  scheduledTime: z.string().nullish(),
  isAllDay: z.boolean().default(true),
  visibility: todoVisibilitySchema.default('PUBLIC'),
  categoryId: z.number().int().default(1),
});
export type AddTodoFormInput = z.input<typeof addTodoFormSchema>;
```

---

## DI (의존성 주입)

`bootstrap/providers/di-provider.tsx`에서 모든 인스턴스를 생성합니다.

### 생성 순서

```
Storage → HttpClient → Repository → Service → DIContext → use{Feature}Service() 훅
```

### 새 Feature 등록 절차

```typescript
// 1. DIContainer 인터페이스에 추가
export interface DIContainer {
  // ... 기존
  newFeatureService: NewFeatureService;
}

// 2. useState 초기화에서 생성
const newFeatureRepository = new NewFeatureRepositoryImpl(authHttpClient);
const newFeatureService = new NewFeatureService(newFeatureRepository);

// 3. return에 추가
return { ...기존, newFeatureService };

// 4. 훅 export 추가
export const useNewFeatureService = () => useDI().newFeatureService;
```

---

## Shared 모듈

### 유틸리티

| 파일 | 용도 |
|------|------|
| `shared/utils/cn.ts` | Tailwind 클래스 병합 (`clsx` + `twMerge`) |
| `shared/utils/tv.ts` | `tailwind-variants` 설정 |
| `shared/utils/date.ts` | 날짜 포맷/계산 (`formatDate`, `formatTime`, `formatRelativeTime`) |
| `shared/utils/timezone.ts` | 디바이스 타임존 감지 |
| `shared/config/env.ts` | 환경 설정 (`ENV.API_URL`, `ENV.IS_DEV`) |
| `shared/types/page.type.ts` | 페이지네이션 타입 |

### 공유 훅

| 훅 | 용도 |
|----|------|
| `useRefresh(refetchFn)` | Pull-to-refresh (`[isRefreshing, handleRefresh]`) |
| `useAppToast()` | 토스트 메시지 (`.success()`, `.error()`) |
| `useClipboard()` | 클립보드 복사 |
| `useStepper()` | 멀티 스텝 흐름 관리 |
| `useBlinkAnimation()` | 깜빡임 애니메이션 |

---

## 네이밍 컨벤션

### 파일

| 유형 | 패턴 | 예시 |
|------|------|------|
| Domain Model | `{feature}.model.ts` | `todo.model.ts` |
| Domain Error | `{feature}.error.ts` | `todo.error.ts` |
| Repository Interface | `{feature}.repository.ts` | `todo.repository.ts` |
| Repository Impl | `{feature}.repository.impl.ts` | `todo.repository.impl.ts` |
| Mapper | `{feature}.mapper.ts` | `todo.mapper.ts` |
| Service | `{feature}.service.ts` | `todo.service.ts` |
| Query Keys | `{feature}-query-keys.constant.ts` | `todo-query-keys.constant.ts` |
| Query Options | `{action}-{feature}-{type}-options.ts` | `create-todo-mutation-options.ts` |
| Form Schema | `{name}-form.schema.ts` | `add-todo-form.schema.ts` |
| Component | `PascalCase.tsx` | `TodoList.tsx` |
| Hook | `use{Name}.ts` | `useCooldown.ts` |

### 코드

| 유형 | 패턴 | 예시 |
|------|------|------|
| Repository Impl | `{Feature}RepositoryImpl` | `TodoRepositoryImpl` |
| Service | `{Feature}Service` | `TodoService` |
| Error Class | `{Feature}Error` | `TodoError` |
| Error Factory | `{Feature}Errors.{name}()` | `FriendErrors.emptyTag()` |
| Type Guard | `is{Feature}Error()` | `isTodoError()` |
| Policy | `{Feature}Policy` | `TodoPolicy` |
| Query Keys | `{FEATURE}_QUERY_KEYS` | `TODO_QUERY_KEYS` |
| Query Options | `{action}{Feature}{Type}Options` | `createTodoMutationOptions` |
| Mapper | `to{DomainModel}()` | `toTodoItem()` |
| DI Hook | `use{Feature}Service()` | `useTodoService()` |

---

## 새 Feature 추가 체크리스트

### Step 1: Models

- [ ] `features/{feature}/models/{feature}.model.ts` — Zod 스키마 + 타입 + Policy
- [ ] `features/{feature}/models/{feature}.error.ts` — ErrorCode + Error + Factory + Guard

### Step 2: Repositories

- [ ] `features/{feature}/repositories/{feature}.repository.ts` — 인터페이스
- [ ] `features/{feature}/repositories/{feature}.mapper.ts` — DTO → Domain 순수 함수
- [ ] `features/{feature}/repositories/{feature}.repository.impl.ts` — 구현체

### Step 3: Services

- [ ] `features/{feature}/services/{feature}.service.ts` — Service 클래스

### Step 4: DI 등록

- [ ] `bootstrap/providers/di-provider.tsx` — DIContainer + 인스턴스 + Hook

### Step 5: Presentations

- [ ] `presentations/constants/{feature}-query-keys.constant.ts`
- [ ] `presentations/queries/` — Query/Mutation Options
- [ ] `presentations/components/` — UI 컴포넌트
- [ ] (필요 시) `presentations/schemas/` — 폼 스키마
- [ ] (필요 시) `presentations/hooks/` — 커스텀 훅

---

## DO / DON'T

### DO

```typescript
// private 필드는 # 구문
readonly #httpClient: HttpClient;

// Service/Repository 메서드는 arrow function
getTodos = async (params: GetTodosQuery): Promise<Result<TodosResult, ApiError>> => { ... };

// Repository에서 Zod safeParse + ParseError throw
const parsed = schema.safeParse(result.value);
if (!parsed.success) throw new ParseError();

// Query options에서 unwrap
queryFn: async () => unwrap(await service.getData());

// mutation onSuccess에서 invalidate
onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.all });

// 예측 가능한 에러(4xx)는 return result (passthrough)
if (!result.ok) return result;

// 비즈니스 로직은 Policy 객체에
TodoPolicy.getColor(todo);  // 컴포넌트에 로직 넣지 않기

// Loading은 Named Function 서브컴포넌트
MyComponent.Loading = function Loading() { ... };

// Suspense + QueryErrorBoundary 조합
<QueryErrorBoundary>
  <Suspense fallback={<Component.Loading />}>
    <Component />
  </Suspense>
</QueryErrorBoundary>

// DTO 타입은 @aido/validators에서 import (Repository/Mapper에서만)
import type { CreateTodoInput } from '@aido/validators';

// Domain Model은 feature models에서 Zod로 독립 정의
export const todoItemSchema = z.object({ ... });
```

### DON'T

```typescript
// Domain Model에서 서버 DTO 타입을 직접 사용 금지
export type TodoItem = Todo;  // Mapper로 변환 필수

// Service에서 HttpClient 직접 호출 금지
this.#httpClient.get(...);  // Repository를 통해서만

// Presentation에서 Repository 직접 사용 금지
const repo = useDI().todoRepository;  // Service를 통해서만

// 컴포넌트에서 Result 직접 다루기 금지
const result = await service.getData();
if (result.ok) { ... }  // unwrap 사용

// 컴포넌트에 비즈니스 로직 넣기 금지
const color = todo.category.color;  // TodoPolicy.getColor(todo) 사용

// 비즈니스 로직을 utils/에 분산시키기 금지
// utils/todo-helpers.ts  // model.ts의 Policy로 응집

// InfraError catch 금지 (ErrorBoundary가 처리)
try { ... } catch (e) { if (e instanceof ServerError) ... }

// Query key 하드코딩 금지
queryKey: ['todo', 'list', date];  // QUERY_KEYS 상수 사용

// Object.assign 서브컴포넌트 금지
export default Object.assign(Component, { Loading });

// Policy를 class로 만들기 금지
class TodoPolicy { constructor(private todo) {} }  // 객체 리터럴 사용
```

---

## 참고 Feature 예시

| Feature | 패턴 특징 | 참고 |
|---------|----------|------|
| `features/todo/` | 표준 구현 (기본 위임 Service, Policy 예시) | 새 feature의 베이스 템플릿 |
| `features/friend/` | Policy 검증 패턴 (Service에서 클라이언트 에러 반환) | 비즈니스 규칙이 있는 경우 |
| `features/notification/` | 복합 Service (여러 의존성 조합) | 여러 서비스 협력이 필요한 경우 |
| `features/auth/` | Storage 연동 + 다중 HttpClient | 인증/토큰 관리가 필요한 경우 |
