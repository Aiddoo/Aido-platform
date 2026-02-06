# Aido Mobile App

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture + Ports & Adapters 패턴.

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
│  └── services/  ← 클라이언트 비즈니스 로직 (Policy 검증, 부수효과 조합) │
├─────────────────────────────────────────────────────────────┤
│  📦 Domain Layer                                             │
│  └── models/               ← 도메인 모델 + Zod 스키마 + Policy │
├─────────────────────────────────────────────────────────────┤
│  🔌 Infrastructure Layer                                     │
│  ├── repositories/         ← Repository 인터페이스 + 구현체    │
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

---

## Feature 구조

```
features/{feature}/
├── models/
│   ├── {feature}.model.ts      # Zod 스키마 + 타입 + Policy
│   └── {feature}.error.ts      # {Feature}Error 클래스 (BusinessError 구현)
├── repositories/
│   ├── {feature}.mapper.ts          # DTO → Domain 변환
│   ├── {feature}.repository.ts      # 인터페이스 (도메인 타입 반환)
│   └── {feature}.repository.impl.ts # 구현체 (Zod 검증 + mapper 호출)
├── services/
│   └── {feature}.service.ts    # 비즈니스 로직 (Policy 검증)
└── presentations/
    ├── constants/
    │   └── {feature}-query-keys.constant.ts
    ├── queries/
    │   ├── {action}-query-options.ts
    │   └── {action}-mutation-options.ts
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
| Repository (인터페이스) | 데이터 접근 계약 | 도메인 타입 | HTTP, DTO |
| Repository (구현체) | HTTP 통신 + Zod 검증 + mapper 호출 | DTO, HttpClient, mapper | Service, UI |
| Service | 클라이언트 비즈니스 로직 | Policy, Repository 인터페이스 | HTTP, DTO, ErrorCode |
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

### 3. Mapper (DTO → Domain 변환, repositories/ 하위)

```typescript
// repositories/{feature}.mapper.ts
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

### 4. Repository (인터페이스 + 구현체)

```typescript
// repositories/{feature}.repository.ts — 도메인 타입 반환
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type { {Feature} } from '../models/{feature}.model';

export interface {Feature}Repository {
  getById(id: string): Promise<Result<{Feature}, ApiError>>;
}
```

```typescript
// repositories/{feature}.repository.impl.ts — Zod 검증 + mapper 호출
import { type {Feature}DTO, {feature}DtoSchema } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { {Feature} } from '../models/{feature}.model';
import { to{Feature} } from './{feature}.mapper';
import type { {Feature}Repository } from './{feature}.repository';

export class {Feature}RepositoryImpl implements {Feature}Repository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getById(id: string): Promise<Result<{Feature}, ApiError>> {
    const result = await this.#httpClient.get<{Feature}DTO>(`v1/{feature}s/${id}`);
    if (!result.ok) {
      return result;
    }

    const parsed = {feature}DtoSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[{Feature}Repository] Invalid response:', parsed.error);
      throw new ParseError();
    }

    return ok(to{Feature}(parsed.data));
  }
}
```

### 5. Service (클라이언트 비즈니스 로직 — 서버 에러 번역 X, pass-through + Policy 검증)

**규칙**: Service는 서버 에러(ApiError)를 번역하거나 변환하지 않는다. 그대로 pass-through한다.

```typescript
// services/{feature}.service.ts
import type { ApiError } from '@src/shared/errors/api-error';
import { err, type Result } from '@src/shared/errors/result';

import { type {Feature}Error, {Feature}Errors } from '../models/{feature}.error';
import { {Feature}Policy, type {Feature} } from '../models/{feature}.model';
import type { {Feature}Repository } from '../repositories/{feature}.repository';

export type {Feature}ServiceError = ApiError | {Feature}Error;

export class {Feature}Service {
  readonly #repository: {Feature}Repository;

  constructor(repository: {Feature}Repository) {
    this.#repository = repository;
  }

  // 단순 조회 → pass-through
  getById = async (id: string): Promise<Result<{Feature}, ApiError>> => {
    return this.#repository.getById(id);
  };

  // 클라이언트 검증이 필요한 경우 → Policy 사용
  create = async (input: CreateInput): Promise<Result<{Feature}, {Feature}ServiceError>> => {
    if (!{Feature}Policy.someRule(input.value)) {
      return err({Feature}Errors.invalidInput());
    }
    return this.#repository.create(input);
  };
}
```

### 6. Query Keys

```typescript
// presentations/constants/{feature}-query-keys.constant.ts
export const {FEATURE}_QUERY_KEYS = {
  all: ['{feature}'] as const,
  list: () => [...{FEATURE}_QUERY_KEYS.all, 'list'] as const,
  detail: (id: string) => [...{FEATURE}_QUERY_KEYS.all, 'detail', id] as const,
} as const;
```

### 7. Query/Mutation Options

```typescript
// presentations/queries/get-{feature}-query-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';
import { unwrap } from '@src/shared/errors/result';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const get{Feature}QueryOptions = (id: string) => {
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
// presentations/queries/create-{feature}-mutation-options.ts
import { use{Feature}Service } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@src/shared/errors/result';
import { isApiError } from '@src/shared/errors/api-error';
import { ErrorCode } from '@src/shared/errors';
import { is{Feature}Error } from '../models/{feature}.error';
import { {FEATURE}_QUERY_KEYS } from '../constants/{feature}-query-keys.constant';

export const create{Feature}MutationOptions = () => {
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

      // 2. 서버 비즈니스 에러 (Repository → ApiError)
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
| `ok(value)` | 성공 Result 생성 | Repository, Service |
| `err(error)` | 실패 Result 생성 | Repository (ApiError), Service ({Feature}Error) |
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
| 예기치 못한 에러 | `ParseError` | `throw` | ErrorBoundary (자동) | Zod safeParse 실패 (Repository에서) |
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

Repository 구현체에서 서버 응답을 Zod로 검증할 때 발생. **예기치 못한 에러**로 분류.

```typescript
// Repository.impl에서 발생
const parsed = schema.safeParse(result.value);
if (!parsed.success) {
  throw new ParseError(); // → ErrorBoundary로 전파
}
```

### 핵심 규칙

- **InfraError는 throw** — 복구 불가능한 에러이므로 ErrorBoundary가 자동 처리
- **ApiError는 Result** — 서버가 내려준 비즈니스 에러, Service가 번역하지 않고 pass-through
- **{Feature}Error는 Result** — 클라이언트 Policy 검증 실패, Service에서 생성
- **{Feature}Error는 서버 호출 전 차단** — Policy 기반 클라이언트 검증, 불필요한 네트워크 요청 방지
- **ParseError는 Repository에서 throw** — Zod safeParse 실패 시 InfraError로 분류
- **Service는 서버 에러를 번역하지 않는다** — ErrorCode 기반 분기는 Mutation에서 담당

---

## 파일 네이밍 규칙

| 파일 유형 | 패턴 | 예시 |
|----------|------|------|
| 모델 | `{feature}.model.ts` | `todo.model.ts` |
| 에러 | `{feature}.error.ts` | `todo.error.ts` |
| 서비스 | `{feature}.service.ts` | `todo.service.ts` |
| 매퍼 | `{feature}.mapper.ts` | `todo.mapper.ts` (repositories/ 하위) |
| Repository 인터페이스 | `{feature}.repository.ts` | `todo.repository.ts` |
| Repository 구현 | `{feature}.repository.impl.ts` | `todo.repository.impl.ts` |
| Query Options | `{action}-query-options.ts` | `get-todos-query-options.ts` |
| Mutation Options | `{action}-mutation-options.ts` | `create-todo-mutation-options.ts` |
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

### 2단계: 데이터 레이어
- [ ] `features/{feature}/repositories/{feature}.mapper.ts` 생성
  - DTO → Domain 변환 함수 (standalone 함수)
- [ ] `features/{feature}/repositories/{feature}.repository.ts` 생성
  - Repository 인터페이스 정의 (도메인 타입 반환)
- [ ] `features/{feature}/repositories/{feature}.repository.impl.ts` 생성
  - HttpClient 주입
  - Zod safeParse로 DTO 검증
  - mapper 호출하여 도메인 모델 반환

### 3단계: 비즈니스 로직
- [ ] `features/{feature}/services/{feature}.service.ts` 생성
  - Repository 주입
  - Policy 검증 적용
  - 단순 조회는 pass-through (mapper 호출 X)

### 4단계: DI 등록
- [ ] `bootstrap/providers/di-provider.tsx` 수정
  - Repository 인스턴스 생성
  - Service 인스턴스 생성
  - DIContainer 인터페이스에 추가
  - `use{Feature}Service` 훅 export

### 5단계: Presentation
- [ ] `features/{feature}/presentations/constants/{feature}-query-keys.constant.ts` 생성
- [ ] `features/{feature}/presentations/queries/` 에 Query/Mutation Options 생성
- [ ] `features/{feature}/presentations/components/` 에 컴포넌트 생성

### 6단계: 라우트
- [ ] `app/` 하위에 화면 추가

---

## 의존성 방향

```
           Model (Domain)  ← 핵심, 외부 의존 없음
          ↑   ↑   ↑   ↑
    UI  Service  Repo  Repo.impl+Mapper
     ↓     ↓      ↑        ↓
     Service    Repo.impl  HttpClient (Port)
                              ↓
                        KyHttpClient (Adapter)
```

**규칙:**
- 모든 레이어 → Model 의존 (OK)
- UI → Service → Repository 인터페이스 (OK)
- Repository.impl → Repository 인터페이스 구현 (OK)
- **역방향 의존 금지** — Model이 다른 레이어를 알면 안 됨
