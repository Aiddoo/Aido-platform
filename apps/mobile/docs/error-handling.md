# 모바일 에러 처리 가이드

이 문서는 모바일 앱의 에러 처리 체계를 설명합니다.

---

## 에러 분류 체계

### 1. 서버 에러 (ApiError)

서버 HTTP 응답(4xx, 5xx)에서 발생하는 에러입니다.

```typescript
// 위치: shared/errors/api-error.ts
export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(
    public readonly code: string,    // 서버 에러 코드 (AUTH_0101, TODO_0801 등)
    message: string,                  // 사용자 메시지
    public readonly status: number,   // HTTP 상태 코드
  ) {
    super(message);
  }
}
```

**특징:**
- `code`: 서버에서 정의한 에러 코드 (예: `AUTH_0101`, `FOLLOW_0901`)
- `message`: 사용자에게 표시할 메시지 (error-handler.ts에서 매핑)
- `status`: HTTP 상태 코드 (401, 404, 500 등)

**헬퍼 메서드:**
- `hasCode(code)`: 특정 에러 코드인지 확인
- `isDomain(prefix)`: 특정 도메인 에러인지 확인 (예: `err.isDomain('AUTH_')`)

### 2. 클라이언트 에러 (ClientError)

앱 내부에서 발생하는 에러입니다 (네이티브 SDK, 입력 검증, 네트워크 등).

```typescript
// 위치: shared/errors/client-error.ts
export abstract class ClientError extends Error {
  abstract readonly name: string;
  abstract readonly code: string;  // UPPER_SNAKE_CASE
  
  constructor(message: string) {
    super(message);
  }
}
```

---

## 에러 흐름도

```
서버 에러 흐름:
┌──────────────────────────────────────────────────────────────┐
│  HTTP 응답 (4xx/5xx)                                         │
│       ↓                                                      │
│  error-handler.ts (AfterResponseHook)                        │
│       ↓ MOBILE_ERROR_MESSAGES[code] 매핑                     │
│  throw new ApiError(code, userMessage, status)               │
│       ↓                                                      │
│  TanStack Query onError → UI 처리                            │
└──────────────────────────────────────────────────────────────┘

클라이언트 에러 흐름:
┌──────────────────────────────────────────────────────────────┐
│  네이티브 SDK (Expo)      Repository (Zod)      Service      │
│       ↓                        ↓                   ↓         │
│  fromExpoError()         validation 실패      cancelled      │
│       ↓                        ↓                   ↓         │
│  throw DomainError (AuthCancelledError, ValidationError 등)  │
│       ↓                                                      │
│  TanStack Query onError → UI 처리                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 도메인 에러 작성 규칙

### 디렉토리 구조

```
features/
└── {domain}/
    └── models/
        └── {domain}.error.ts
```

### 기본 패턴

```typescript
import { ClientError } from '@src/shared/errors';

// ============================================
// {Domain} 도메인 에러 (클라이언트 검증용)
// ============================================

/** 도메인 기본 에러 */
export class {Domain}Error extends ClientError {
  override readonly name: string = '{Domain}Error';
  readonly code: string = '{DOMAIN}_ERROR';

  constructor(message: string = '기본 에러 메시지') {
    super(message);
  }
}

/** 구체적인 에러 서브클래스 */
export class {Domain}ValidationError extends {Domain}Error {
  override readonly name = '{Domain}ValidationError';
  override readonly code = '{DOMAIN}_VALIDATION';

  constructor() {
    super('잘못된 응답 형식이에요');
  }
}

// 타입 가드
export const is{Domain}Error = (error: unknown): error is {Domain}Error =>
  error instanceof {Domain}Error;
```

### 네이밍 컨벤션

| 요소 | 규칙 | 예시 |
|------|------|------|
| 클래스명 | PascalCase | `AuthCancelledError`, `InvalidTagError` |
| code 필드 | UPPER_SNAKE_CASE | `AUTH_CANCELLED`, `INVALID_TAG` |
| 타입 가드 | is + 클래스명 | `isAuthError`, `isFriendError` |

### 일반적인 클라이언트 에러 카테고리

| 카테고리 | 설명 | code 접미사 예시 |
|---------|------|-----------------|
| Validation | 입력/응답 검증 실패 | `_VALIDATION` |
| Network | 네트워크 연결 문제 | `_NETWORK` |
| Cancelled | 사용자 작업 취소 | `_CANCELLED` |
| Permission | 권한 부족 (로컬) | `_PERMISSION` |

---

## SDK 에러 변환 패턴

외부 SDK 에러를 도메인 에러로 변환할 때 사용합니다.

```typescript
import { match } from 'ts-pattern';

/** Expo 에러 코드 정의 */
const SdkErrorCode = {
  REQUEST_CANCELED: 'ERR_REQUEST_CANCELED',
  REQUEST_FAILED: 'ERR_REQUEST_FAILED',
  // ...
} as const;

type SdkErrorCodeType = (typeof SdkErrorCode)[keyof typeof SdkErrorCode];

export class SomeAuthError extends AuthError {
  /** SDK 에러 → 도메인 에러 변환 */
  static fromSdkError(error: SdkCodedError): AuthError {
    return match(error.code as SdkErrorCodeType)
      .with(SdkErrorCode.REQUEST_CANCELED, () => new AuthCancelledError())
      .with(SdkErrorCode.REQUEST_FAILED, () => 
        new SomeAuthError('인증 정보가 올바르지 않아요'))
      .otherwise(() => new AuthError(error.message));
  }
}
```

**핵심 포인트:**
- `ts-pattern`의 `match`로 에러 코드별 분기
- 취소는 별도 에러 클래스 (`AuthCancelledError`)로 분리
- `otherwise()`로 예상치 못한 에러 처리

---

## UI 에러 처리 패턴

### TanStack Query Mutation onError

```typescript
import { isApiError, isClientError } from '@src/shared/errors';
import { AuthCancelledError, isAuthError } from '@src/features/auth/models/auth.error';

const mutation = useMutation({
  mutationFn: someAsyncFunction,
  onError: (err) => {
    // 1. 사용자 취소: 토스트 생략
    if (err instanceof AuthCancelledError) {
      return;
    }
    
    // 2. 서버 에러: 사용자 메시지 표시
    if (isApiError(err)) {
      toast.error(err.message);
      
      // 필요시 특정 에러 코드 처리
      if (err.hasCode('FOLLOW_0901')) {
        // 이미 친구 요청을 보낸 경우 특수 처리
      }
      return;
    }
    
    // 3. 클라이언트 에러: 사용자 메시지 표시
    if (isClientError(err)) {
      toast.error(err.message);
      return;
    }
    
    // 4. 예상치 못한 에러
    toast.error('알 수 없는 오류가 발생했어요');
  },
});
```

### 에러 처리 우선순위

1. **사용자 취소** → 무시 (토스트 없음)
2. **서버 에러 (ApiError)** → `err.message` 표시
3. **클라이언트 에러 (ClientError)** → `err.message` 표시
4. **예상치 못한 에러** → 기본 메시지 표시

### 서버 에러 도메인별 분기

```typescript
if (isApiError(err)) {
  // 인증 관련 서버 에러
  if (err.isDomain('AUTH_')) {
    // 로그아웃 처리 등
  }
  
  // 특정 에러 코드
  if (err.hasCode('USER_0607')) {
    // 계정 잠김 처리
  }
  
  toast.error(err.message);
}
```

---

## 서비스 레이어 에러 처리

### Repository에서 에러 throw

```typescript
// features/{domain}/infra/{domain}.repository.impl.ts

async function fetchData(): Promise<Data> {
  const response = await api.get('endpoint').json<unknown>();
  
  // Zod 파싱 실패 시 ValidationError throw
  const result = DataSchema.safeParse(response);
  if (!result.success) {
    throw new DomainValidationError();
  }
  
  return result.data;
}
```

### Service에서 에러 변환

```typescript
// features/{domain}/services/{domain}.service.ts

async function performSdkAction(): Promise<Result> {
  try {
    const sdkResult = await nativeSdk.doSomething();
    return transformResult(sdkResult);
  } catch (error) {
    // SDK 에러 → 도메인 에러 변환
    if (isSdkCodedError(error)) {
      throw DomainError.fromSdkError(error);
    }
    throw error;
  }
}
```

---

## 타입 가드 사용

### 기본 타입 가드

```typescript
import { isApiError, isClientError } from '@src/shared/errors';
import { isAuthError } from '@src/features/auth/models/auth.error';

function handleError(error: unknown) {
  if (isApiError(error)) {
    // error는 ApiError 타입
    console.log(error.code, error.status);
  }
  
  if (isClientError(error)) {
    // error는 ClientError 타입
    console.log(error.code);
  }
  
  if (isAuthError(error)) {
    // error는 AuthError 타입 (또는 서브클래스)
    console.log(error.code);
  }
}
```

### instanceof로 구체적 분기

```typescript
if (error instanceof AuthCancelledError) {
  // 취소 처리
} else if (error instanceof AuthNetworkError) {
  // 네트워크 에러 처리
} else if (error instanceof AuthValidationError) {
  // 검증 에러 처리
}
```

---

## 체크리스트

### 새 도메인 에러 추가 시

- [ ] `features/{domain}/models/{domain}.error.ts` 파일 생성
- [ ] 기본 에러 클래스가 `ClientError` 상속
- [ ] `name`, `code` 필드 정의 (override)
- [ ] 타입 가드 함수 export (`is{Domain}Error`)
- [ ] 필요한 서브클래스 정의 (Validation, Cancelled 등)

### SDK 에러 변환 추가 시

- [ ] SDK 에러 코드 상수 정의
- [ ] `ExpoCodedError` 유사 인터페이스 정의
- [ ] `fromSdkError` 정적 메서드 구현
- [ ] `ts-pattern` match로 코드별 분기
- [ ] 취소는 별도 에러 클래스로 분리

### UI 에러 처리 시

- [ ] 사용자 취소 먼저 체크 (토스트 생략)
- [ ] `isApiError` → `isClientError` 순서로 체크
- [ ] 예상치 못한 에러용 기본 메시지 제공
- [ ] 필요시 `hasCode()`, `isDomain()`으로 특수 처리

---

## 참고 파일

| 파일 | 설명 |
|------|------|
| `shared/errors/client-error.ts` | ClientError 추상 클래스 |
| `shared/errors/api-error.ts` | ApiError 클래스 |
| `shared/infra/http/error-handler.ts` | 서버 에러 매핑 |
| `features/auth/models/auth.error.ts` | Auth 도메인 에러 (참고용) |
