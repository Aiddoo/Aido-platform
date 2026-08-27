# Mobile App Architecture Guide

**Version**: 1.1.0 · **Last Updated**: 2026-08-26 · **Owner**: Aido Mobile Team

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

| Port            | 구현체                                                    | 위치                                     |
| --------------- | --------------------------------------------------------- | ---------------------------------------- |
| `HttpClient`    | `KyHttpClient`                                            | `shared/infra/http/ky-client.ts`         |
| `Storage`       | `SecureStorage`                                           | `shared/infra/storage/secure-storage.ts` |
| `Logger`        | `ConsoleLogger` / `SentryLogger`(prod, composite)         | `shared/infra/logger/`                   |
| `Analytics`     | `FirebaseAnalytics`(prod) / `ConsoleAnalytics`(dev)       | `shared/infra/analytics/`                |
| `ErrorReporter` | `SentryErrorReporter`(prod) / `ConsoleErrorReporter`(dev) | `shared/infra/error-reporter/`           |

> 포트는 `core/ports/`에 정의, 벤더(`@sentry/*`·`@react-native-firebase/*`) 코드는 어댑터에만 격리. core/도메인/presentation은 벤더를 직접 import하지 않는다.

| 클라이언트                  | 용도                                 |
| --------------------------- | ------------------------------------ |
| `createPublicClient()`      | 인증 전 요청 (로그인, 회원가입)      |
| `createAuthClient(storage)` | 인증 후 요청 (Bearer 토큰 자동 첨부) |

### 관측(Observability) 스택

역할을 **분리**하되 타입 어휘를 통일한다. 상세 규칙: [observability.md](./observability.md)

| 도구                   | 담당                                                   | 진입점                                                                     |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Sentry**             | 크래시·에러·검색가능 이벤트·breadcrumb (severity 판정) | `ErrorReporter` 포트 (`captureException`/`captureMessage`/`addBreadcrumb`) |
| **Firebase Analytics** | 제품 지표(이벤트/화면/유저 속성)                       | `Analytics` 포트 + 타입 카탈로그 `track()`/`useTrack()`                    |

- **Crashlytics는 사용하지 않는다** (Sentry로 크래시까지 일원화, 2026-07 정리).
- Breadcrumb 카테고리는 `BreadcrumbCategory` union(`http`·`navigation`·…)으로 고정 — 매직 문자열 금지.
- Analytics 이벤트는 `AppEventMap`(`shared/analytics/events/*.events.ts`)에만 정의, raw `trackEvent` 직접호출 금지.

---

## 에러 시스템

### 예측 가능 vs 예측 불가능

| 구분            | 에러 종류                                          | 처리 방식                         |
| --------------- | -------------------------------------------------- | --------------------------------- |
| **예측 가능**   | 서버 비즈니스 에러 (4xx), 클라이언트 검증 에러     | `Result.err()` 반환 → UI가 핸들링 |
| **예측 불가능** | 서버 장애 (5xx), 네트워크, 타임아웃, 스키마 불일치 | `throw` → ErrorBoundary가 catch   |

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
  { ok: true; value: T } | { ok: false; error: E };

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

### 화면 조립과 서버 상태

- route 화면은 주요 섹션을 JSX에서 바로 조립해 화면 구성을 파일 진입점에서 읽을 수 있게 한다.
- route의 `todoId`, search param, 현재 mode 같은 화면 식별자를 여러 단계의 props로 배포하지 않는다.
  feature block이 검증된 Expo Router hook에서 직접 읽고, 이미 조회된 row 데이터나 순수 layout 값만 props로
  받는다.
- 서버 상태는 `queryOptions`/`infiniteQueryOptions`/`mutationOptions` factory로 정의한다. component는
  식별자를 읽어 factory를 호출하되 query key, queryFn, cache 정책을 인라인으로 만들지 않는다.
- 옵션 팩토리의 인자는 `{ todoId, sort, focusCommentId }`처럼 이름 있는 객체로 받고, query key에도
  같은 직렬화 가능한 객체를 넣는다. 이 저장소는 Expo Router + TanStack Query + Ky를 사용하므로
  TanStack Router의 `loaderDeps`나 oRPC 패턴을 억지로 추가하지 않는다. 전환 전 데이터가 필요하면
  기존 query options로 prefetch한 뒤 URL search state를 바꾼다.
- 특정 목록에만 결합된 `Loading`, `Error`, `Empty`, `Item`은 `TodoComments.Loading`처럼 compound
  namespace로 묶는다. 독립적으로 재사용되지 않는 상태 UI를 전역 이름으로 흩뜨리지 않는다.
- 한 화면 block에서만 의미가 있는 작은 조립 조각은 소유 파일의 지역 컴포넌트로 둔다. 둘 이상의
  화면 surface가 공유할 때만 독립 파일로 승격하고, 함께 바뀌는 목록·행·작성기 family는 같은 하위
  폴더에 모은다. 폴더 `index.ts` re-export는 만들지 않고 정의 파일에서 직접 import한다.
- form과 wire schema는 가능한 한 `@aido/validators`를 단일 원본으로 사용한다. 모바일 전용 Date,
  policy, 화면 view-model만 model/mapper에서 별도로 표현한다.
- 페이지 단위 폼은 가장 가까운 session 부모가 `useForm`, Zod resolver, submit mutation을 소유하고
  지역 `FormProvider`로 field에 전달한다. field는 `useController`, 액션은 `useFormState`/`useWatch`의
  좁은 구독을 사용한다. 폼 값을 전역 Context나 별도 전역 상태에 복제하지 않는다.
- hook은 라우트 읽기, 전환 조정, mutation 상태, field focus처럼 하나의 변화 이유만 갖는다. 계산은
  순수 함수/Policy로 빼고 화면 hook은 작은 계약을 조합한다. 한 컴포넌트에서만 쓰는 작은 hook은
  소유 파일에 둘 수 있다.
- 날짜 표시는 `shared/utils/date`의 로케일 포맷을 재사용하고 오늘 기준은 `useToday`/`useTodayKey`로
  읽는다. render 중 `new Date()`를 기준 상태로 만들지 않는다. Expo static web output을 요청 단위
  SSR로 가정해 별도 `Intl` 계층을 중복 구현하지 않는다.
- 미디어 업로드는 실제 API 계약이 있을 때만 도입한다. Expo 호환성과 유지 상태가 검증된 라이브러리를
  우선하고, 없다면 선택·검증·전송을 각각 작은 hook/service로 분리한다. API가 없는 기능을 미리 만들지 않는다.
- 상세 조회와 함께 발생해야 하는 서버 의미(예: 멱등 조회수)는 별도 `useEffect` mutation으로 호출하지 않는다. GET endpoint가 원자적으로 처리한다.
- 알림 wire payload는 `@aido/validators`를 단일 원본으로 사용한다. 내부 화면 경로는
  `presentations/navigation`의 순수 resolver가 검증된 route 재료로 결정한다. domain Policy와 화면
  컴포넌트는 Expo Router나 raw metadata를 알지 않는다.

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

| 구분               | 역할                              | 위치                         |
| ------------------ | --------------------------------- | ---------------------------- |
| **Policy**         | 비즈니스 규칙 (서버 호출 전 검증) | `models/`                    |
| **ViewModel**      | Domain → UI 데이터 변환           | `presentations/view-models/` |
| **Component 상수** | UI 문구, 색상 등                  | 컴포넌트 내부                |

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

UI 표시 문구는 i18n 카탈로그 키를 참조한다 (하드코딩 금지 — [i18n-guide.md](./i18n-guide.md)):

```typescript
// presentations/components/{Feature}Card.tsx
import type { DerivedType } from '../view-models/{feature}.view-model';

// 라벨 맵은 값 대신 i18n 키를 담는다 (satisfies로 enum 누락 방지)
const DERIVED_LABEL_KEYS = {
  typeA: '{feature}:card.gradeTop',
  typeB: '{feature}:card.gradeAlmost',
  typeC: '{feature}:card.gradeStep',
} as const satisfies Record<DerivedType, string>;
// 사용처: t(DERIVED_LABEL_KEYS[type])
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

| 레이어                            | 에러 처리 방식       |
| --------------------------------- | -------------------- |
| Service                           | `Result<T, E>` 반환  |
| Presentation (queryFn/mutationFn) | `unwrap()` 사용      |
| InfraError                        | ErrorBoundary가 처리 |

| 에러 유형                       | 타입 가드                 | 처리 방식             |
| ------------------------------- | ------------------------- | --------------------- |
| **서버 비즈니스 에러 (4xx)**    | `isApiError(error)`       | 토스트 or 코드별 분기 |
| **클라이언트 도메인 에러**      | `is{Feature}Error(error)` | 토스트 or 코드별 분기 |
| **인프라 에러 (5xx, 네트워크)** | -                         | ErrorBoundary가 처리  |

**ApiError 유틸리티**

```typescript
error.hasCode('FEATURE_0001'); // 특정 에러 코드 확인
error.isDomain('FEATURE_'); // 도메인 접두사로 확인
error.message; // 한국어 사용자 친화적 메시지
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
