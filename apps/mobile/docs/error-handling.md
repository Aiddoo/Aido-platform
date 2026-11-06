# 에러 처리 가이드

**Version**: 1.3.0 · **Last Updated**: 2026-11-06 · **Owner**: Aido Mobile Team

앱의 오류 처리 규칙의 원본이다. 서버와 함께 지키는 계약(envelope, ErrorCode 범위, 한 오류는 한 곳에서)은 [공통 오류 규칙](../../../docs/conventions/errors.md)에 있다.

## 핵심 원칙

> **"이 에러를 UI가 예상하고 있는가?"**

| 트랙    | 에러 타입                        | 전달 방식                    | 처리 위치                                             |
| ------- | -------------------------------- | ---------------------------- | ----------------------------------------------------- |
| Track 1 | `ApiError` (4xx)                 | `err()` → `unwrap()` → throw | mutation `onError`, 조회는 경계(404는 안내 화면)      |
| Track 2 | `{Feature}Error` (Policy·SDK)    | `err()` → `unwrap()` → throw | mutation `onError`                                    |
| Track 3 | `InfraError` (5xx·네트워크·파싱) | 직접 `throw`                 | 조회는 `<QueryErrorBoundary>`, mutation은 기본 토스트 |

- 예상한 에러는 구체적으로 안내한다(코드별 분기·토스트·다이얼로그).
- 예상하지 못한 에러는 "다시 시도"와 문의 경로만 준다.
- 한 오류는 한 곳에서만 보인다. 경계 fallback이 그린 오류에 토스트를 더하지 않고, `onError`에서 다시 던지지 않는다.
- `InfraError`를 컴포넌트에서 `try/catch`로 잡아 분기하지 않는다.

## Result

```typescript
export type Result<T, E extends BusinessError = BusinessError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Service는 `Result`를 돌려주고, `queryFn`·`mutationFn`은 `unwrap()`한다. 컴포넌트는 `Result`를 직접 다루지 않는다.

`mutationFn`은 반드시 `unwrap()`한다. React Query는 throw가 없으면 성공으로 본다. `Result.err()`를 그대로 돌려주면 `onSuccess`가 불린다.

## 분류는 KyHttpClient 한 곳

[`shared/infra/http/ky-client.ts`](../src/shared/infra/http/ky-client.ts)의 `#request`가 분류를 소유한다.

```text
2xx  → successEnvelopeSchema 검증 실패면 throw ParseError, 아니면 ok(data)
4xx  → errorEnvelopeSchema로 code를 읽어 err(new ApiError(code, resolveMessage(code, message), status, details))
       (알 수 없는 code는 SYS_0001)
5xx  → throw ServerError
타임아웃 → throw TimeoutError, 네트워크 → throw NetworkError
```

- [`error-handler.ts`](../src/shared/infra/http/error-handler.ts)의 afterResponse 훅은 **관측만 한다**(실패 breadcrumb `category: 'http'`). 분류하거나 throw하지 않는다. 훅이 분류까지 하면 5xx가 재시도하지 않는 `ApiError`로 둔갑한다. auth-client 훅은 갱신 경로인 401을 건너뛴다.
- `resolveMessage`는 i18n `errors` 카탈로그(키 = ErrorCode) → 서버 message → `errors:fallback` 순서로 사용자 문구를 정한다.
- Service는 `ApiError`를 그대로 전달하고, 응답 schema 검증 실패는 `ParseError`로 던진다.
- 재시도는 React Query가 소유한다(Ky `retry: 0`).

## Track 1: ApiError

```typescript
// shared/errors/api-error.ts
class ApiError extends Error implements BusinessError {
  constructor(
    public readonly code: string,
    message: string, // resolveMessage가 고른 사용자 문구
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  );
  hasCode<C extends ErrorCodeType>(code: C): this is ApiError & { code: C };
  isDomain(prefix: string): boolean;
}
```

코드 분기는 `ErrorCode` 상수로 한다. 문자열 코드를 하드코딩하지 않는다.

## Mutation의 onError

```typescript
onError: (error) => {
  if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
    router.push({ pathname: './verify-email', params: { email } });
    return;
  }
  if (isApiError(error) || is{Feature}Error(error)) {
    toast.error(error.message);
    return;
  }
  // InfraError의 message가 개발용일 수 있어 기본 문구를 쓴다. 다시 던지지 않는다
  toast.error(undefined, { fallback: t('common:toast.defaultError') });
},
```

`toast.error(error, { fallback })`는 사용자 문구면 그 메시지를, 아니면 fallback을 보여 준다.

## Track 2: 기능 오류 ({Feature}Error)

서버에 보내기 전에 Policy가 거부하거나(자기 자신에게 친구 요청, 한도 초과), 외부 SDK 오류를 도메인 언어로 바꿀 때 쓴다. 폼 형식 검증은 Zod + react-hook-form이 맡는다. `ApiError`와 별개다.

```typescript
// features/social/friend/domains/friend.error.ts
export const FriendErrorCode = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
} as const;
export type FriendErrorCode = (typeof FriendErrorCode)[keyof typeof FriendErrorCode];

export class FriendError extends Error implements BusinessError {
  override readonly name = 'FriendError';
  constructor(
    public readonly code: FriendErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const FriendErrors = {
  invalidTag: () => new FriendError(FriendErrorCode.INVALID_TAG, t('friend:errors.invalidTag')),
} as const;

export const isFriendError = (error: unknown): error is FriendError => error instanceof FriendError;
```

| 요소      | 패턴                 | 위치                                            |
| --------- | -------------------- | ----------------------------------------------- |
| 코드 상수 | `{Feature}ErrorCode` | `features/{feature}/domains/{feature}.error.ts` |
| 클래스    | `{Feature}Error`     | 같은 파일                                       |
| 팩토리    | `{Feature}Errors`    | 같은 파일                                       |
| 가드      | `is{Feature}Error`   | 같은 파일                                       |

SDK 오류 변환은 어댑터·Service 경계에서만 한다(`AuthErrors.fromExpoAppleError`, `subscription-error.mapper.ts`의 `toSubscriptionError`). 원래 SDK 코드는 진단용으로만 남긴다.

### 조회에서 예상한 상태

조회에서도 예상한 상태는 경계로 던지지 않는다. 구독 요금제 조회는 query options가 `toOfferingsAvailability`로 `{ status: 'available' | 'unavailable' }`를 캐시에 둔다.

| 상황                          | 결과          | 화면                                                                              | 관측(앱 실행마다 코드별 한 번)                  |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| 스토어 설정 문제(`setup`)     | `unavailable` | 요금제 자리의 `SubscriptionResult.Failure`: 설정 문제 안내 + 다시 시도 + 문의하기 | 배포 `captureMessage` error, 개발 `logger.warn` |
| 스토어 일시 문제(`temporary`) | `unavailable` | 요금제 자리의 `SubscriptionResult.Failure`: 일시 문제 안내 + 다시 시도 + 문의하기 | 배포 `captureMessage` warning                   |
| 연결 오류·요금제 없음·그 밖   | `throw`       | 요금제 자리의 경계 fallback(다시 시도 + 문의하기)                                 | 경계가 리포트                                   |

## Track 3: InfraError와 QueryErrorBoundary

| 서브클래스            | 발생               | `message`                                                        |
| --------------------- | ------------------ | ---------------------------------------------------------------- |
| `ServerError(status)` | HTTP 5xx           | `common:infraErrors.server`                                      |
| `NetworkError`        | 네트워크 끊김      | `common:infraErrors.network`                                     |
| `TimeoutError`        | 요청 시간 초과     | `common:infraErrors.timeout`                                     |
| `ParseError`          | Zod 응답 검증 실패 | Service가 넘긴 개발용 문자열. `getUserFacingMessage`가 걸러 낸다 |

[`QueryErrorBoundary`](../src/shared/ui/query-error-boundary/query-error-boundary.tsx)는 `classifyBoundaryError`로 잡은 오류를 나눈다.

| 종류              | 대상                                   | 리포트                        | 화면                           |
| ----------------- | -------------------------------------- | ----------------------------- | ------------------------------ |
| `auth-transition` | 401 ApiError                           | warning 메시지                | 앱 경계가 로그인으로 보낸다    |
| `expected-state`  | 404 ApiError, 기능 꺼짐(`INVITE_2105`) | breadcrumb만                  | fallback이 안내를 그린다       |
| `error`           | 네트워크·타임아웃                      | `network` breadcrumb(warning) | fallback(다시 시도 + 문의하기) |
| `error`           | 그 밖(5xx·파싱 등)                     | `captureException`            | fallback(다시 시도 + 문의하기) |

- 독립된 데이터 블록마다 `QueryErrorBoundary → Suspense → 블록`을 둬 부분 실패를 허용한다. 식별자가 바뀌면 `resetKeys`로 이전 실패를 푼다.
- 기능 fallback은 `fallback={X.Error}`로 연결하고, 버튼 자리에 `QueryErrorActions`(다시 시도 + 문의하기)를 둔다. route 시트 안에서는 `sheet.close(INQUIRY_SHEET_EXIT)`로 닫고 이동한다([QueryErrorBoundary 문서](../src/shared/ui/query-error-boundary/query-error-boundary.md)).
- mutation은 경계로 가지 않는다(`throwOnError` 미사용). `ParseError`의 message는 개발용이므로, 기능 오류가 아닌 경우의 토스트는 `fallback` 문구를 쓴다.

## 오프라인

연결 감지는 `NetworkStatusGateway`(expo-network) → `OnlineManagerProvider` → React Query `onlineManager` 한 곳이다.
기본 `networkMode: 'online'`이라 오프라인이면 쿼리·뮤테이션이 멈추고(fetchStatus `paused`) 다시 연결되면 이어서 실행된다.

| 상황                 | 화면                                             | 관측                                |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| 오프라인             | 루트 `OfflineBanner` 하나, 블록은 로딩·캐시 유지 | 전환마다 `network` breadcrumb 한 번 |
| 온라인인데 연결 오류 | 블록 fallback(다시 시도 + 문의하기)              | `network` breadcrumb(warning)       |
| 온라인인데 5xx·파싱  | 블록 fallback(다시 시도 + 문의하기)              | `captureException`                  |

- 경계는 연결 상태를 `resetKeys`에 더해 오프라인 전환·복귀 때 오류 화면을 풀고 다시 불러온다.
- `networkMode: 'always'`는 두 경우다. 기기 안에서만 처리하는 작업(앱 아이콘, 클립보드, 알림 권한, 공유)과 로그아웃, 그리고 멈췄다가 나중에 실행되면 안 되는 쓰기(메모 저장·삭제·할 일 변환, 결제·복원, 음성 정리·계획 적용, AI 동의)다.
- 로그아웃은 오프라인이면 서버 요청 없이 토큰만 지우고, 온라인이면 요청마다 짧은 `timeout`을 건다(`logOutDevice`).
- 화면 뒤 작업(배지 동기화 등)의 연결 오류는 `logger.warn`이다. `logger.error`는 Sentry 이벤트가 된다.
- 구독 화면의 혜택은 스토어 응답 없이 그린다. 오프라인이면 요금제 자리에 스켈레톤 대신 「연결되면 보여드릴게요」 안내를 보이고 결제·복원 버튼을 이유와 함께 잠근다. 프리미엄 판정은 서버 내 정보(복원된 캐시) 기준이라 오프라인에서 내려가지 않는다.

### 조회 캐시 보관

오프라인으로 앱을 다시 열어도 마지막 데이터를 보이도록 opt-in한 조회만 기기에 24시간 보관한다.

- 저장소는 초안과 같은 SecureStore 키로 연 AES-256 MMKV `aido.query-cache.encrypted`다. 키를 읽지 못한 실행(잠금 해제 전 실행·키체인 오류)은 `query-cache.encrypted-storage.unavailable` warn만 남기고 저장하지 않는다.
- 조회 옵션에 `...PERSISTED_QUERY_OPTIONS`(`meta.persist` + `gcTime` 24시간)를 붙인다. 토큰·결제·배지 수·AI 제안은 붙이지 않는다.
- 복원 직후 전체를 invalidate한다. 앱이 꺼지기 전의 낙관적 반영이 서버 값처럼 남지 않게 하기 위해서다.
- 로그인한 사용자 키에만 쓰고(`useUserIdentity`가 주인 지정), 미인증 전환 때 `AuthProvider`가 `queryClient.clear()`와 함께 지운다. 앱 버전·OTA가 바뀌면 버린다(`query-cache-persistence.ts`).

## 저장소 에러: KeychainLockedError

`shared/errors/storage-error.ts`. `InfraError`가 **아니다**. ErrorBoundary로 보내지 않는다.

| 상황                                        | `Storage.get()` 결과                           |
| ------------------------------------------- | ---------------------------------------------- |
| 값이 있음                                   | 파싱된 값                                      |
| 값이 없음 (`errSecItemNotFound`)            | `null`                                         |
| **지금 못 읽음** (기기 잠금)                | `throw KeychainLockedError`                    |
| 영구 오류 (키체인 손상, entitlement 오설정) | **원본 오류 그대로 throw**                     |
| 저장된 값 파싱 실패                         | `null` (손상된 항목 하나가 부팅을 막지 않는다) |

"지금 못 읽는다"를 "토큰이 없다"로 확정하면 잠긴 키체인이 곧 로그아웃이 된다. 반대로 모든 읽기 실패를 잠김으로 뭉개면 재판정도 계속 실패해 무한 로딩에 갇힌다. 그래서 일시적 오류만 이 타입으로 승격하고, 영구 오류는 `AuthProvider`가 관측하고 미인증으로 폴백한다. 벤더 에러 판별(OSStatus 메시지 매칭)은 `secure-storage.ts`에만 두고, `auth-boot.ts`는 `isKeychainLockedError()`만 안다.

## 던져진 값 다루기: toError / getErrorMessage

RN 네이티브 브릿지와 서드파티 SDK는 `Error`가 아닌 값(문자열, `{ message }` 객체)을 던지기도 한다. `new Error(String(error))`는 평범한 객체를 `[object Object]`로 만들어 원인을 없앤다.

```typescript
errorReporter.captureException(toError(error), { feature: 'auth' });
logger.warn(TOKEN_REFRESHER_LOG_EVENT.TRANSIENT_REFRESH_FAILED, { error: getErrorMessage(error) });
logger.error(AI_LOG_EVENT.SUGGESTION_ACTION_FAILED, toError(error)); // Sentry 이벤트. captureException과 중복 금지
```

## 관측

| 상황                            | 남기는 것                                      |
| ------------------------------- | ---------------------------------------------- |
| 예측 불가(경계 도달, 5xx·파싱)  | `captureException(error, { feature })`         |
| 연결 오류(네트워크·타임아웃)    | `network` breadcrumb(warning)                  |
| 도메인 신호(비자발 로그아웃 등) | `captureMessage(msg, { severity, errorCode })` |
| 행적(HTTP 실패·화면 이동)       | `addBreadcrumb({ category, level, data })`     |

예측 가능한 4xx는 event가 아니다. 전체 규칙은 [observability.md](../.claude/observability.md)에 있다.

## 참고 파일

| 파일                                       | 설명                              |
| ------------------------------------------ | --------------------------------- |
| `shared/errors/result.ts`                  | Result 타입, ok/err/unwrap        |
| `shared/errors/api-error.ts`               | ApiError (4xx)                    |
| `shared/errors/infra-error.ts`             | InfraError (5xx, 네트워크, 파싱)  |
| `shared/errors/classify-boundary-error.ts` | 경계 오류 분류                    |
| `shared/errors/user-facing-message.ts`     | 사용자에게 보여도 되는 문구 판정  |
| `shared/infra/http/ky-client.ts`           | 분류의 단일 소유                  |
| `shared/infra/http/error-handler.ts`       | 실패 breadcrumb, `resolveMessage` |
| `shared/ui/query-error-boundary/`          | QueryErrorBoundary                |
| `features/*/domains/*.error.ts`            | 기능 오류                         |
