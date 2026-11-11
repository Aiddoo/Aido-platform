# 에러 처리 가이드

앱의 오류 처리 규칙의 원본이다. 서버와 함께 지키는 계약(envelope, ErrorCode 범위, 한 오류는 한 곳에서)과 한 장 요약은 [공통 오류 규칙](../../../docs/conventions/errors.md)에 있다.

- **단일 원본.** `ErrorCode`·`Errors`·코드별 `details` 스키마(`PUBLIC_ERROR_DETAILS`에 등록한 것)·`HttpStatus`는 `@aido/api/errors`, 실패 응답 모양은 `@aido/api/common`이다. 앱에 코드 문자열·상태 상수(`NOT_FOUND_STATUS` 같은)·details 모양을 다시 만들지 않는다.

## 핵심 원칙

> **"이 에러를 UI가 예상하고 있는가?"**

| 트랙    | 에러 타입                        | 전달 방식                    | 처리 위치                                                                            |
| ------- | -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Track 1 | `ApiError` (4xx)                 | `err()` → `unwrap()` → throw | mutation은 전역 오류 피드백(칸 오류는 `form.setError`), 조회는 경계(404는 안내 화면) |
| Track 2 | `BusinessError` (Policy·SDK)     | `err()` → `unwrap()` → throw | mutation은 전역 오류 피드백                                                          |
| Track 3 | `InfraError` (5xx·네트워크·파싱) | 직접 `throw`                 | 조회는 `<QueryErrorBoundary>`, mutation은 전역 오류 피드백                           |

- 예상한 에러는 구체적으로 안내한다(코드별 분기·토스트·다이얼로그).
- 예상하지 못한 에러는 "다시 시도"와 문의 경로만 준다.
- 한 오류는 한 곳에서만 보인다. 경계 fallback이 그린 오류에 토스트를 더하지 않고, `onError`에서 다시 던지지 않는다.
- `InfraError`를 컴포넌트에서 `try/catch`로 잡아 분기하지 않는다.

## Result

```typescript
export type Result<T, E extends CodedError = CodedError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

`{Entity}Api`와 Device Service는 `Result`를 돌려주고, `queryFn`·`mutationFn`은 `unwrap()`한다. 컴포넌트는 `Result`를 직접 다루지 않는다.

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

- [`api-failure-breadcrumb.ts`](../src/shared/infra/http/api-failure-breadcrumb.ts)의 afterResponse 훅은 **관측만 한다**(실패 breadcrumb `category: 'http'`). 분류하거나 throw하지 않는다. 훅이 분류까지 하면 5xx가 재시도하지 않는 `ApiError`로 둔갑한다. auth-client 훅은 갱신 경로인 401을 건너뛴다.
- `resolveMessage`는 i18n `errors` 카탈로그(키 = ErrorCode) → 서버 message → `errors:fallback` 순서로 사용자 문구를 정한다.
- `{Entity}Api`는 `ApiError`를 그대로 돌려주고, 응답 schema 검증 실패는 `parseApiResponse`가 `ParseError`로 던진다.
- 재시도는 React Query가 소유한다(Ky `retry: 0`).

## Track 1: ApiError

```typescript
// core/errors/api-error.ts
class ApiError extends Error implements CodedError {
  constructor(
    public readonly code: string,
    message: string, // resolveMessage가 고른 사용자 문구
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  );
  hasCode<C extends ErrorCodeType>(code: C): this is ApiError & { code: C };
}
```

코드 분기는 `ErrorCode` 상수로 한다. 문자열 코드를 하드코딩하지 않는다. 상태로 분기하는 것은 `ErrorCode`가 없는 경우(검증·없는 route·429)뿐이고 `HttpStatus.NOT_FOUND`처럼 `@aido/api/errors`의 값을 쓴다.

## mutation 오류 피드백

모든 mutation 옵션은 `meta.errorFeedback`을 하나 둔다. 타입은 `shared/constants/query-meta.ts`가 TanStack `Register`로 등록해 키가 틀리면 컴파일 오류다.

```typescript
errorFeedback: { feature, fallbackKey, isHandledByFeature? } | false
```

| 값                                        | 전역이 하는 일                                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `{ feature, fallbackKey }`                | 햅틱 한 번, `toast.error(getUserFacingMessage(error), { fallback: t(fallbackKey) })` 한 번, 예상하지 못한 오류만 `feature`로 보고         |
| `isHandledByFeature(error)`가 true인 오류 | 아무것도 하지 않는다. 기능 `onError`(코드별 안내·이동·한도 시트)나 호출부의 `form.setError`가 한 곳에서 보인다                            |
| `false`                                   | 아무것도 하지 않는다. 기능이 모든 실패를 직접 보이거나(결제·복원, 음성 계획, 날씨 일괄 옮기기) 화면 뒤 작업(로그아웃, 푸시 기기 보고)이다 |

```typescript
// features/identity/auth/queries/auth.mutations.ts
mutationOptions({
  networkMode: 'always',
  mutationFn: async ({ email, password }: EmailLoginVariables) =>
    unwrap(await authService.emailLogin(email, password)),
  onError: (error, variables) => {
    if (isEmailNotVerifiedError(error)) {
      haptics.notify('error');
      push({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
    }
  },
  meta: {
    errorFeedback: {
      feature: 'auth',
      fallbackKey: 'auth:toasts.loginFailed',
      isHandledByFeature: isEmailNotVerifiedError,
    },
  },
});
```

- **어디서 도나.** 앱 `MutationCache`(`bootstrap/query/mutation-error-feedback-cache.ts`)의 캐시 단계 `onError`가 `meta.errorFeedback`을 읽어 실패를 내보내고, DI·UI Provider 안에 한 번 둔 `bootstrap/query/mutation-error-feedback.tsx`가 받아 햅틱·토스트·보고를 한다. 토스트와 햅틱이 Provider 안의 훅이라 캐시가 직접 부르지 못한다. 언마운트하면 구독을 푼다. 테스트의 `createTestQueryClient`와 `renderScreen`도 같은 캐시와 컴포넌트를 쓴다.
- **왜 `MutationCache.subscribe`가 아닌가.** TanStack은 `await options.onSettled`가 끝난 뒤에야 `error` 상태를 알린다. `onSettled`가 재조회 Promise를 돌려주는 mutation(카테고리 순서, 모두 읽음, 댓글 삭제)은 토스트가 재조회를 기다리고, 오프라인이면 재조회가 멈춰 끝내 뜨지 않는다. 캐시 단계 `onError`는 기능 `onError`·`onSettled`보다 먼저 돈다. 그래서 칸 오류처럼 기능이 보일 오류는 미리 `isHandledByFeature`로 알려야 한다.
- **문구와 보고.** `getUserFacingMessage`는 사용자 문구가 있는 오류(`ApiError`, 카탈로그의 `BusinessError`, 번역된 통신 오류)만 그대로 보이고 `ParseError`·SDK 오류(문자열 `code`가 있어도)의 개발용 message는 `fallbackKey`로 바꾼다. 보고 기준은 `isUnexpectedError`다. 코드를 지닌 오류와 연결 문제는 보고하지 않는다. 그래서 SDK 오류는 어댑터가 코드 없는 포트 오류(`ClipboardCopyError`처럼 원본은 `cause`)로 바꿔야 보고된다. 보고에는 `getErrorReportTags`가 `ServerError`의 상태·method·endpoint를 태그로 붙인다([관측](./observability.md#mutation-오류-피드백)).
- **기능 `onError`.** 낙관적 갱신을 되돌리고, 이미 지워진 대상(`TODO_0833` 등)은 캐시에서 빼 서버 상태에 맞추고, `isHandledByFeature`로 뺀 오류만 보인다. 판별 함수는 `domains/{feature}.error.ts`의 것을 그대로 넘긴다(`isLimitedFeatureError`, `isTodoSeriesFailure`, `isLoginCancelledError`). 서버가 확정한 실패의 분석 이벤트만 함께 둔다([관측](./observability.md#어디서-추적하나)). 다시 던지지 않는다.
- **호출부.** `mutateAsync`의 실패는 이미 알렸으므로 `.catch(noop)`이나 흐름만 잇는 `catch`로 받는다. `useReportUnexpectedError`는 mutation 밖의 실패(조회 결과·기기 작업)에만 쓴다.
- **로그아웃.** 세션이 끝날 때 `abandonPendingMutations`가 진행 중인 mutation의 콜백을 비우면서 `errorFeedback`도 `false`로 바꾼다. 끝난 세션의 실패가 다음 화면에 토스트로 뜨지 않는다.
- 저장 실패는 입력값과 화면을 그대로 둔다. 오프라인 저장도 같은 길이며 `networkMode: 'always'`로 바로 실패해 토스트가 한 번만 나온다.
- `aido/mutation-error-feedback`이 `queries/*.mutations.ts`에서 막는다([가드레일](./architecture/guardrails.md)): `errorFeedback` 누락·`undefined`(mutation 옵션 훅이 아닌 객체를 펼쳐도 누락이다), 전역 피드백인데 `isHandledByFeature` 없이 `onError`가 조건 없이 햅틱·`toast.error`를 내거나 `getUserFacingMessage`를 쓰는 것, `isHandledByFeature`가 있어도 조건 없이 띄우는 기본 문구 토스트, `useReportUnexpectedError` import. 같은 파일의 const meta는 따라가 보고, import한 meta는 선언한 것으로 본다.
- lint가 보지 않는 곳(컴포넌트에 바로 쓴 `useMutation({ … })`)의 빠진 선언은 개발 빌드의 캐시 `onError`가 `query-cache.error-feedback.missing` warn으로 알린다.

### 폼의 칸 오류

서버 4xx 중 특정 칸에 속한 오류(이미 쓴 이메일, 없는 초대 코드)는 토스트 대신 `form.setError`로 그 칸에 보인다. 오류 코드와 칸의 매핑은 `domains/{feature}.error.ts`가 소유한다. mutation 옵션은 그 판별 함수를 `isHandledByFeature`에 넘겨 전역 토스트를 끄고, 폼을 가진 호출부가 `form.setError`에 넘긴다. 매핑이 없는 오류만 전역 피드백으로 간다.

```typescript
// queries/invite.mutations.ts
meta: {
  errorFeedback: {
    feature: 'invite',
    fallbackKey: 'common:toast.defaultError',
    isHandledByFeature: isInviteCodeFieldError,
  },
},

// components/invite-code-entry-form.tsx
try {
  await checkPreview.mutateAsync(inviteCode);
} catch (error) {
  if (isInviteCodeFieldError(error)) {
    form.setError('inviteCode', { message: getUserFacingMessage(error) ?? t('errors.invalidCode') });
  }
}
```

SDK 오류 변환은 어댑터와 mapper 경계에서만 한다(`expo-social-auth-gateway.ts`, `subscription-error.mapper.ts`의 `toSubscriptionError`). 원래 SDK 코드는 진단용으로만 남긴다.

## 서버 오류를 읽는 곳

- 서버 오류는 `domains/{feature}.error.ts`의 이름 있는 판별 함수(`isLocationNotRegisteredError`)로만 읽는다. `*.error.ts` 밖에서 `isApiError`, `hasCode`, `error.status`를 직접 비교하지 않는다. 파일이 없으면 만든다. 공용 분류(`shared/errors`, 재시도 규칙, 오류 경계)만 예외다.
- 연결 끊김·시간 초과 판별은 `shared/errors/infra-error.ts`의 `isConnectivityError` 하나다. feature에 같은 판별을 다시 만들지 않는다.
- 일반 `throw new Error`는 Context 가드(`must be used within …`)와 어댑터의 환경 오류(모듈 없음)만 쓴다. 나머지는 `InfraError` 계열이나 `BusinessError`다. 전용 class는 추가 데이터가 있을 때만 이유 주석과 함께 둔다.
- 오류 코드 문자열, 사용자 문구, Sentry severity 규칙은 바꾸지 않는다.

## Track 2: 기능 오류 (BusinessError)

서버에 보내기 전에 Policy가 거부하거나(자기 자신에게 친구 요청, 한도 초과), 외부 SDK 오류를 도메인 언어로 바꿀 때 쓴다. 폼 형식 검증은 Zod + react-hook-form이 맡는다. `ApiError`와 별개다.

`BusinessError`(`shared/errors/business-error.ts`)는 코드만 들고 있다. 문구는 `errors` 카탈로그의 코드 키로 `getUserFacingMessage`가 고른다. 서버 코드와 앱 코드가 같은 카탈로그를 쓰므로 feature마다 클래스와 팩토리, 가드를 반복하지 않는다.

```typescript
// shared/errors/business-error.ts
export class BusinessError<TCode extends string = string> extends Error {
  constructor(readonly code: TCode) {
    super(code);
  }
}

// features/social/friend/domains/friend.error.ts: 코드 표만 소유한다. 값은 바꾸지 않는다
export const FRIEND_ERROR_CODE = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
} as const;

// Device Service·Policy 경계: 던지지 않고 Result로 돌려준다
return err(new BusinessError(FRIEND_ERROR_CODE.EMPTY_TAG));

// 판별: 코드를 넘기면 그 코드인 오류만 통과한다. 서버 ApiError도 같은 길이다
if (isCodedError(error, FRIEND_ERROR_CODE.INVALID_TAG)) { … }
```

| 요소        | 패턴                          | 위치                                                   |
| ----------- | ----------------------------- | ------------------------------------------------------ |
| 코드 상수   | `{FEATURE}_ERROR_CODE`        | `features/{area}/{feature}/domains/{feature}.error.ts` |
| 문구        | 코드를 키로 한 ko·en 항목     | `shared/i18n/locales/{ko,en}/errors.json`              |
| 던지기      | `new BusinessError(코드)`     | Device Service·Policy 경계                             |
| 판별        | `isCodedError(error, 코드)`   | 호출부. `match`로 분기하면 `exhaustive()`를 쓴다       |
| 사용자 문구 | `getUserFacingMessage(error)` | `toast.error(getUserFacingMessage(error))`             |

`isCodedError(error)`는 코드를 가진 모든 오류(`ApiError`, `BusinessError`와 그 하위 클래스)에 참이고, 그 타입은 `CodedError`다. 코드 상수를 둔 feature는 `domains/{feature}.error.ts`에서 `BusinessError`를 쓰거나 `isApiError`로 서버 코드를 판별한다. 하위 클래스가 필요하면 `SubscriptionError`처럼 `BusinessError`를 확장한다.

## 조회에서 예상한 상태

조회에서도 예상한 상태는 경계로 던지지 않는다. 구독 요금제 조회는 query options가 `toOfferingsAvailability`로 `{ status: 'available' | 'unavailable' }`를 캐시에 둔다. 관측은 조회가 아니라 요금제 자리가 안내를 보일 때 `useReportStoreUnavailable`로 남긴다.

| 상황                          | 결과          | 화면                                                                              | 관측(앱 실행마다 코드별 한 번)                  |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| 스토어 설정 문제(`setup`)     | `unavailable` | 요금제 자리의 `SubscriptionResult.Failure`: 설정 문제 안내 + 다시 시도 + 문의하기 | 배포 `captureMessage` error, 개발 `logger.warn` |
| 스토어 일시 문제(`temporary`) | `unavailable` | 요금제 자리의 `SubscriptionResult.Failure`: 일시 문제 안내 + 다시 시도 + 문의하기 | 배포 `captureMessage` warning                   |
| 연결 오류·요금제 없음·그 밖   | `throw`       | 요금제 자리의 경계 fallback(다시 시도 + 문의하기)                                 | 경계가 리포트                                   |

## Track 3: InfraError와 QueryErrorBoundary

| 서브클래스            | 발생               | `message`                                                                   |
| --------------------- | ------------------ | --------------------------------------------------------------------------- |
| `ServerError(status)` | HTTP 5xx           | `common:infraErrors.server`                                                 |
| `NetworkError`        | 네트워크 끊김      | `common:infraErrors.network`                                                |
| `TimeoutError`        | 요청 시간 초과     | `common:infraErrors.timeout`                                                |
| `ParseError`          | Zod 응답 검증 실패 | `parseApiResponse`가 넘긴 개발용 문자열. `getUserFacingMessage`가 걸러 낸다 |

[`QueryErrorBoundary`](../src/shared/ui/query-error-boundary/query-error-boundary.tsx)는 `classifyBoundaryError`로 잡은 오류를 나눈다.

| 종류              | 대상                                                                          | 리포트                        | 화면                           |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------ |
| `auth-transition` | 401 ApiError                                                                  | warning 메시지                | 앱 경계가 로그인으로 보낸다    |
| `expected-state`  | 404 ApiError, 기능 꺼짐(`INVITE_2105`), 친구가 끊긴 친구 할 일(`FOLLOW_0906`) | breadcrumb만                  | fallback이 안내를 그린다       |
| `error`           | 네트워크·타임아웃                                                             | `network` breadcrumb(warning) | fallback(다시 시도 + 문의하기) |
| `error`           | 그 밖(5xx·파싱 등)                                                            | `captureException`            | fallback(다시 시도 + 문의하기) |

- 독립된 데이터 블록마다 `QueryErrorBoundary → Suspense → 블록`을 둬 부분 실패를 허용한다. 식별자가 바뀌면 `resetKeys`로 이전 실패를 푼다.
- 기능 fallback은 `fallback={X.Error}`로 연결하고, 버튼 자리에 `QueryErrorActions`(다시 시도 + 문의하기)를 둔다. 경계 없이 한 칸 안에서 "실패 + 다시 시도"를 보일 때는 `QueryErrorFallback.Inline`을 쓴다(직접 만든 인라인 실패 UI를 두지 않는다). route 시트 안에서는 `sheet.close(INQUIRY_SHEET_EXIT)`로 닫고 이동한다([QueryErrorBoundary 문서](../src/shared/ui/query-error-boundary/query-error-boundary.md)).
- mutation은 경계로 가지 않는다(`throwOnError` 미사용). 피드백은 위 [전역 오류 피드백](#mutation-오류-피드백)이다.

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
- 영속 조회는 쿼리 옵션의 `meta.persist`에 모델 스키마까지 둔다([data](./architecture/data.md#무효화)). 따로 등록부를 고치지 않는다. 복원한 값을 스키마로 검증해 깨진 조회만 버리고 서버에서 다시 받으며, 표에 없는 조회도 버린다. 값은 바꾸지 않는다. 버린 수는 `query-cache.restored-queries.dropped` warn으로 남는다.
- 복원 직후 전체를 invalidate한다. 앱이 꺼지기 전의 낙관적 반영이 서버 값처럼 남지 않게 하기 위해서다.
- 로그인한 사용자 키에만 쓰고(`useClaimDeviceDataForUser`가 주인 지정), 미인증 전환 때 `SessionCleanupService`가 `queryClient.clear()`와 함께 지운다. 앱 버전·OTA가 바뀌면 버린다(`query-cache-persistence.ts`).

## 저장소 에러: KeychainLockedError

`shared/errors/storage-error.ts`. `InfraError`가 **아니다**. ErrorBoundary로 보내지 않는다.

| 상황                                        | `Storage.get()` 결과                           |
| ------------------------------------------- | ---------------------------------------------- |
| 값이 있음                                   | 파싱된 값                                      |
| 값이 없음 (`errSecItemNotFound`)            | `null`                                         |
| **지금 못 읽음** (기기 잠금)                | `throw KeychainLockedError`                    |
| 영구 오류 (키체인 손상, entitlement 오설정) | **원본 오류 그대로 throw**                     |
| 저장된 값 파싱 실패                         | `null` (손상된 항목 하나가 부팅을 막지 않는다) |

"지금 못 읽는다"를 "토큰이 없다"로 확정하면 잠긴 키체인이 곧 로그아웃이 된다. 반대로 모든 읽기 실패를 잠김으로 뭉개면 재판정도 계속 실패해 무한 로딩에 갇힌다. 그래서 일시적 오류만 이 타입으로 승격하고, 영구 오류는 `useAuthBoot`가 관측하고 미인증으로 폴백한다. 벤더 에러 판별(OSStatus 메시지 매칭)은 `secure-storage.ts`에만 두고, `bootstrap/auth/resolve-initial-auth-status.ts`는 `isKeychainLockedError()`만 안다.

## 던져진 값 다루기: toError / getErrorMessage

RN 네이티브 브릿지와 서드파티 SDK는 `Error`가 아닌 값(문자열, `{ message }` 객체)을 던지기도 한다. `new Error(String(error))`는 평범한 객체를 `[object Object]`로 만들어 원인을 없앤다.

```typescript
errorReporter.captureException(toError(error), { feature: 'auth' });
logger.warn(TOKEN_REFRESHER_LOG_EVENT.TRANSIENT_REFRESH_FAILED, { error: getErrorMessage(error) });
logger.error(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, toError(error)); // Sentry 이벤트. captureException과 중복 금지
```

## 관측

예상하지 못한 오류(경계 도달, 5xx·파싱)만 보고한다. mutation은 `meta.errorFeedback`을 읽는 전역 캐시 `onError`, 그 밖은 `useReportUnexpectedError` 같은 훅이 보내고 서비스는 삼킨 실패를 `logger.warn`으로만 남긴다. 예측 가능한 4xx는 이벤트가 아니다. 무엇을 어느 레벨로 남기는지는 [observability.md](./observability.md#오류-분류와-한-번만-보고)에 있다.

## 참고 파일

| 파일                                          | 설명                             |
| --------------------------------------------- | -------------------------------- |
| `core/errors/result.ts`                       | Result 타입, ok/err/unwrap       |
| `core/errors/api-error.ts`                    | ApiError (4xx)                   |
| `shared/errors/infra-error.ts`                | InfraError (5xx, 네트워크, 파싱) |
| `shared/errors/classify-boundary-error.ts`    | 경계 오류 분류                   |
| `shared/errors/user-facing-message.ts`        | 사용자에게 보여도 되는 문구 판정 |
| `shared/infra/http/ky-client.ts`              | 분류의 단일 소유                 |
| `shared/infra/http/api-failure-breadcrumb.ts` | 실패 breadcrumb                  |
| `shared/infra/http/ky-error.ts`               | `resolveMessage`, 오류 변환      |
| `shared/ui/query-error-boundary/`             | QueryErrorBoundary               |
| `shared/constants/query-meta.ts`              | `meta.errorFeedback` 타입        |
| `bootstrap/query/mutation-error-feedback*`    | mutation 전역 오류 피드백        |
| `shared/query/is-last-mutation.ts`            | 마지막 변경 판정                 |
| `features/*/domains/*.error.ts`               | 기능 오류                        |
