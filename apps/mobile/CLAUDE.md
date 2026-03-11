# Aido Mobile App

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture.

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| 프레임워크 | Expo SDK, React Native |
| 라우팅 | Expo Router (파일 기반) |
| 상태관리 | TanStack Query v5 |
| HTTP | Ky |
| 검증 | Zod |
| UI | HeroUI Native, NativeWind |
| DI | React Context (수동 DI) |

---

## 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────┐
│  📱 Presentation Layer                                       │
│  ├── app/                  ← Expo Router 화면 (라우트)        │
│  └── presentations/        ← 컴포넌트, React Query 훅         │
├─────────────────────────────────────────────────────────────┤
│  🔧 Application Layer                                        │
│  └── services/  ← HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증 │
├─────────────────────────────────────────────────────────────┤
│  📦 Domain Layer                                             │
│  └── models/               ← 도메인 모델 + Zod 스키마 + Policy │
├─────────────────────────────────────────────────────────────┤
│  🔌 Infrastructure Layer                                     │
│  ├── shared/infra/         ← HTTP 클라이언트, Storage 구현     │
│  └── shared/types/         ← 공통 타입 (Page<T> 등)           │
├─────────────────────────────────────────────────────────────┤
│  🎯 Core Layer                                               │
│  └── core/ports/           ← 외부 의존성 추상화 인터페이스       │
├─────────────────────────────────────────────────────────────┤
│  🚀 Bootstrap Layer                                          │
│  └── bootstrap/providers/  ← DI 컨테이너, 전역 Provider        │
└─────────────────────────────────────────────────────────────┘
```

> **예외**: `DeviceIdRepository`는 HTTP가 아닌 SecureStore 로컬 스토리지에 접근하므로 Repository 패턴을 유지한다.
> `features/notification/repositories/device-id.repository.ts` (인터페이스) / `device-id.repository.impl.ts` (구현체)

---

## Feature 구조

```
features/{feature}/
├── models/
│   ├── {feature}.model.ts      # Zod 스키마 + 타입 + Policy
│   └── {feature}.error.ts      # {Feature}Error 클래스 (BusinessError 구현)
├── services/
│   ├── {feature}.service.ts    # HTTP + Zod + Mapper + Policy
│   └── {feature}.mapper.ts     # DTO → Domain 변환
├── __tests__/
│   └── {feature}.factories.ts  # 테스트 팩토리
└── presentations/
    ├── constants/
    │   └── {feature}-query-keys.constant.ts
    ├── view-models/                          # Domain → UI 데이터 변환 (필요 시)
    │   └── {feature}.view-model.ts
    ├── queries/
    │   ├── use-{action}-query-options.ts
    │   └── use-{action}-mutation-options.ts
    └── components/
        └── {ComponentName}.tsx
```

---

## 레이어별 패턴

### 책임 요약

| 레이어 | 책임 | 아는 것 | 모르는 것 |
|--------|------|--------|----------|
| Model | 도메인 타입 + Policy + Error 정의 | Zod | 다른 모든 레이어 |
| Mapper | DTO → Domain 변환 | validators DTO, 도메인 타입 | HTTP, Service |
| Service | HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증 | HttpClient, DTO, Policy, Mapper | UI, ErrorCode 분기 |
| Mutation/Query | 에러별 UI 반응, 캐시 관리 | Service, ErrorCode, {Feature}Error | HTTP, DTO |

### 1. Model (클라이언트 도메인 모델)

서버 DTO(`@aido/validators`)와 **독립적인 클라이언트 전용 타입**을 정의한다.
서버 응답 구조가 변경되어도 Mapper만 수정하면 되고, 앱 전체에 영향이 퍼지지 않는다.

- **Zod 스키마**: 도메인 타입 정의 (서버 DTO 스키마와 별개)
- **Policy**: 클라이언트 비즈니스 규칙 (Service에서 사용)

```typescript
// models/{feature}.model.ts
import { z } from 'zod';

export const {Feature}Schema = z.object({
  id: z.string(),
  // ... 필드 정의
});

export type {Feature} = z.infer<typeof {Feature}Schema>;

/** {Feature} 도메인 비즈니스 규칙 */
export const {Feature}Policy = {
  /** 규칙 설명 */
  someRule: (value: string): boolean => /* 검증 로직 */,
} as const;
```

```typescript
// 실제 예시: FriendPolicy — 서버 호출 전 태그 형식 검증
export const FriendPolicy = {
  isValidTag(tag: string): boolean {
    return /^#\d{4}$/.test(tag);
  },
} as const;
```

### 2. Error (클라이언트 비즈니스 에러)

**서버 에러(ApiError)와 다르다.** Policy 검증 실패 시 Service가 생성하는 **클라이언트 전용 에러**다.
서버에 요청을 보내기 전에 사전에 잘못된 입력을 차단하는 역할.

예시:
- `FriendError.EMPTY_TAG` — 빈 태그로 친구 요청 시도 → 서버 호출 전 차단
- `FriendError.INVALID_TAG` — 형식이 틀린 태그 → 서버 호출 전 차단

```typescript
// models/{feature}.error.ts
import type { BusinessError } from '@src/shared/errors';

export const {Feature}ErrorCode = {
  INVALID_INPUT: '{FEATURE}_INVALID_INPUT',
} as const;

export type {Feature}ErrorCode = (typeof {Feature}ErrorCode)[keyof typeof {Feature}ErrorCode];

export class {Feature}Error extends Error implements BusinessError {
  override readonly name = '{Feature}Error';

  constructor(
    public readonly code: {Feature}ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const {Feature}Errors = {
  invalidInput: () =>
    new {Feature}Error({Feature}ErrorCode.INVALID_INPUT, '입력값이 올바르지 않아요'),
} as const;

export const is{Feature}Error = (error: unknown): error is {Feature}Error =>
  error instanceof {Feature}Error;
```

### 3. Mapper (DTO → Domain 변환, services/ 하위)

Mapper는 **서버 DTO**(`@aido/validators`)를 **클라이언트 도메인 모델**(`models/`)로 변환하는 순수 함수다.

#### 왜 Mapper가 필요한가?

서버 DTO와 클라이언트 도메인 모델은 목적이 다르다:

- **서버 DTO**: API 응답의 정확한 형태. JSON 직렬화 제약으로 날짜는 ISO 문자열, 모든 필드를 포함
- **클라이언트 도메인 모델**: 앱 UI에 최적화된 형태. 날짜는 `Date` 객체, 필요한 필드만 포함

Mapper가 이 차이를 흡수하므로 **서버 응답 구조가 변경되어도 Mapper만 수정**하면 되고, 앱 전체(Service, Presentation)에 영향이 퍼지지 않는다.

#### Mapper가 수행하는 변환

| 변환 유형 | 서버 DTO | 클라이언트 도메인 | 예시 |
|-----------|---------|-----------------|------|
| **타입 변환** | ISO 8601 문자열 | `Date` 객체 | `"2024-01-15T10:30:00Z"` → `new Date(...)` |
| **필드 필터링** | 전체 필드 포함 | UI에 필요한 필드만 | `Todo` DTO 18개 필드 → `TodoItem` 10개 필드 |
| **구조 변환** | 서버 응답 구조 | 클라이언트 표준 구조 | `{ friends: [...] }` → `Page<FriendUser>` `{ items: [...] }` |
| **nullable 보존** | `null \| string` | `null \| Date` | `scheduledTime: null` → `null` 유지 |

```typescript
// 실제 예시: 서버 Todo (18개 필드) → 클라이언트 TodoItem (10개 필드)

// 서버 DTO (@aido/validators)
// Todo { id, userId, title, content, sortOrder, completed, completedAt,
//        startDate, endDate, scheduledTime, isAllDay, visibility,
//        recurrenceGroupId, category, createdAt, updatedAt }

// 클라이언트 도메인 모델 — UI에 불필요한 필드 제거 + 타입 변환
export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  startDate: dto.startDate,
  endDate: dto.endDate,
  category: dto.category,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,  // string → Date
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
  recurrenceGroupId: dto.recurrenceGroupId,
  // userId, content, sortOrder, completedAt, createdAt, updatedAt — 제외
});
```

```typescript
// 실제 예시: 서버 응답 구조 → 클라이언트 Page<T> 구조
export const toFriendsPage = (dto: FriendsListResponse): Page<FriendUser> => ({
  items: dto.friends.map(toFriendUser),   // friends → items (표준화)
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});
```

#### 기본 패턴

```typescript
// services/{feature}.mapper.ts
import type { {Feature}DTO } from '@aido/validators';
import type { {Feature} } from '../models/{feature}.model';

export const to{Feature} = (dto: {Feature}DTO): {Feature} => ({
  id: dto.id,
  // ... 필드 매핑
  createdAt: new Date(dto.createdAt), // 문자열 → Date 변환
});
```

**네이밍 규칙:**

| 함수명 | 용도 | 예시 |
|--------|------|------|
| `to{Entity}` | 단일 DTO → Domain | `toTodoItem(dto)` |
| `to{Entity}s` | 배열 DTO → Domain[] | `toTodoItems(dtos)` |
| `to{Entity}Page` | 페이지네이션 응답 → `Page<Domain>` | `toFriendsPage(dto)` |

### 4. Service (HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증)

Service는 HttpClient를 직접 주입받아 HTTP 호출, Zod 검증, Mapper 변환, Policy 검증을 모두 수행한다.

**규칙**: Service는 서버 에러(ApiError)를 번역하거나 변환하지 않는다. 그대로 pass-through한다.

```typescript
// services/{feature}.service.ts
import { type {Feature}ListResponse, {feature}ListResponseSchema } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';

import { type {Feature}Error, {Feature}Errors } from '../models/{feature}.error';
import { {Feature}Policy, type {Feature} } from '../models/{feature}.model';
import { to{Feature}sResult } from './{feature}.mapper';

export type {Feature}ServiceError = ApiError | {Feature}Error;

export class {Feature}Service {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 패턴 A: HTTP + Zod + Mapper
  get{Feature}s = async (params): Promise<Result<{Feature}sResult, ApiError>> => {
    const result = await this.#httpClient.get<{Feature}ListResponse>('v1/{feature}s', { params });
    if (!result.ok) return result;

    const parsed = {feature}ListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid get{Feature}s response: ${parsed.error.message}`);
    }

    return ok(to{Feature}sResult(parsed.data));
  };

  // 패턴 B: Policy + HTTP + Zod + Mapper
  create{Feature} = async (input): Promise<Result<{Feature}, {Feature}ServiceError>> => {
    if (!{Feature}Policy.isValidInput(input.name)) {
      return err({Feature}Errors.invalidInput());
    }

    const result = await this.#httpClient.post<{Feature}Response>('v1/{feature}s', input);
    if (!result.ok) return result;

    const parsed = {feature}ResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid create{Feature} response: ${parsed.error.message}`);
    }

    return ok(to{Feature}(parsed.data));
  };
}
```

### 5. Query Keys

```typescript
// presentations/constants/{feature}-query-keys.constant.ts
export const {FEATURE}_QUERY_KEYS = {
  all: ['{feature}'] as const,
  list: () => [...{FEATURE}_QUERY_KEYS.all, 'list'] as const,
  detail: (id: string) => [...{FEATURE}_QUERY_KEYS.all, 'detail', id] as const,
} as const;
```

### 6. Query/Mutation Options

```typescript
// presentations/queries/use-get-{feature}-query-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';
import { unwrap } from '@src/shared/errors/result';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const useGet{Feature}QueryOptions = (id: string) => {
  const service = use{Feature}Service();

  return queryOptions({
    queryKey: {FEATURE}_QUERY_KEYS.detail(id),
    queryFn: async () => {
      const result = await service.getById(id);
      return unwrap(result);
    },
  });
};
```

**Mutation — 에러 코드로 직접 UI 분기:**

```typescript
// presentations/queries/use-create-{feature}-mutation-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@src/shared/errors/result';
import { isApiError } from '@src/shared/errors/api-error';
import { ErrorCode } from '@src/shared/errors';
import { is{Feature}Error } from '../models/{feature}.error';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const useCreate{Feature}MutationOptions = () => {
  const service = use{Feature}Service();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (input: CreateInput) => {
      const result = await service.create(input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {FEATURE}_QUERY_KEYS.all });
    },
    onError: (error) => {
      // 1. 클라이언트 비즈니스 에러 (Service → Policy 검증)
      if (is{Feature}Error(error)) {
        Toast.show(error.message);
        return;
      }

      // 2. 서버 비즈니스 에러 (Service → ApiError)
      if (isApiError(error)) {
        if (error.hasCode(ErrorCode.SOME_SPECIFIC_ERROR)) {
          Toast.show(error.message);
          return;
        }
      }

      // 3. 예상치 못한 에러
      Toast.show('문제가 발생했어요');
    },
  });
};
```

---

## Result 시스템

`Result<T, E>`는 **예상된 에러**를 타입 안전하게 전달하는 패턴이다.

### 타입

| 타입/함수 | 설명 | 사용처 |
|----------|------|--------|
| `Result<T, E>` | 성공 `{ ok: true, value: T }` 또는 실패 `{ ok: false, error: E }` | 모든 레이어 |
| `ok(value)` | 성공 Result 생성 | Service |
| `err(error)` | 실패 Result 생성 | Service (ApiError, {Feature}Error) |
| `unwrap(result)` | 성공 → 값 반환, 실패 → `throw error` | Mutation/Query `mutationFn`/`queryFn` |
| `isOk(result)` | 성공 타입 가드 | 조건부 처리 |
| `isErr(result)` | 실패 타입 가드 | 조건부 처리 |

### 핵심 규칙

- **예상된 에러**만 `Result`로 전달 (ApiError, {Feature}Error)
- **예기치 못한 에러**는 `throw` (InfraError) → ErrorBoundary가 자동 처리
- Mutation에서 `unwrap`으로 Result → throw 변환하면, React Query `onError`에서 처리 가능

### unwrap 패턴

```typescript
// mutationFn에서 unwrap → 실패 시 throw → onError에서 catch
mutationFn: async (input) => {
  const result = await service.create(input);
  return unwrap(result); // 실패 시 error가 throw됨
},
onError: (error) => {
  // unwrap이 throw한 error가 여기로 옴
  if (is{Feature}Error(error)) { ... }
  if (isApiError(error)) { ... }
},
```

---

## 에러 처리 흐름

에러는 **예상/예기치 못한** 2가지로 분류된다:

| 분류 | 타입 | 전달 방식 | 처리 위치 | 예시 |
|------|------|----------|----------|------|
| 예기치 못한 에러 | `InfraError` | `throw` | ErrorBoundary (자동) | 5xx, 네트워크, 타임아웃 |
| 예기치 못한 에러 | `ParseError` | `throw` | ErrorBoundary (자동) | Zod safeParse 실패 (Service에서) |
| 예상된 에러 | `ApiError` | `Result.err` | Mutation `onError` | 4xx 서버 비즈니스 에러 |
| 예상된 에러 | `{Feature}Error` | `Result.err` | Mutation `onError` | Policy 검증 실패 (서버 호출 전) |

### 흐름도

```
서버 응답
  ├── 5xx/네트워크/타임아웃/파싱 → throw InfraError → ErrorBoundary (자동)
  └── 4xx → Result.err(ApiError) → Service (pass-through) → Mutation onError
                                                               ├── error.hasCode(ErrorCode.XXX) → Toast/UI 처리
                                                               └── 기타 → 일반 에러 메시지

클라이언트 검증
  └── Policy 실패 → Result.err({Feature}Error) → Mutation onError
                                                   └── is{Feature}Error(error) → Toast/UI 처리
```

### Zod 파싱 에러 (ParseError)

Service에서 서버 응답을 Zod로 검증할 때 발생. **예기치 못한 에러**로 분류.

```typescript
// Service에서 발생
const parsed = schema.safeParse(result.value);
if (!parsed.success) {
  throw new ParseError(`[{Feature}Service] Invalid ... response: ${parsed.error.message}`);
}
```

### 핵심 규칙

- **InfraError는 throw** — 복구 불가능한 에러이므로 ErrorBoundary가 자동 처리
- **ApiError는 Result** — 서버가 내려준 비즈니스 에러, Service가 번역하지 않고 pass-through
- **{Feature}Error는 Result** — 클라이언트 Policy 검증 실패, Service에서 생성
- **{Feature}Error는 서버 호출 전 차단** — Policy 기반 클라이언트 검증, 불필요한 네트워크 요청 방지
- **ParseError는 Service에서 throw** — Zod safeParse 실패 시 InfraError로 분류
- **Service는 서버 에러를 번역하지 않는다** — ErrorCode 기반 분기는 Mutation에서 담당

---

## 파일 네이밍 규칙

| 파일 유형 | 패턴 | 예시 |
|----------|------|------|
| 모델 | `{feature}.model.ts` | `todo.model.ts` |
| 에러 | `{feature}.error.ts` | `todo.error.ts` |
| 서비스 | `{feature}.service.ts` | `todo.service.ts` |
| 매퍼 | `{feature}.mapper.ts` | `todo.mapper.ts` (services/ 하위) |
| Query Options | `use-{action}-query-options.ts` | `use-get-todos-query-options.ts` |
| Mutation Options | `use-{action}-mutation-options.ts` | `use-create-todo-mutation-options.ts` |
| Query Keys | `{feature}-query-keys.constant.ts` | `todo-query-keys.constant.ts` |

---

## 새 Feature 추가 체크리스트

### 1단계: 도메인 정의
- [ ] `features/{feature}/models/{feature}.model.ts` 생성
  - Zod 스키마 정의
  - 타입 export
  - Policy 정의 (비즈니스 규칙)
- [ ] `features/{feature}/models/{feature}.error.ts` 생성
  - ErrorReason 타입 정의
  - {Feature}Error 클래스 정의 (BusinessError 구현)

### 2단계: Service + Mapper
- [ ] `features/{feature}/services/{feature}.mapper.ts` 생성
  - DTO → Domain 변환 함수 (standalone 순수 함수)
- [ ] `features/{feature}/services/{feature}.service.ts` 생성
  - HttpClient 주입
  - HTTP 호출 + Zod safeParse + Mapper 변환
  - Policy 검증 적용

### 3단계: DI 등록
- [ ] `bootstrap/providers/di-provider.tsx` 수정
  - Service 인스턴스 생성 (httpClient 직접 주입)
  - DIContainer 인터페이스에 추가
  - `use{Feature}Service` 훅 export

### 4단계: Presentation
- [ ] `features/{feature}/presentations/constants/{feature}-query-keys.constant.ts` 생성
- [ ] `features/{feature}/presentations/queries/` 에 Query/Mutation Options 생성
- [ ] `features/{feature}/presentations/components/` 에 컴포넌트 생성

### 5단계: 라우트
- [ ] `app/` 하위에 화면 추가

---

## 의존성 방향

```
         Model (Domain)  ← 핵심, 외부 의존 없음
        ↑   ↑   ↑
  UI  Service  Mapper
   ↓     ↓
  Service  HttpClient (Port)
              ↓
        KyHttpClient (Adapter)
```

**규칙:**
- 모든 레이어 → Model 의존 (OK)
- UI → Service (OK)
- Service → HttpClient Port (OK)
- **역방향 의존 금지** — Model이 다른 레이어를 알면 안 됨

---

## UI 컴포넌트 문서 규칙

`src/shared/ui/` 하위에 새 컴포넌트를 생성할 때 **반드시** 다음을 수행합니다:

### 1. 컴포넌트 문서 생성
`src/shared/ui/{ComponentDir}/{ComponentName}.md` 파일 생성. 포함 내용:

- `# {ComponentName}` — 한 줄 설명
- `## 사용법` — import 경로 + 기본 예제 (tsx 코드블록)
- `## Props` — 테이블 (Prop | 타입 | 기본값 | 설명)
- `## 파일 구조` — 디렉토리 내 파일 목록과 역할

### 2. ui-components.md 업데이트
`apps/mobile/.claude/ui-components.md`의 **Shared UI 컴포넌트 목록** 테이블에 행 추가:

| `{ComponentName}` | {용도 한 줄 설명} | `src/shared/ui/{Dir}/{Name}.md` |
