# 에러 처리 가이드

**Version**: 1.1.0 · **Last Updated**: 2026-07-06 · **Owner**: Aido Mobile Team

> Result 타입 · ApiError · BusinessError · ErrorBoundary 분류 체계.

## 핵심 원칙

> **"이 에러를 UI가 예상하고 있는가?"**

```
예상한 에러 (Result로 전달)
├── Track 1: ApiError (서버 4xx)      — 이미 친구, 인증 코드 만료, 중복 가입
└── Track 2: BusinessError (클라이언트) — 태그 형식 오류, 로그인 취소, SDK 에러

예상하지 못한 에러 (throw)
└── Track 3: InfraError               — 5xx, 네트워크 끊김, 타임아웃, 파싱 실패
```

| 트랙    | 에러 타입                     | 전달 방식                    | 처리 위치              |
| ------- | ----------------------------- | ---------------------------- | ---------------------- |
| Track 1 | `ApiError` (4xx)              | `err()` → `unwrap()` → throw | Mutation `onError`     |
| Track 2 | `{Feature}Error` (Policy/SDK) | `err()` → `unwrap()` → throw | Mutation `onError`     |
| Track 3 | `InfraError` (5xx/네트워크)   | 직접 `throw`                 | `<QueryErrorBoundary>` |

- 예상한 에러: 사용자에게 구체적 안내 가능 → `err()`로 반환
- 예상하지 못한 에러: 구체적 안내 불가, "재시도"만 가능 → `throw`로 ErrorBoundary 위임

> Result 타입(`ok`, `err`, `unwrap`)과 레이어별 에러 처리 패턴은 [AGENTS.md](../AGENTS.md)를 참고하세요.

---

## 레이어별 데이터 흐름

이메일 로그인 플로우를 예시로 성공/실패 경로를 추적합니다.

### 성공 경로

```
KyHttpClient.post('v1/auth/login', { email, password })
  → 200 OK
  → return ok(data)
      │
      ▼
AuthRepositoryImpl.emailLogin()
  → result.ok === true
  → safeParse(result.value) 성공
  → return ok(toAuthTokens(parsed.data))
      │
      ▼
AuthService.emailLogin()
  → result.ok === true
  → saveTokens(accessToken, refreshToken)
  → return result
      │
      ▼
emailLoginMutationOptions.mutationFn()
  → unwrap(result) → result.value 반환
      │
      ▼
onSuccess()
  → setStatus('authenticated')
```

### 실패 경로 — 4xx 서버 에러 (예: 잘못된 비밀번호)

```
KyHttpClient.post('v1/auth/login', { email, password })
  → 401 Unauthorized
  → AfterResponseHook: throw new ApiError(code, MOBILE_ERROR_MESSAGES[code], 401)
  → KyHttpClient.#request() catch → return err(ApiError)
      │
      ▼
AuthRepositoryImpl.emailLogin()
  → result.ok === false
  → return result  (에러 그대로 전파)
      │
      ▼
AuthService.emailLogin()
  → result.ok === false
  → return result  (에러 그대로 전파, saveTokens 호출 안 됨)
      │
      ▼
emailLoginMutationOptions.mutationFn()
  → unwrap(result) → throw result.error
      │
      ▼
onError(error)
  → error.message === '이메일 또는 비밀번호가 틀렸어요'
  → toast.error(error) 또는 특수 처리
```

### 실패 경로 — 인프라 에러 (예: 서버 다운)

```
KyHttpClient.post('v1/auth/login', { email, password })
  → 500 Internal Server Error
  → throw new ServerError(500)   ← 여기서 바로 throw
      │
      ▼
  (Repository, Service, mutationFn 모두 거치지 않음)
      │
      ▼
  <QueryErrorBoundary>가 잡음
  → "오류가 발생했어요" + [재시도] 버튼
```

### 요약 다이어그램

```
HttpClient          Repository           Service            Mutation Options       UI
─────────────────────────────────────────────────────────────────────────────────────────
성공:
  ok(data)  ──→  safeParse + mapper ──→  saveTokens  ──→  unwrap → value  ──→  onSuccess
                 ok(domain)              ok(domain)

4xx 에러:
  err(ApiError) ──→  return result  ──→  return result  ──→  unwrap → throw  ──→  onError
                     (그대로 전파)       (그대로 전파)

InfraError:
  throw  ──────────────────────────────────────────────────────────────────→  ErrorBoundary
  (5xx/네트워크/타임아웃)                 (catch 없이 전파)
```

---

## 예상한 에러: ApiError (Track 1)

서버가 4xx 응답을 보낼 때 발생. 사용자에게 구체적 안내가 가능한 에러.

```typescript
// shared/errors/api-error.ts
class ApiError extends Error implements BusinessError {
  constructor(
    public readonly code: string, // 서버 에러 코드 (AUTH_0101 등)
    message: string, // 한국어 사용자 메시지
    public readonly status: number, // HTTP 상태 코드
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  hasCode<C extends ErrorCodeType>(code: C): this is ApiError & { code: C };
  isDomain(prefix: string): boolean;
}
```

### 에러 코드 → 사용자 메시지 매핑

서버 에러 코드를 Ky AfterResponseHook에서 한국어 메시지로 변환합니다.

```typescript
// shared/infra/http/error-handler.ts
const MOBILE_ERROR_MESSAGES: Partial<Record<ErrorCodeType, string>> = {
  // 보안: 구체적 원인 숨김
  USER_0602: '이메일 또는 비밀번호를 확인해주세요', // 어떤 것이 틀렸는지 숨김
  EMAIL_0502: '입력 정보를 확인해주세요', // 이메일 존재 여부 숨김

  // 일반 에러
  FOLLOW_0901: '이미 친구 요청을 보냈어요',
  VERIFY_0752: '인증 코드가 만료되었어요. 다시 요청해주세요.',
  USER_0615: '탈퇴한 계정이 복구되었어요',
  AI_1303: '이번 달 AI 사용 횟수를 모두 사용했어요',
  // ... 150+ 에러 코드 매핑
};
```

2가지 AfterResponseHook이 존재합니다:

- `handleApiErrors` — auth-client용: 401은 refresh 로직에서 처리하므로 건너뜀
- `handlePublicApiErrors` — public-client용: 401 포함 모든 에러 처리

`ApiError.message`가 이미 사용자 친화적이므로, UI에서는 `toast.error(err)`만 하면 됩니다.

---

## 예상한 에러: BusinessError (Track 2)

### Policy 에러

서버 요청 전에 클라이언트에서 검증하는 에러. 불필요한 네트워크 요청을 방지합니다.

```typescript
// features/friend/services/friend.service.ts
sendRequestByTag = async (
  userTag: string,
): Promise<Result<SendRequestResult, FriendServiceError>> => {
  if (!userTag.trim()) return err(FriendErrors.emptyTag()); // 즉시 반환
  if (!FriendPolicy.isValidTag(userTag)) return err(FriendErrors.invalidTag()); // 즉시 반환
  return this.#repository.sendRequest(userTag); // 검증 통과 후 서버 요청
};
```

### SDK 에러 변환

외부 SDK 에러를 도메인 에러로 변환. SDK 에러가 앱 외부로 유출되지 않도록 합니다.

```typescript
// features/auth/services/auth.service.ts
openAppleLogin = async (): Promise<Result<AuthTokens, AuthServiceError>> => {
  try {
    const credential = await AppleAuthentication.signInAsync({ ... });
    const result = await this.#authRepository.appleLogin(input);
    if (!result.ok) return result;
    await this.saveTokens(result.value.accessToken, result.value.refreshToken);
    return result;
  } catch (error) {
    if (isAuthError(error)) return err(error);
    if (isExpoCodedError(error)) return err(AuthErrors.fromExpoAppleError(error));
    return err(AuthErrors.fromUnknown(error));  // 마지막 방어선
  }
};
```

### 도메인 에러 정의 패턴

```typescript
// features/{domain}/models/{domain}.error.ts
// 1) 에러 코드 상수
export const FriendErrorCode = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
} as const;

// 2) 에러 클래스 (Error + BusinessError 구현)
export class FriendError extends Error implements BusinessError {
  override readonly name = 'FriendError';
  constructor(
    public readonly code: FriendErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// 3) 팩토리 객체
export const FriendErrors = {
  invalidTag: () => new FriendError(FriendErrorCode.INVALID_TAG, '올바른 태그 형식이 아니에요'),
  emptyTag: () => new FriendError(FriendErrorCode.EMPTY_TAG, '태그를 입력해주세요'),
} as const;

// 4) 타입 가드
export const isFriendError = (error: unknown): error is FriendError => error instanceof FriendError;
```

---

## 예상하지 못한 에러: InfraError (Track 3)

복구 불가능한 에러. ErrorBoundary에서 일괄 처리하고 "재시도"만 제공합니다.

| 서브클래스            | 발생 시점          | 메시지                         |
| --------------------- | ------------------ | ------------------------------ |
| `ServerError(status)` | HTTP 5xx           | "서버에 문제가 발생했어요"     |
| `NetworkError`        | 네트워크 끊김      | "네트워크 연결을 확인해주세요" |
| `TimeoutError`        | 요청 시간 초과     | "요청 시간이 초과되었어요"     |
| `ParseError`          | Zod safeParse 실패 | "응답 형식이 올바르지 않아요"  |

### 4xx 에러 흐름 상세

4xx 에러는 2단계를 거칩니다:

1. **AfterResponseHook** (`error-handler.ts`): 서버 에러 코드를 한국어 메시지로 매핑 후 `throw new ApiError()`
2. **KyHttpClient.`#request()`**: catch에서 `err(new ApiError(...))` 로 Result 반환

```typescript
// 1단계: error-handler.ts (AfterResponseHook)
// 401 Unauthorized → throw new ApiError('USER_0602', '이메일 또는 비밀번호를 확인해주세요', 401)

// 2단계: ky-client.ts (#request)
// catch (error) → error instanceof HTTPError → err(new ApiError(...))
```

public-client는 모든 4xx를, auth-client는 401을 제외한 4xx를 처리합니다 (401은 refresh 로직에서 처리).

### InfraError가 throw되는 곳

```typescript
// KyHttpClient.#request() — 4xx만 err(), 나머지는 throw
async #request<T>(request: () => Promise<Response>): Promise<Result<T, ApiError>> {
  try {
    const response = await request();
    const { data } = (await response.json()) as ServerResponse<T>;
    return ok(data);
  } catch (error) {
    if (error instanceof KyTimeoutError) throw new TimeoutError();
    if (error instanceof HTTPError) {
      if (error.response.status >= 500) throw new ServerError(error.response.status);
      const body = await this.#parseErrorBody(error.response);
      return err(new ApiError(
        body?.error.code ?? `HTTP_${error.response.status}`,
        body?.error.message ?? error.response.statusText,
        error.response.status,
        body?.error.details,
      ));
    }
    if (error instanceof TypeError) throw new NetworkError();
    throw error;
  }
}
```

```typescript
// Repository — Zod 검증 실패도 InfraError
const parsed = todoListResponseSchema.safeParse(result.value);
if (!parsed.success) throw new ParseError(); // 서버 응답이 깨진 건 인프라 문제
```

### QueryErrorBoundary

```typescript
// shared/ui/QueryErrorBoundary/QueryErrorBoundary.tsx
export function QueryErrorBoundary({ children, fallback }: QueryErrorBoundaryProps) {
  const errorReporter = useErrorReporter();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          onError={(error) => {
            errorReporter.captureException(
              error instanceof Error ? error : new Error(String(error)),
              { feature: 'error_boundary' },
            );
          }}
          fallbackRender={({ error, resetErrorBoundary }) =>
            fallback ? (
              fallback({ error, reset: resetErrorBoundary })
            ) : (
              <Result
                title="오류가 발생했어요"
                button={<Result.Button onPress={resetErrorBoundary}>재시도</Result.Button>}
              />
            )
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

`onError`에서 에러 리포터를 통해 예외를 캡처하여, 프로덕션 환경에서 ErrorBoundary에 잡힌 에러를 모니터링합니다.

`QueryErrorResetBoundary`는 에러 reset 시 쿼리 에러 상태도 초기화하여, 재시도가 실제로 데이터를 다시 fetch합니다.

### 관측 리포팅 원칙 (Sentry via `ErrorReporter` 포트)

에러 처리는 관측(Sentry)과 어휘를 공유한다. 벤더 직접호출 없이 `ErrorReporter` 포트만 사용한다.

| 상황                                             | 남기는 것                                                   | 왜                         |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------- |
| 예측 불가(ErrorBoundary 도달, 5xx·네트워크·파싱) | `captureException(error, { feature })` — **event**          | 진짜 문제만 Sentry Issue로 |
| 도메인 신호(비자발 로그아웃 등)                  | `captureMessage(msg, { severity, errorCode })` — **event**  | 검색·집계·알림 대상        |
| 행적(HTTP 실패·화면 이동)                        | `addBreadcrumb({ category, level, data })` — **breadcrumb** | 이벤트 타임라인 재현용     |

- **예측 가능한 4xx는 event가 아니다.** `Result.err()`로 UI가 처리하고, HTTP 실패는 `addBreadcrumb({ category: 'http' })`로만 남는다 → Sentry Issue는 예상 못한 문제로만 채워져 신호 대 잡음비가 좋다.
- **Severity**는 `Severity` union(`debug`~`fatal`)으로 판정 → 알림 규칙/우선순위에 사용.
- 전체 규칙(카테고리·태그·Analytics 분담)은 [.claude/observability.md](../.claude/observability.md) 참조.

### ErrorBoundary 배치 전략

독립된 데이터 영역마다 개별 ErrorBoundary를 배치하여 부분 실패를 허용합니다:

```typescript
// app/(app)/(tabs)/feed/index.tsx
<VStack flex={1}>
  {/* 아바타 실패해도 캘린더와 투두는 동작 */}
  <QueryErrorBoundary>
    <Suspense fallback={<UserAvatarList.Loading />}>
      <UserAvatarList />
    </Suspense>
  </QueryErrorBoundary>

  <Calendar value={selectedDate} onChange={setSelectedDate} />

  {/* 투두 실패해도 아바타와 캘린더는 동작 */}
  <QueryErrorBoundary key={formatDate(selectedDate)}>
    <Suspense fallback={<TodoList.Loading />}>
      <TodoList date={selectedDate} />
    </Suspense>
  </QueryErrorBoundary>
</VStack>
```

배치 원칙:

1. 독립된 데이터 영역마다 개별 ErrorBoundary
2. `ErrorBoundary` → `Suspense` → `Component` 순서
3. `key` prop으로 데이터 변경 시 에러 상태 초기화

---

## 저장소 에러: KeychainLockedError

`shared/errors/storage-error.ts`. `InfraError`가 **아니다** — ErrorBoundary로 보내지 않는다.

| 상황                                        | `Storage.get()` 결과                           |
| ------------------------------------------- | ---------------------------------------------- |
| 값이 있음                                   | 파싱된 값                                      |
| 값이 없음 (`errSecItemNotFound`)            | `null`                                         |
| **지금 못 읽음** (기기 잠금)                | `throw KeychainLockedError`                    |
| 영구 오류 (키체인 손상, entitlement 오설정) | **원본 오류 그대로 throw**                     |
| 저장된 값 파싱 실패                         | `null` (손상된 항목 하나가 부팅을 막지 않는다) |

"지금 못 읽는다"를 "토큰이 없다"로 확정하면 **잠긴 키체인이 곧 로그아웃**이 된다.
반대로 모든 읽기 실패를 잠김으로 뭉개면 재판정도 계속 실패해 **조용히 무한 로딩**에 갇힌다.
그래서 일시적 오류만 이 타입으로 승격하고, 영구 오류는 상위(`AuthProvider`)가 관측하고 미인증으로 폴백한다.

벤더 에러 판별(OSStatus 메시지 매칭)은 **인프라 경계**(`secure-storage.ts`)에만 둔다.
도메인 판정 함수(`auth-boot.ts`)는 `isKeychainLockedError()`만 안다.

---

## 던져진 값 다루기: toError / errorMessageOf

JS는 무엇이든 throw할 수 있다. RN 네이티브 브릿지와 서드파티 SDK는 `Error`가 아닌 값
(문자열, `{ message }` 객체)을 던지기도 한다. `instanceof Error`를 **관문**으로 쓰면 조용히 무너진다.

```typescript
// ❌ 평범한 객체가 "[object Object]"가 되어 원인이 사라진다
new Error(String(error));

// ❌ 더 나쁘다 — 에러를 통째로 버린다
logger.error('failed', error instanceof Error ? error : undefined);

// ✅ 값의 모양이 아니라 내용으로 판단. 원본은 cause로 보존
errorReporter.captureException(toError(error), { feature: 'auth' });
logger.warn('갱신 실패', { error: errorMessageOf(error) });
```

| 함수                    | 용도                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `toError(value)`        | `ErrorReporter.captureException`·`logger.error`처럼 `Error`를 요구하는 곳 |
| `errorMessageOf(value)` | 로그 필드, 벤더 에러 메시지 판별                                          |

---

## UI 에러 처리 패턴

### 패턴 1: toast.error 기본 처리

대부분의 경우. `error.message`에 이미 한국어 메시지가 있으므로:

```typescript
mutation.mutate(data, {
  onError: (error) => toast.error(error, { fallback: '작업에 실패했어요' }),
});
```

### 패턴 2: 에러 코드별 분기

특정 에러에 페이지 이동, 다이얼로그 등 특수 동작이 필요할 때:

```typescript
onError: (error) => {
  if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
    router.push({ pathname: './verify-email', params: { email } });
    return;
  }
  toast.error(error, { fallback: '로그인에 실패했어요' });
},
```

### 패턴 3: Optimistic Update 롤백

```typescript
return mutationOptions({
  mutationFn: async (input) => unwrap(await authService.updateMarketingConsent(input)),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.consent() });
    const previousData = queryClient.getQueryData(AUTH_QUERY_KEYS.consent());
    queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), (old) => ({ ...old, ... }));
    return { previousData };
  },
  onError: (_error, _input, context) => {
    if (context?.previousData) {
      queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), context.previousData);
    }
  },
});
```

### 패턴 4: retry 제어

```typescript
retry: (failureCount, error) => {
  if (isNotificationError(error)) {
    if (isNotPhysicalDeviceError(error)) return false;
    if (isPermissionDeniedError(error)) return false;
  }
  return failureCount < MAX_RETRY_COUNT;
},
```

---

## 도메인 에러 현황

| 도메인       | 에러 코드                                                                               | 추가 기능                               |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------- |
| Auth         | `LOGIN_CANCELLED`, `PROVIDER_ERROR`, `VALIDATION_FAILED`, `NO_CODE_RECEIVED`, `UNKNOWN` | `fromExpoAppleError()`, `fromUnknown()` |
| Friend       | `INVALID_TAG`, `EMPTY_TAG`                                                              | -                                       |
| Todo         | `VALIDATION_FAILED`                                                                     | -                                       |
| TodoCategory | `VALIDATION_FAILED`                                                                     | -                                       |
| TodoNudge    | `VALIDATION_FAILED`, `DAILY_LIMIT_EXCEEDED`                                             | -                                       |
| Notification | `PERMISSION_DENIED`, `NOT_PHYSICAL_DEVICE`, `VALIDATION_FAILED`                         | `isPermissionDeniedError()` 등          |

### 네이밍 규칙

| 요소           | 패턴                                         | 예시            |
| -------------- | -------------------------------------------- | --------------- |
| 에러 코드 상수 | `{Feature}ErrorCode`                         | `AuthErrorCode` |
| 에러 클래스    | `{Feature}Error`                             | `AuthError`     |
| 팩토리 객체    | `{Feature}Errors`                            | `AuthErrors`    |
| 타입 가드      | `is{Feature}Error`                           | `isAuthError`   |
| 파일 위치      | `features/{domain}/models/{domain}.error.ts` | `auth.error.ts` |

---

## 체크리스트

### 새 도메인 에러 추가 시

- [ ] `features/{domain}/models/{domain}.error.ts` 생성
- [ ] `{Feature}ErrorCode` 상수 + 타입 정의
- [ ] `{Feature}Error` 클래스 — `Error` 상속, `BusinessError` 구현
- [ ] `{Feature}Errors` 팩토리 객체
- [ ] `is{Feature}Error` 타입 가드

### UI 에러 처리 시

- [ ] `mutationFn`에서 `unwrap(result)` 사용
- [ ] `onError`에서 `toast.error(err, { fallback })` 사용
- [ ] 특수 처리 필요하면 `isApiError` + `hasCode()` 분기
- [ ] Suspense Query 영역은 `<QueryErrorBoundary>`로 감싸기
- [ ] 독립 데이터 섹션마다 개별 ErrorBoundary 배치

---

## 참고 파일

| 파일                                         | 설명                                |
| -------------------------------------------- | ----------------------------------- |
| `shared/errors/result.ts`                    | Result 타입, ok/err/unwrap          |
| `shared/errors/api-error.ts`                 | ApiError (4xx)                      |
| `shared/errors/infra-error.ts`               | InfraError (5xx, 네트워크, 파싱)    |
| `shared/infra/http/ky-client.ts`             | KyHttpClient 구현                   |
| `shared/infra/http/error-handler.ts`         | 에러 코드 → 메시지 매핑 (150+ 코드) |
| `shared/ui/QueryErrorBoundary/`              | QueryErrorBoundary 컴포넌트         |
| `features/*/models/*.error.ts`               | 각 도메인 에러 정의                 |
| [testing-strategy.md](./testing-strategy.md) | 테스트 전략 (에러 테스트 패턴 포함) |
