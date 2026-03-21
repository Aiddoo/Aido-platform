# Mobile App Architecture Guide

Feature-based Layered Architecture 기반 React Native/Expo 앱입니다.
새 기능 추가 시 이 문서의 패턴을 **반드시** 따릅니다.

---

## 디렉토리 구조

```
src/
├── bootstrap/providers/          # 앱 초기화 (DI, Auth, Query 등)
│   ├── di-provider.tsx           # 의존성 주입 컨테이너
│   ├── auth-provider.tsx         # 인증 상태 관리
│   ├── query-provider.tsx        # TanStack Query 설정
│   └── ...
│
├── core/ports/                   # Port 인터페이스 (외부 의존성 추상화)
│   ├── http.ts                   # HttpClient
│   ├── storage.ts                # Storage
│   └── logger.ts                 # Logger
│
├── features/{feature}/           # 기능별 모듈
│   ├── models/                   # Domain Model + Policy + Error
│   ├── services/                 # Service + Mapper (HTTP + Zod + 변환 + Policy)
│   ├── __tests__/                # 테스트 팩토리
│   └── presentations/            # UI (queries, components, hooks)
│
└── shared/
    ├── errors/                   # Result, ApiError, InfraError
    ├── hooks/                    # 공유 React 훅
    ├── infra/                    # Port 구현체
    ├── ui/                       # 공유 UI 컴포넌트
    ├── config/                   # 환경 설정
    └── utils/                    # 유틸리티
```

> **예외**: `DeviceIdRepository`는 HTTP가 아닌 SecureStore 로컬 스토리지에 접근하므로 Repository 패턴을 유지한다.
> `features/notification/repositories/device-id.repository.ts` (인터페이스) / `device-id.repository.impl.ts` (구현체)

---

## 의존성 흐름

```
Presentation (components, queries)
  │  use{Feature}Service() 훅으로 서비스 주입
  ▼
Service (HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증)
  │  this.#httpClient.get/post() 호출
  ▼
Infrastructure - Port 구현체 (KyHttpClient, SecureStorage)
```

**핵심 규칙**: 의존성은 항상 안쪽(Domain)을 향합니다.

---

## Core Ports

`src/core/ports/`에 위치하는 인터페이스입니다.

```typescript
// core/ports/http.ts
export interface HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  delete<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
}
```

| Port | 구현체 | 위치 |
|------|--------|------|
| `HttpClient` | `KyHttpClient` | `shared/infra/http/ky-client.ts` |
| `Storage` | `SecureStorage` | `shared/infra/storage/secure-storage.ts` |
| `Logger` | `ConsoleLogger` | `shared/infra/logger/console-logger.ts` |

| 클라이언트 | 용도 |
|-----------|------|
| `createPublicClient()` | 인증 전 요청 (로그인, 회원가입) |
| `createAuthClient(storage)` | 인증 후 요청 (Bearer 토큰 자동 첨부) |

---

## 에러 시스템

### 예측 가능 vs 예측 불가능

| 구분 | 에러 종류 | 처리 방식 |
|------|----------|----------|
| **예측 가능** | 서버 비즈니스 에러 (4xx), 클라이언트 검증 에러 | `Result.err()` 반환 → UI가 핸들링 |
| **예측 불가능** | 서버 장애 (5xx), 네트워크, 타임아웃, 스키마 불일치 | `throw` → ErrorBoundary가 catch |

### 에러 계층

```
예측 가능 (Result.err로 반환)
─────────────────────────────
  BusinessError (interface)
    ├── ApiError              ← 서버 4xx 비즈니스 에러
    └── {Feature}Error        ← 클라이언트 도메인 에러

예측 불가능 (throw)
─────────────────────────────
  InfraError (abstract class)
    ├── ServerError           ← 5xx
    ├── NetworkError          ← 인터넷 연결 끊김
    ├── TimeoutError          ← 요청 시간 초과
    └── ParseError            ← Zod 응답 검증 실패
```

### Result 타입

```typescript
export type Result<T, E extends BusinessError = BusinessError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends BusinessError>(error: E): Result<never, E> => ({ ok: false, error });
export const unwrap = <T, E extends BusinessError>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};
```

---

## 레이어별 규칙

### 1. Models — Domain Model + Policy + Error

```
features/{feature}/models/
├── {feature}.model.ts    # Zod 스키마 + 타입 + Policy
└── {feature}.error.ts    # ErrorCode + Error + Factory + Guard
```

**Domain Model**: Zod 스키마로 정의, 서버 DTO와 독립적.
서버 응답 구조가 변경되어도 Mapper만 수정하면 되고, 앱 전체(Service, Presentation)에 영향이 퍼지지 않는다.

```typescript
// {feature}.model.ts
export const {feature}Schema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.date(),  // 서버는 string, Mapper에서 변환
});
export type {Feature} = z.infer<typeof {feature}Schema>;
```

**Policy**: 비즈니스 규칙의 유일한 거처 (순수 함수, 객체 리터럴)

비즈니스 규칙(제한 수량, 유효성 조건, 상태 판단 등)의 변경 지점을 Policy 한 곳으로 응집시킨다.
요구사항이 변경되거나 추가될 때 Policy만 수정하면 Service, Presentation 어디에서 사용하든 일괄 반영된다.

```typescript
export const {Feature}Policy = {
  // 상태 판단
  is{상태}: (item: {Feature}): boolean => /* 조건 */,
  // 가능 여부
  can{동작}: (item: {Feature}): boolean => /* 조건 */,
  // 유효성 검증
  isValid{대상}: (value: string): boolean => /* 검증 */,
  // 비즈니스 상수
  MAX_{대상}: number,
} as const;
```

**Domain Error**: 클라이언트 비즈니스 에러 (서버 에러 `ApiError`와 완전히 별개)

폼 필드 유효성 검증(길이, 형식 등)은 Zod + react-hook-form에 위임한다.
Domain Error는 그 너머의 **비즈니스 규칙 위반** — Policy 검증 실패 시 Service가 서버 호출 전에 생성하여 불필요한 네트워크 요청을 차단한다.

예시:
- 자기 자신에게 친구 요청 시도 → 서버까지 갈 필요 없이 차단
- 일일 사용 한도 초과 상태에서 요청 시도 → 클라이언트에서 즉시 차단
- 빈 값이 아닌데 도메인 규칙에 맞지 않는 입력 (태그 형식 불일치 등) → 차단

```typescript
// {feature}.error.ts
export const {Feature}ErrorCode = {
  INVALID_INPUT: '{FEATURE}_INVALID_INPUT',
} as const;

export class {Feature}Error extends Error implements BusinessError {
  override readonly name = '{Feature}Error';
  constructor(public readonly code: {Feature}ErrorCode, message: string) {
    super(message);
  }
}

export const {Feature}Errors = {
  invalidInput: () => new {Feature}Error({Feature}ErrorCode.INVALID_INPUT, '입력값이 올바르지 않아요'),
} as const;

export const is{Feature}Error = (error: unknown): error is {Feature}Error =>
  error instanceof {Feature}Error;
```

### 2. Services — HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증

```
features/{feature}/services/
├── {feature}.service.ts    # Service 클래스
└── {feature}.mapper.ts     # DTO → Domain 순수 함수
```

**Service**: HttpClient를 직접 주입받아 HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 수행

```typescript
export class {Feature}Service {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 패턴 A: HTTP + Zod + Mapper
  get{Feature}s = async (params: Get{Feature}sQuery): Promise<Result<{Feature}sResult, ApiError>> => {
    // 1. API 호출
    const result = await this.#httpClient.get<{Feature}ListResponse>('v1/{feature}s', { params });

    // 2. 서버 비즈니스 에러(4xx) 전파
    if (!result.ok) {
      return result;
    }

    // 3. Zod 응답 검증
    const parsed = {feature}ListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid get{Feature}s response: ${parsed.error.message}`);
    }

    // 4. Mapper 변환 + ok() 반환
    return ok(to{Feature}sResult(parsed.data));
  };

  // 패턴 B: Policy + HTTP + Zod + Mapper
  create{Feature} = async (params: Create{Feature}Input): Promise<Result<{Feature}, {Feature}ServiceError>> => {
    if (!{Feature}Policy.isValidInput(params.name)) {
      return err({Feature}Errors.invalidInput());
    }

    const result = await this.#httpClient.post<{Feature}Response>('v1/{feature}s', params);
    if (!result.ok) {
      return result;
    }

    const parsed = {feature}ResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid create{Feature} response: ${parsed.error.message}`);
    }

    return ok(to{Feature}(parsed.data));
  };
}
```

**Mapper**: 순수 함수, DTO → Domain 변환

서버 DTO를 클라이언트 Domain Model로 변환하는 유일한 지점이다.
Domain Model이 서버 DTO와 독립적일 수 있는 이유가 바로 이 Mapper 덕분이며, 서버 응답 구조가 변경되더라도 Mapper만 수정하면 Service와 Presentation 계층은 영향을 받지 않는다.

```typescript
export const to{Feature} = (dto: {Feature}DTO): {Feature} => ({
  id: dto.id,
  name: dto.name,
  createdAt: new Date(dto.createdAt),  // string → Date
});

export const to{Feature}s = (dtos: {Feature}DTO[]): {Feature}[] => dtos.map(to{Feature});
```

### 3. Presentations — UI 계층

```
features/{feature}/presentations/
├── constants/{feature}-query-keys.constant.ts
├── view-models/
│   └── {feature}.view-model.ts   # Domain → UI 데이터 변환
├── queries/
│   ├── get-{feature}s-query-options.ts
│   └── create-{feature}-mutation-options.ts
├── components/
│   └── {Feature}List.tsx
├── schemas/              # 폼 스키마 (필요 시)
└── hooks/                # 커스텀 훅 (필요 시)
```

#### ViewModel — Domain → UI 데이터 변환

Domain 모델을 UI 표시용 데이터로 변환하는 순수 함수. Query Options의 `select`에서 호출한다.

| 구분 | 역할 | 위치 |
|------|------|------|
| **Policy** | 비즈니스 규칙 (서버 호출 전 검증) | `models/` |
| **ViewModel** | Domain → UI 데이터 변환 | `presentations/view-models/` |
| **Component 상수** | UI 문구, 색상 등 | 컴포넌트 내부 |

단순 변환(필드 하나 추가, 포맷팅)은 `select` 인라인으로 처리하고, 복잡하거나(조건 분기 2개+) 재사용이 필요하면 view-model 파일로 분리한다.

```typescript
// 단순한 경우: view-model 파일 없이 select에서 직접 처리
export const useGet{Feature}sQueryOptions = () => {
  // ...
  return queryOptions({
    // ...
    select: (items) => items.map((item) => ({
      ...item,
      isNew: Date.now() - item.createdAt.getTime() < 24 * 60 * 60 * 1000,
    })),
  });
};
```

**ViewModel 패턴**

```typescript
// presentations/view-models/{feature}.view-model.ts
import type { {Feature} } from '../../models/{feature}.model';

export type DerivedType = 'typeA' | 'typeB' | 'typeC';

// 도메인 값 → UI에서 사용할 파생 타입으로 변환
export function getDerivedType(value: number): DerivedType {
  if (value === 100) {
    return 'typeA';
  }
  if (value >= 90) {
    return 'typeB';
  }
  return 'typeC';
}

export interface {Feature}ViewModel extends {Feature} {
  derivedType: DerivedType;
}

export function to{Feature}ViewModel(item: {Feature}): {Feature}ViewModel {
  return {
    ...item,
    derivedType: getDerivedType(item.value),
  };
}
```

**Query Options에서 select로 ViewModel 적용**

```typescript
// presentations/queries/use-get-{feature}s-query-options.ts
import { to{Feature}ViewModel } from '../view-models/{feature}.view-model';

export const useGet{Feature}sQueryOptions = () => {
  const service = use{Feature}Service();

  return queryOptions({
    queryKey: {FEATURE}_QUERY_KEYS.lists(),
    queryFn: async () => unwrap(await service.get{Feature}s()),
    select: (data) => data.map(to{Feature}ViewModel),  // ← ViewModel 변환
  });
};
```

**Component에서 UI 표시 문구 관리**

```typescript
// presentations/components/{Feature}Card.tsx
import type { DerivedType } from '../view-models/{feature}.view-model';

// UI 표시 문구는 컴포넌트 내부 상수로 관리
const DERIVED_LABEL: Record<DerivedType, string> = {
  typeA: '최고 등급입니다',
  typeB: '거의 달성했어요',
  typeC: '한 걸음 전진했어요',
};
```

**Query Keys**

```typescript
export const {FEATURE}_QUERY_KEYS = {
  all: ['{feature}'] as const,
  lists: () => [...{FEATURE}_QUERY_KEYS.all, 'list'] as const,
  listByDate: (date: string) => [...{FEATURE}_QUERY_KEYS.lists(), date] as const,
} as const;
```

**Query Options**

```typescript
// Query — unwrap 사용
export const get{Feature}sQueryOptions = () => {
  const {feature}Service = use{Feature}Service();
  return queryOptions({
    queryKey: {FEATURE}_QUERY_KEYS.lists(),
    queryFn: async () => unwrap(await {feature}Service.get{Feature}s()),
  });
};
```

**Mutation 에러 처리**

`mutationFn`에서 **반드시** `unwrap()`을 사용합니다.

> ⚠️ **왜 Result를 직접 반환하면 안 되나요?**
>
> React Query는 `mutationFn`이 throw하지 않으면 **성공**으로 간주합니다.
> `Result.err()`를 반환해도 React Query 입장에서는 정상 반환이므로 `onSuccess`가 호출됩니다.
> 따라서 `unwrap()`으로 에러를 throw해야 `onError` 콜백이 올바르게 동작합니다.

**에러 처리 흐름**

```
HTTP 요청
    ↓
[KyHttpClient]
    ├─ 4xx → return err(ApiError)      ← 예측 가능
    ├─ 5xx → throw ServerError         ← 예측 불가능
    ├─ 타임아웃 → throw TimeoutError   ← 예측 불가능
    └─ 네트워크 → throw NetworkError   ← 예측 불가능
    ↓
[Service] → Result 그대로 전파 (또는 추가 검증 후 err 반환)
    ↓
[Presentation - mutationFn]
    unwrap(result)
    ├─ result.ok → 값 반환 → onSuccess
    └─ result.err → throw → onError
    ↓
[onError 콜백]
    ├─ isApiError(error) → 토스트 또는 코드별 분기
    ├─ is{Feature}Error(error) → 토스트 또는 코드별 분기
    └─ InfraError → ErrorBoundary (re-throw)
```

---

**기본 Mutation 예제**

```typescript
export const create{Feature}MutationOptions = () => {
  const {feature}Service = use{Feature}Service();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: Create{Feature}Input) => {
      return unwrap(await {feature}Service.create{Feature}(params));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {FEATURE}_QUERY_KEYS.all });
      toast.success('생성되었어요');
    },
    onError: (error) => {
      // ApiError, {Feature}Error 모두 message에 사용자 친화적 메시지가 있음
      if (isApiError(error) || is{Feature}Error(error)) {
        toast.error(error.message);
      }
      // InfraError는 QueryErrorBoundary가 처리
    },
  });
};
```

---

**에러 코드별 분기가 필요한 경우**

특정 에러 코드에 따라 다른 동작이 필요하면 `onError`에서 분기합니다.

```typescript
onError: (error) => {
  // 1. 서버 비즈니스 에러 (4xx)
  if (isApiError(error)) {
    if (error.hasCode('FEATURE_0001')) {
      // 특정 에러 코드에 대한 커스텀 처리
      return;
    }
    if (error.isDomain('FEATURE_')) {
      // 도메인 접두사로 분기
      return;
    }
    toast.error(error.message);
    return;
  }

  // 2. 클라이언트 도메인 에러
  if (is{Feature}Error(error)) {
    if (error.code === {Feature}ErrorCode.INVALID_INPUT) {
      // 특정 에러에 대한 커스텀 처리
      return;
    }
    toast.error(error.message);
    return;
  }

  // 3. InfraError → re-throw하여 ErrorBoundary로 전파
  throw error;
},
```

---

**에러 유형별 처리 요약**

| 레이어 | 에러 처리 방식 |
|--------|--------------|
| Service | `Result<T, E>` 반환 |
| Presentation (queryFn/mutationFn) | `unwrap()` 사용 |
| InfraError | ErrorBoundary가 처리 |

| 에러 유형 | 타입 가드 | 처리 방식 |
|----------|----------|----------|
| **서버 비즈니스 에러 (4xx)** | `isApiError(error)` | 토스트 or 코드별 분기 |
| **클라이언트 도메인 에러** | `is{Feature}Error(error)` | 토스트 or 코드별 분기 |
| **인프라 에러 (5xx, 네트워크)** | - | ErrorBoundary가 처리 |

**ApiError 유틸리티**

```typescript
error.hasCode('FEATURE_0001')  // 특정 에러 코드 확인
error.isDomain('FEATURE_')     // 도메인 접두사로 확인
error.message                  // 한국어 사용자 친화적 메시지
```

**Component + Loading 서브컴포넌트**

```tsx
export function {Feature}List() {
  const { data } = useSuspenseQuery(get{Feature}sQueryOptions());
  return <FlashList data={data.items} renderItem={({ item }) => <{Feature}Item item={item} />} />;
}

{Feature}List.Loading = function Loading() {
  return <VStack>{times(5, (i) => <Skeleton key={i} />)}</VStack>;
};
```

**사용**

```tsx
<QueryErrorBoundary>
  <Suspense fallback={<{Feature}List.Loading />}>
    <{Feature}List />
  </Suspense>
</QueryErrorBoundary>
```

---

## DI (의존성 주입)

`bootstrap/providers/di-provider.tsx`에서 모든 인스턴스를 생성합니다.

```
Storage → HttpClient → Service → DIContext → use{Feature}Service() 훅
```

**새 Feature 등록**

```typescript
// 1. DIContainer 인터페이스에 추가
export interface DIContainer {
  {feature}Service: {Feature}Service;
}

// 2. useState 초기화에서 생성
const {feature}Service = new {Feature}Service(authHttpClient);

// 3. return에 추가
return { {feature}Service };

// 4. 훅 export 추가
export const use{Feature}Service = () => useDI().{feature}Service;
```

---

## 새 Feature 추가 체크리스트

### Step 1: Models
- [ ] `features/{feature}/models/{feature}.model.ts` — Zod 스키마 + 타입 + Policy
- [ ] `features/{feature}/models/{feature}.error.ts` — ErrorCode + Error + Factory + Guard

### Step 2: Services + Mapper
- [ ] `features/{feature}/services/{feature}.mapper.ts` — DTO → Domain 순수 함수
- [ ] `features/{feature}/services/{feature}.service.ts` — Service 클래스 (HttpClient 주입, HTTP + Zod + Mapper + Policy)

### Step 3: DI 등록
- [ ] `bootstrap/providers/di-provider.tsx` — DIContainer + 인스턴스 + Hook

### Step 4: Presentations
- [ ] `presentations/constants/{feature}-query-keys.constant.ts`
- [ ] (필요 시) `presentations/view-models/{feature}.view-model.ts` — Domain → UI 데이터 변환
- [ ] `presentations/queries/` — Query/Mutation Options (ViewModel이 있으면 `select`에서 적용)
- [ ] `presentations/components/` — UI 컴포넌트
- [ ] (필요 시) `presentations/schemas/` — 폼 스키마
- [ ] (필요 시) `presentations/hooks/` — 커스텀 훅

---

## DO / DON'T

### DO

```typescript
// private 필드는 # 구문
readonly #httpClient: HttpClient;

// Service/Mapper 메서드는 arrow function
get{Feature}s = async (params): Promise<Result<{Feature}sResult, ApiError>> => { ... };

// Service에서 Zod safeParse + ParseError throw
const parsed = schema.safeParse(result.value);
if (!parsed.success) {
  throw new ParseError(`[{Feature}Service] Invalid ... response: ${parsed.error.message}`);
}

// Query options에서 unwrap
queryFn: async () => unwrap(await service.getData());

// mutation onSuccess에서 invalidate
onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.all });

// 예측 가능한 에러(4xx)는 return result (passthrough)
if (!result.ok) {
  return result;
}

// 비즈니스 로직은 Policy 객체에
{Feature}Policy.canEdit(item);

// Loading은 Named Function 서브컴포넌트
MyComponent.Loading = function Loading() { ... };

// Suspense + QueryErrorBoundary 조합
<QueryErrorBoundary>
  <Suspense fallback={<Component.Loading />}>
    <Component />
  </Suspense>
</QueryErrorBoundary>
```

### DON'T

```typescript
// Domain Model에서 서버 DTO 타입을 직접 사용 금지
export type {Feature} = ServerDTO;  // ❌ Mapper로 변환 필수

// Presentation에서 HttpClient 직접 사용 금지
const http = useDI().httpClient;  // ❌ Service를 통해서만

// Presentation에서 Service 우회 금지
const repo = useDI().{feature}Repository;  // ❌ Service를 통해서만

// 컴포넌트에서 Result 직접 다루기 금지
if (result.ok) { ... }  // ❌ unwrap 사용

// 컴포넌트에 비즈니스 로직 넣기 금지
const canEdit = Date.now() - item.createdAt < 24 * 60 * 60 * 1000;  // ❌ Policy 사용

// Query key 하드코딩 금지
queryKey: ['{feature}', 'list'];  // ❌ QUERY_KEYS 상수 사용

// InfraError catch 금지 (ErrorBoundary가 처리)
try { ... } catch (e) { if (e instanceof ServerError) ... }  // ❌

// Policy를 class로 만들기 금지
class {Feature}Policy { ... }  // ❌ 객체 리터럴 사용
```
